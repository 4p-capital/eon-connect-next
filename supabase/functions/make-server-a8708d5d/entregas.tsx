import { Hono } from "npm:hono@4";
import { createClient } from "npm:@supabase/supabase-js@2";

export const entregasRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// 🔑 ENTREGA DE CHAVES — Fase 1: Agendamento (rotas públicas)
// ═══════════════════════════════════════════════════════════════════
//
// Fluxo:
//   1. POST /entregas/validar-cpf   → GATE (AGEHAB+PRO-SOLUTO+JUROS-OBRA)
//   2. GET  /entregas/disponibilidade?empreendimento=...&desde=...&ate=...
//   3. POST /entregas/reservar      → UPDATE atômico (anti-overbooking)
//   4. POST /entregas/cancelar
//   5. POST /entregas/remarcar
//
// Regras:
//   - Cliente identificado por CPF (somente dígitos)
//   - Gate: pendencia_agehab AND pendencia_prosoluto AND pendencia_jurosobra = false
//   - Janela mínima: D+7 (cliente só agenda 7 dias após hoje)
//   - Concorrência: partial unique index em entrega_slot.reserva_cliente_id
// ═══════════════════════════════════════════════════════════════════

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
  }
  return _supabase;
}

const EMPREENDIMENTO_PADRAO = "Gran Santorini";
const DIAS_MINIMO_ANTECEDENCIA = 7;

const onlyDigits = (s: string | null | undefined) =>
  (s ?? "").replace(/\D/g, "");

function dataMinimaAgendavel(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + DIAS_MINIMO_ANTECEDENCIA);
  return d.toISOString().slice(0, 10);
}

// ───────────────────────────────────────────────────────────────────
// POST /entregas/validar-cpf
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/validar-cpf", async (c) => {
  try {
    const body = await c.req.json();
    const cpf = onlyDigits(body?.cpf);

    if (cpf.length !== 11) {
      return c.json(
        { ok: false, error: "CPF inválido", code: "CPF_INVALIDO" },
        400,
      );
    }

    const supabase = getSupabase();

    // Busca o cliente pelo CPF (ignorando formatação no banco)
    const { data: clientes, error } = await supabase
      .from("clientes_entrega_santorini")
      .select(
        "id, cliente, cpf_cnpj, bloco, unidade, telefone, email, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, agendado_em",
      );

    if (error) throw error;

    const cliente = (clientes ?? []).find(
      (c: any) => onlyDigits(c.cpf_cnpj) === cpf,
    );

    if (!cliente) {
      return c.json(
        {
          ok: false,
          error: "CPF não encontrado nos registros do Gran Santorini",
          code: "CPF_NAO_ENCONTRADO",
        },
        404,
      );
    }

    const pendencias = {
      agehab: cliente.pendencia_agehab === true,
      pro_soluto: cliente.pendencia_prosoluto === true,
      juros_obra: cliente.pendencia_jurosobra === true,
    };

    const temPendencia =
      pendencias.agehab || pendencias.pro_soluto || pendencias.juros_obra;

    // Busca reserva ativa do cliente (se houver), incluindo checkin_token
    const { data: reservaAtiva } = await supabase
      .from("entrega_slot")
      .select("id, data, hora_inicio, hora_fim, reservado_em, checkin_token")
      .eq("reserva_cliente_id", cliente.id)
      .maybeSingle();

    return c.json({
      ok: !temPendencia,
      cliente: {
        id: cliente.id,
        nome: cliente.cliente,
        bloco: cliente.bloco,
        unidade: cliente.unidade,
        telefone: cliente.telefone,
        email: cliente.email,
      },
      pendencias,
      tem_pendencia: temPendencia,
      reserva_ativa: reservaAtiva
        ? {
            slot_id: (reservaAtiva as any).id,
            data: (reservaAtiva as any).data,
            hora_inicio: (reservaAtiva as any).hora_inicio,
            hora_fim: (reservaAtiva as any).hora_fim,
            reservado_em: (reservaAtiva as any).reservado_em,
            checkin_token: (reservaAtiva as any).checkin_token,
          }
        : null,
      data_minima_agendavel: dataMinimaAgendavel(),
    });
  } catch (err) {
    console.error("❌ /entregas/validar-cpf:", err);
    return c.json(
      { ok: false, error: "Erro interno ao validar CPF" },
      500,
    );
  }
});

// ───────────────────────────────────────────────────────────────────
// GET /entregas/disponibilidade?desde=YYYY-MM-DD&ate=YYYY-MM-DD
// Retorna agregação por dia + lista de slots livres
// ───────────────────────────────────────────────────────────────────
entregasRoutes.get("/entregas/disponibilidade", async (c) => {
  try {
    const desdeParam = c.req.query("desde");
    const ateParam = c.req.query("ate");

    const desde = desdeParam ?? dataMinimaAgendavel();
    // Default: 90 dias à frente
    const ate =
      ateParam ??
      (() => {
        const d = new Date(desde + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 90);
        return d.toISOString().slice(0, 10);
      })();

    const supabase = getSupabase();

    // Busca TODOS os slots não-bloqueados da janela (livres + reservados)
    // pra conseguir mostrar dias lotados como desabilitados.
    const { data: slots, error } = await supabase
      .from("entrega_slot")
      .select("id, data, hora_inicio, hora_fim, reserva_cliente_id")
      .eq("empreendimento", EMPREENDIMENTO_PADRAO)
      .gte("data", desde)
      .lte("data", ate)
      .eq("bloqueado", false)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) throw error;

    type SlotItem = {
      id: string;
      hora_inicio: string;
      hora_fim: string;
      ocupado: boolean;
    };
    const porDia = new Map<
      string,
      { vagas: number; total: number; horarios: SlotItem[] }
    >();
    for (const s of (slots as any[]) ?? []) {
      const dia = s.data;
      if (!porDia.has(dia)) porDia.set(dia, { vagas: 0, total: 0, horarios: [] });
      const entry = porDia.get(dia)!;
      entry.total += 1;
      const ocupado = s.reserva_cliente_id != null;
      if (!ocupado) entry.vagas += 1;
      entry.horarios.push({
        id: s.id,
        hora_inicio: s.hora_inicio,
        hora_fim: s.hora_fim,
        ocupado,
      });
    }

    const dias = Array.from(porDia.entries()).map(([data, info]) => ({
      data,
      vagas: info.vagas,
      total: info.total,
      lotado: info.vagas === 0,
      horarios: info.horarios,
    }));

    return c.json({
      ok: true,
      desde,
      ate,
      dias,
      total_slots: slots?.length ?? 0,
    });
  } catch (err) {
    console.error("❌ /entregas/disponibilidade:", err);
    return c.json({ ok: false, error: "Erro ao buscar disponibilidade" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/reservar  { cpf, slot_id }
// UPDATE atômico — Postgres serializa via partial unique index
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/reservar", async (c) => {
  try {
    const body = await c.req.json();
    const cpf = onlyDigits(body?.cpf);
    const slotId = String(body?.slot_id ?? "");

    if (cpf.length !== 11 || !slotId) {
      return c.json(
        { ok: false, error: "Parâmetros inválidos", code: "INVALID_INPUT" },
        400,
      );
    }

    const supabase = getSupabase();

    // 1) Revalida o gate
    const { data: clientes, error: errCli } = await supabase
      .from("clientes_entrega_santorini")
      .select(
        "id, cliente, bloco, unidade, telefone, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, cpf_cnpj",
      );
    if (errCli) throw errCli;

    const cliente = (clientes ?? []).find(
      (c: any) => onlyDigits(c.cpf_cnpj) === cpf,
    );

    if (!cliente) {
      return c.json(
        { ok: false, error: "CPF não encontrado", code: "CPF_NAO_ENCONTRADO" },
        404,
      );
    }

    if (
      cliente.pendencia_agehab ||
      cliente.pendencia_prosoluto ||
      cliente.pendencia_jurosobra
    ) {
      return c.json(
        {
          ok: false,
          error: "Cliente possui pendências e não pode agendar",
          code: "GATE_BLOQUEADO",
        },
        403,
      );
    }

    // 2) Confere se o slot está dentro da janela D+7
    const { data: slotInfo, error: errSlot } = await supabase
      .from("entrega_slot")
      .select("id, data, hora_inicio, hora_fim, bloqueado, reserva_cliente_id")
      .eq("id", slotId)
      .maybeSingle();
    if (errSlot) throw errSlot;
    if (!slotInfo) {
      return c.json(
        { ok: false, error: "Slot não encontrado", code: "SLOT_INEXISTENTE" },
        404,
      );
    }
    if ((slotInfo as any).bloqueado) {
      return c.json(
        { ok: false, error: "Slot bloqueado", code: "SLOT_BLOQUEADO" },
        409,
      );
    }
    if ((slotInfo as any).data < dataMinimaAgendavel()) {
      return c.json(
        {
          ok: false,
          error: `Agendamentos só a partir de ${dataMinimaAgendavel()}`,
          code: "FORA_DA_JANELA",
        },
        400,
      );
    }

    // 3) UPDATE atômico — só vence quem encontrar a vaga ainda livre
    const { data: reservaResult, error: errReserva } = await supabase
      .from("entrega_slot")
      .update({
        reserva_cliente_id: cliente.id,
        reservado_em: new Date().toISOString(),
      })
      .eq("id", slotId)
      .is("reserva_cliente_id", null)
      .eq("bloqueado", false)
      .select("id, data, hora_inicio, hora_fim, reservado_em")
      .maybeSingle();

    if (errReserva) {
      // Pode ser violação do partial unique index (cliente já tem outra reserva)
      const msg = String(errReserva.message ?? "");
      if (msg.includes("idx_entrega_slot_um_por_cliente")) {
        return c.json(
          {
            ok: false,
            error: "Cliente já possui uma reserva ativa",
            code: "JA_RESERVADO",
          },
          409,
        );
      }
      throw errReserva;
    }

    if (!reservaResult) {
      return c.json(
        {
          ok: false,
          error: "Slot não está mais disponível",
          code: "SLOT_INDISPONIVEL",
        },
        409,
      );
    }

    // 4) Atualiza agendado_em no cliente (denormalizado, facilita queries)
    await supabase
      .from("clientes_entrega_santorini")
      .update({ agendado_em: new Date().toISOString() })
      .eq("id", cliente.id);

    return c.json({
      ok: true,
      reserva: {
        slot_id: (reservaResult as any).id,
        data: (reservaResult as any).data,
        hora_inicio: (reservaResult as any).hora_inicio,
        hora_fim: (reservaResult as any).hora_fim,
        reservado_em: (reservaResult as any).reservado_em,
      },
      cliente: {
        id: cliente.id,
        nome: cliente.cliente,
        bloco: cliente.bloco,
        unidade: cliente.unidade,
      },
    });
  } catch (err) {
    console.error("❌ /entregas/reservar:", err);
    return c.json({ ok: false, error: "Erro interno ao reservar" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/confirmar  { cpf }
// Gera checkin_token no slot reservado → confirma o agendamento
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/confirmar", async (c) => {
  try {
    const body = await c.req.json();
    const cpf = onlyDigits(body?.cpf);
    if (cpf.length !== 11) {
      return c.json({ ok: false, error: "CPF inválido" }, 400);
    }

    const supabase = getSupabase();

    // Resolve cliente
    const { data: clientes, error: errCli } = await supabase
      .from("clientes_entrega_santorini")
      .select("id, cpf_cnpj");
    if (errCli) throw errCli;

    const cliente = (clientes ?? []).find(
      (c: any) => onlyDigits(c.cpf_cnpj) === cpf,
    );
    if (!cliente) {
      return c.json({ ok: false, error: "CPF não encontrado" }, 404);
    }

    // Busca slot reservado pelo cliente (sem checkin_token ainda)
    const { data: slot, error: errSlot } = await supabase
      .from("entrega_slot")
      .select("id, data, hora_inicio, hora_fim, checkin_token")
      .eq("reserva_cliente_id", cliente.id)
      .maybeSingle();
    if (errSlot) throw errSlot;

    if (!slot) {
      return c.json(
        { ok: false, error: "Nenhuma reserva ativa encontrada", code: "SEM_RESERVA" },
        404,
      );
    }

    // Se já tem token, retorna o existente (idempotente)
    if ((slot as any).checkin_token) {
      return c.json({
        ok: true,
        checkin_token: (slot as any).checkin_token,
        reserva: {
          slot_id: (slot as any).id,
          data: (slot as any).data,
          hora_inicio: (slot as any).hora_inicio,
          hora_fim: (slot as any).hora_fim,
        },
      });
    }

    // Gera o token
    const { data: updated, error: errUp } = await supabase
      .from("entrega_slot")
      .update({ checkin_token: crypto.randomUUID() })
      .eq("id", (slot as any).id)
      .select("id, data, hora_inicio, hora_fim, checkin_token")
      .maybeSingle();
    if (errUp) throw errUp;

    // Atualiza agendado_em no cliente (denormalizado)
    await supabase
      .from("clientes_entrega_santorini")
      .update({ agendado_em: new Date().toISOString() })
      .eq("id", cliente.id);

    return c.json({
      ok: true,
      checkin_token: (updated as any).checkin_token,
      reserva: {
        slot_id: (updated as any).id,
        data: (updated as any).data,
        hora_inicio: (updated as any).hora_inicio,
        hora_fim: (updated as any).hora_fim,
      },
    });
  } catch (err) {
    console.error("❌ /entregas/confirmar:", err);
    return c.json({ ok: false, error: "Erro ao confirmar agendamento" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/cancelar  { cpf }
// Libera o slot do cliente
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/cancelar", async (c) => {
  try {
    const body = await c.req.json();
    const cpf = onlyDigits(body?.cpf);
    if (cpf.length !== 11) {
      return c.json({ ok: false, error: "CPF inválido" }, 400);
    }

    const supabase = getSupabase();

    const { data: clientes, error: errCli } = await supabase
      .from("clientes_entrega_santorini")
      .select("id, cpf_cnpj");
    if (errCli) throw errCli;

    const cliente = (clientes ?? []).find(
      (c: any) => onlyDigits(c.cpf_cnpj) === cpf,
    );
    if (!cliente) {
      return c.json({ ok: false, error: "CPF não encontrado" }, 404);
    }

    const { data: liberados, error } = await supabase
      .from("entrega_slot")
      .update({ reserva_cliente_id: null, reservado_em: null })
      .eq("reserva_cliente_id", cliente.id)
      .select("id");
    if (error) throw error;

    await supabase
      .from("clientes_entrega_santorini")
      .update({ agendado_em: null })
      .eq("id", cliente.id);

    return c.json({ ok: true, liberados: liberados?.length ?? 0 });
  } catch (err) {
    console.error("❌ /entregas/cancelar:", err);
    return c.json({ ok: false, error: "Erro ao cancelar" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/remarcar  { cpf, slot_id }
// Cancela a reserva atual e tenta o novo slot atomicamente.
// (Não é uma transação real porque o supabase-js não expõe BEGIN/COMMIT,
//  mas o partial unique index garante que mesmo no race o cliente
//  nunca terá 2 reservas simultaneamente.)
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/remarcar", async (c) => {
  try {
    const body = await c.req.json();
    const cpf = onlyDigits(body?.cpf);
    const slotId = String(body?.slot_id ?? "");

    if (cpf.length !== 11 || !slotId) {
      return c.json({ ok: false, error: "Parâmetros inválidos" }, 400);
    }

    const supabase = getSupabase();

    // Resolve cliente
    const { data: clientes, error: errCli } = await supabase
      .from("clientes_entrega_santorini")
      .select("id, cpf_cnpj");
    if (errCli) throw errCli;

    const cliente = (clientes ?? []).find(
      (c: any) => onlyDigits(c.cpf_cnpj) === cpf,
    );
    if (!cliente) {
      return c.json({ ok: false, error: "CPF não encontrado" }, 404);
    }

    // Salva o slot atual pra rollback
    const { data: slotAtual } = await supabase
      .from("entrega_slot")
      .select("id")
      .eq("reserva_cliente_id", cliente.id)
      .maybeSingle();

    // Libera o slot atual
    if (slotAtual) {
      await supabase
        .from("entrega_slot")
        .update({ reserva_cliente_id: null, reservado_em: null })
        .eq("id", (slotAtual as any).id);
    }

    // Tenta reservar o novo
    const { data: novaReserva, error: errReserva } = await supabase
      .from("entrega_slot")
      .update({
        reserva_cliente_id: cliente.id,
        reservado_em: new Date().toISOString(),
      })
      .eq("id", slotId)
      .is("reserva_cliente_id", null)
      .eq("bloqueado", false)
      .select("id, data, hora_inicio, hora_fim, reservado_em")
      .maybeSingle();

    if (errReserva || !novaReserva) {
      // Rollback: tenta restaurar o slot anterior
      if (slotAtual) {
        await supabase
          .from("entrega_slot")
          .update({
            reserva_cliente_id: cliente.id,
            reservado_em: new Date().toISOString(),
          })
          .eq("id", (slotAtual as any).id)
          .is("reserva_cliente_id", null);
      }
      return c.json(
        {
          ok: false,
          error: "Não foi possível reservar o novo horário",
          code: "SLOT_INDISPONIVEL",
        },
        409,
      );
    }

    return c.json({ ok: true, reserva: novaReserva });
  } catch (err) {
    console.error("❌ /entregas/remarcar:", err);
    return c.json({ ok: false, error: "Erro ao remarcar" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🏠 ENTREGA DE CHAVES — Fase 2: Recebimento (vistoria + docs)
// ═══════════════════════════════════════════════════════════════════

const BUCKET_RECEBIMENTO = "entrega-recebimento";
let _recBucketChecked = false;

async function ensureRecBucket() {
  if (_recBucketChecked) return;
  const supabase = getSupabase();
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b: any) => b.name === BUCKET_RECEBIMENTO)) {
      await supabase.storage.createBucket(BUCKET_RECEBIMENTO, { public: false });
    }
    _recBucketChecked = true;
  } catch (err) {
    console.error("❌ Bucket recebimento:", err);
  }
}

const CHECKLIST_VISTORIA = [
  { key: "pintura_paredes", label: "Pintura das paredes" },
  { key: "piso_ceramica", label: "Piso cerâmico" },
  { key: "portas", label: "Portas" },
  { key: "janelas", label: "Janelas" },
  { key: "fechaduras", label: "Fechaduras" },
  { key: "tomadas_interruptores", label: "Tomadas e interruptores" },
  { key: "instalacao_eletrica", label: "Instalação elétrica" },
  { key: "instalacao_hidraulica", label: "Instalação hidráulica" },
  { key: "loucas_metais", label: "Louças e metais" },
  { key: "bancadas", label: "Bancadas" },
  { key: "forro_gesso", label: "Forro de gesso" },
  { key: "rejunte", label: "Rejunte" },
];

// ───────────────────────────────────────────────────────────────────
// GET /entregas/checkin/:token
// Busca dados do slot+cliente pelo checkin_token
// ───────────────────────────────────────────────────────────────────
entregasRoutes.get("/entregas/checkin/:token", async (c) => {
  try {
    const token = c.req.param("token");
    if (!token) return c.json({ ok: false, error: "Token inválido" }, 400);

    const supabase = getSupabase();
    const { data: slot, error } = await supabase
      .from("entrega_slot")
      .select(
        `id, data, hora_inicio, hora_fim, checkin_token, reserva_cliente_id,
         clientes_entrega_santorini!entrega_slot_reserva_cliente_id_fkey (
           id, cliente, bloco, unidade, cpf_cnpj, telefone, email, reserva
         )`,
      )
      .eq("checkin_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!slot) return c.json({ ok: false, error: "Token não encontrado" }, 404);

    const cli = (slot as any).clientes_entrega_santorini;

    // Verifica se já existe vistoria para este slot
    const { data: vistoria } = await supabase
      .from("vistoria_entrega")
      .select("id, status")
      .eq("entrega_slot_id", slot.id)
      .maybeSingle();

    return c.json({
      ok: true,
      slot: {
        id: slot.id,
        data: slot.data,
        hora_inicio: slot.hora_inicio,
        hora_fim: slot.hora_fim,
      },
      cliente: {
        id: cli?.id,
        nome: cli?.cliente,
        bloco: cli?.bloco,
        unidade: cli?.unidade,
        cpf: cli?.cpf_cnpj,
        telefone: cli?.telefone,
        email: cli?.email,
        reserva: cli?.reserva,
      },
      vistoria: vistoria ?? null,
    });
  } catch (err) {
    console.error("❌ /entregas/checkin:", err);
    return c.json({ ok: false, error: "Erro no check-in" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/criar
// Cria registro de vistoria + itens do checklist
// Body: { slot_id, tipo_representante? }
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/criar", async (c) => {
  try {
    const body = await c.req.json();
    const slotId = String(body?.slot_id ?? "");
    const tipo = body?.tipo_representante ?? "cliente";

    if (!slotId) return c.json({ ok: false, error: "slot_id obrigatório" }, 400);

    const supabase = getSupabase();

    // Busca slot e cliente
    const { data: slot, error: errSlot } = await supabase
      .from("entrega_slot")
      .select("id, reserva_cliente_id, checkin_token")
      .eq("id", slotId)
      .maybeSingle();

    if (errSlot) throw errSlot;
    if (!slot) return c.json({ ok: false, error: "Slot não encontrado" }, 404);
    if (!slot.reserva_cliente_id)
      return c.json({ ok: false, error: "Slot sem reserva" }, 400);

    // Verifica se já existe vistoria
    const { data: existente } = await supabase
      .from("vistoria_entrega")
      .select("id, status")
      .eq("entrega_slot_id", slotId)
      .maybeSingle();

    if (existente) {
      return c.json({ ok: true, vistoria: existente, ja_existia: true });
    }

    // Cria vistoria
    const { data: vistoria, error: errVis } = await supabase
      .from("vistoria_entrega")
      .insert({
        entrega_slot_id: slotId,
        cliente_id: slot.reserva_cliente_id,
        tipo_representante: tipo,
        status: "aguardando_docs",
      })
      .select("id, status")
      .single();

    if (errVis) throw errVis;

    // Cria itens do checklist
    const itens = CHECKLIST_VISTORIA.map((item) => ({
      vistoria_id: vistoria.id,
      item_key: item.key,
      item_label: item.label,
    }));

    const { error: errItens } = await supabase
      .from("vistoria_entrega_item")
      .insert(itens);

    if (errItens) throw errItens;

    return c.json({ ok: true, vistoria, ja_existia: false });
  } catch (err) {
    console.error("❌ /entregas/vistoria/criar:", err);
    return c.json({ ok: false, error: "Erro ao criar vistoria" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/:id/upload-doc
// Upload de documento de identificação (base64 → Storage)
// Body: { tipo: 'identidade'|'procuracao'|'proprietario', base64 }
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/:id/upload-doc", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const body = await c.req.json();
    const tipo = body?.tipo as string;
    const base64 = body?.base64 as string;

    if (!tipo || !base64)
      return c.json({ ok: false, error: "tipo e base64 obrigatórios" }, 400);

    const tiposValidos = ["identidade", "procuracao", "proprietario"];
    if (!tiposValidos.includes(tipo))
      return c.json({ ok: false, error: "Tipo inválido" }, 400);

    const supabase = getSupabase();
    await ensureRecBucket();

    // Decode base64
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const bytes = Uint8Array.from(atob(raw), (ch) => ch.charCodeAt(0));

    const ext = base64.startsWith("data:image/png") ? "png" : "jpg";
    const path = `${vistoriaId}/docs/${tipo}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET_RECEBIMENTO)
      .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });

    if (upErr) throw upErr;

    // Atualiza coluna correspondente
    const coluna =
      tipo === "identidade"
        ? "doc_identidade_path"
        : tipo === "procuracao"
          ? "doc_procuracao_path"
          : "doc_proprietario_path";

    const { error: updErr } = await supabase
      .from("vistoria_entrega")
      .update({ [coluna]: path, updated_at: new Date().toISOString() })
      .eq("id", vistoriaId);

    if (updErr) throw updErr;

    // Gera URL assinada
    const { data: signed } = await supabase.storage
      .from(BUCKET_RECEBIMENTO)
      .createSignedUrl(path, 365 * 24 * 60 * 60);

    return c.json({ ok: true, path, url: signed?.signedUrl });
  } catch (err) {
    console.error("❌ /entregas/vistoria/upload-doc:", err);
    return c.json({ ok: false, error: "Erro ao fazer upload" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/:id/validar-docs
// Marca documentos como validados e muda status
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/:id/validar-docs", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const supabase = getSupabase();

    const { data: vis, error: errVis } = await supabase
      .from("vistoria_entrega")
      .select("id, tipo_representante, doc_identidade_path, doc_procuracao_path, doc_proprietario_path")
      .eq("id", vistoriaId)
      .maybeSingle();

    if (errVis) throw errVis;
    if (!vis) return c.json({ ok: false, error: "Vistoria não encontrada" }, 404);

    // Valida se os docs obrigatórios foram enviados
    if (!vis.doc_identidade_path)
      return c.json({ ok: false, error: "Documento de identidade não enviado" }, 400);

    if (vis.tipo_representante === "terceiro") {
      if (!vis.doc_procuracao_path)
        return c.json({ ok: false, error: "Procuração não enviada" }, 400);
      if (!vis.doc_proprietario_path)
        return c.json({ ok: false, error: "Doc. do proprietário não enviado" }, 400);
    }

    const { error } = await supabase
      .from("vistoria_entrega")
      .update({
        docs_validados_em: new Date().toISOString(),
        status: "docs_validados",
        updated_at: new Date().toISOString(),
      })
      .eq("id", vistoriaId);

    if (error) throw error;
    return c.json({ ok: true });
  } catch (err) {
    console.error("❌ /entregas/vistoria/validar-docs:", err);
    return c.json({ ok: false, error: "Erro ao validar docs" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// GET /entregas/vistoria/:id
// Retorna vistoria completa com itens e URLs dos docs
// ───────────────────────────────────────────────────────────────────
entregasRoutes.get("/entregas/vistoria/:id", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const supabase = getSupabase();

    const { data: vis, error: errVis } = await supabase
      .from("vistoria_entrega")
      .select(
        `*, clientes_entrega_santorini!vistoria_entrega_cliente_id_fkey (
           cliente, bloco, unidade, cpf_cnpj, telefone, email
         ),
         entrega_slot!vistoria_entrega_entrega_slot_id_fkey (
           data, hora_inicio, hora_fim
         )`,
      )
      .eq("id", vistoriaId)
      .maybeSingle();

    if (errVis) throw errVis;
    if (!vis) return c.json({ ok: false, error: "Vistoria não encontrada" }, 404);

    // Busca itens
    const { data: itens, error: errItens } = await supabase
      .from("vistoria_entrega_item")
      .select("*")
      .eq("vistoria_id", vistoriaId)
      .order("item_key", { ascending: true });

    if (errItens) throw errItens;

    // Gera URLs assinadas para docs e fotos
    const signUrl = async (path: string | null) => {
      if (!path) return null;
      const { data } = await supabase.storage
        .from(BUCKET_RECEBIMENTO)
        .createSignedUrl(path, 24 * 60 * 60); // 24h
      return data?.signedUrl ?? null;
    };

    const docUrls = {
      identidade: await signUrl(vis.doc_identidade_path),
      procuracao: await signUrl(vis.doc_procuracao_path),
      proprietario: await signUrl(vis.doc_proprietario_path),
    };

    const itensComUrl = await Promise.all(
      (itens ?? []).map(async (item: any) => ({
        ...item,
        foto_url: await signUrl(item.foto_path),
      })),
    );

    const cli = (vis as any).clientes_entrega_santorini;
    const slot = (vis as any).entrega_slot;

    return c.json({
      ok: true,
      vistoria: {
        id: vis.id,
        status: vis.status,
        tipo_representante: vis.tipo_representante,
        docs_validados_em: vis.docs_validados_em,
        iniciada_em: vis.iniciada_em,
        concluida_em: vis.concluida_em,
      },
      cliente: {
        nome: cli?.cliente,
        bloco: cli?.bloco,
        unidade: cli?.unidade,
        cpf: cli?.cpf_cnpj,
        telefone: cli?.telefone,
        email: cli?.email,
      },
      slot: {
        data: slot?.data,
        hora_inicio: slot?.hora_inicio,
        hora_fim: slot?.hora_fim,
      },
      docs: docUrls,
      itens: itensComUrl,
    });
  } catch (err) {
    console.error("❌ GET /entregas/vistoria:", err);
    return c.json({ ok: false, error: "Erro ao buscar vistoria" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/:id/iniciar
// Muda status para vistoria_em_andamento
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/:id/iniciar", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const supabase = getSupabase();

    const { error } = await supabase
      .from("vistoria_entrega")
      .update({
        status: "vistoria_em_andamento",
        iniciada_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", vistoriaId)
      .eq("status", "docs_validados");

    if (error) throw error;
    return c.json({ ok: true });
  } catch (err) {
    console.error("❌ /entregas/vistoria/iniciar:", err);
    return c.json({ ok: false, error: "Erro ao iniciar vistoria" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/:id/item
// Atualiza item do checklist (aceito, observação, foto)
// Body: { item_key, aceito, observacao?, foto_base64? }
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/:id/item", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const body = await c.req.json();
    const itemKey = body?.item_key as string;
    const aceito = body?.aceito as boolean | undefined;
    const observacao = body?.observacao as string | undefined;
    const fotoBase64 = body?.foto_base64 as string | undefined;

    if (!itemKey)
      return c.json({ ok: false, error: "item_key obrigatório" }, 400);

    const supabase = getSupabase();

    // Upload da foto se enviada
    let fotoPath: string | undefined;
    if (fotoBase64) {
      await ensureRecBucket();
      const raw = fotoBase64.includes(",") ? fotoBase64.split(",")[1] : fotoBase64;
      const bytes = Uint8Array.from(atob(raw), (ch) => ch.charCodeAt(0));
      const ext = fotoBase64.startsWith("data:image/png") ? "png" : "jpg";
      fotoPath = `${vistoriaId}/itens/${itemKey}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET_RECEBIMENTO)
        .upload(fotoPath, bytes, { contentType: `image/${ext}`, upsert: true });

      if (upErr) throw upErr;
    }

    // Monta update
    const update: Record<string, any> = {
      atualizado_em: new Date().toISOString(),
    };
    if (aceito !== undefined) update.aceito = aceito;
    if (observacao !== undefined) update.observacao = observacao;
    if (fotoPath) update.foto_path = fotoPath;

    const { data, error } = await supabase
      .from("vistoria_entrega_item")
      .update(update)
      .eq("vistoria_id", vistoriaId)
      .eq("item_key", itemKey)
      .select("id, item_key, aceito, observacao, foto_path")
      .maybeSingle();

    if (error) throw error;
    if (!data)
      return c.json({ ok: false, error: "Item não encontrado" }, 404);

    // Gera URL assinada da foto
    let fotoUrl = null;
    if (data.foto_path) {
      const { data: signed } = await supabase.storage
        .from(BUCKET_RECEBIMENTO)
        .createSignedUrl(data.foto_path, 24 * 60 * 60);
      fotoUrl = signed?.signedUrl ?? null;
    }

    return c.json({ ok: true, item: { ...data, foto_url: fotoUrl } });
  } catch (err) {
    console.error("❌ /entregas/vistoria/item:", err);
    return c.json({ ok: false, error: "Erro ao atualizar item" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/:id/concluir
// Finaliza a vistoria (valida que todos os itens têm status + foto)
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/:id/concluir", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const supabase = getSupabase();

    // Valida se todos os itens estão preenchidos
    const { data: itens, error: errItens } = await supabase
      .from("vistoria_entrega_item")
      .select("item_key, aceito, foto_path")
      .eq("vistoria_id", vistoriaId);

    if (errItens) throw errItens;

    const pendentes = (itens ?? []).filter(
      (i: any) => i.aceito === null || !i.foto_path,
    );

    if (pendentes.length > 0) {
      return c.json({
        ok: false,
        error: `${pendentes.length} item(ns) pendente(s)`,
        pendentes: pendentes.map((i: any) => i.item_key),
      }, 400);
    }

    const { error } = await supabase
      .from("vistoria_entrega")
      .update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", vistoriaId);

    if (error) throw error;
    return c.json({ ok: true });
  } catch (err) {
    console.error("❌ /entregas/vistoria/concluir:", err);
    return c.json({ ok: false, error: "Erro ao concluir vistoria" }, 500);
  }
});
