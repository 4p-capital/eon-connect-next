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
