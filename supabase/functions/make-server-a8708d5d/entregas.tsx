import { Hono } from "npm:hono@4";
import { createClient } from "npm:@supabase/supabase-js@2";

export const entregasRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// 🔑 ENTREGA DE CHAVES
//
// Fluxo completo:
//   Agendamento (público, por CPF):
//     validar-cpf → disponibilidade → reservar → confirmar (gera QR)
//   Recebimento (engenheiro logado):
//     /entregas/checkin/:token   → identifica cliente
//     /entregas/vistoria/criar   → cria/recupera vistoria (status=aguardando_docs)
//     /entregas/vistoria/:id/upload-doc + validar-docs
//     /entregas/vistoria/:id/iniciar (requer status=docs_validados)
//     /entregas/vistoria/:id/item (upload checklist item)
//     /entregas/vistoria/:id/finalizar (parecer: apto|nao_apto)
//   Assinatura (cliente, mesmo QR):
//     /entregas/assinar/:token   → valida status=finalizada_apto
//     /entregas/assinar/:token/confirmar → grava assinatura, queima token
//
// Máquina de estados (vistoria_entrega.status):
//   aguardando_docs → docs_validados → vistoria_em_andamento
//     → finalizada_apto  → termo_assinado
//     → finalizada_nao_apto (terminal)
//
// Regra de segurança:
//   Cada transição é validada no backend via .eq("status", ESPERADO).
//   Assinatura só permitida se status = finalizada_apto.
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

// ═══════════════════════════════════════════════════════════════════
// Fase 1: Agendamento (rotas públicas)
// ═══════════════════════════════════════════════════════════════════

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

    const { data: clientes, error } = await supabase
      .from("clientes_entrega_santorini")
      .select(
        "id, cliente, cpf_cnpj, bloco, unidade, telefone, email, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, pendencia_reras, pendencia_rescisao_contrato, agendado_em",
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
      reras: cliente.pendencia_reras === true,
      rescisao_contrato: cliente.pendencia_rescisao_contrato === true,
    };

    // Gate de agendamento: bloqueia se qualquer pendência estiver ativa.
    const temPendencia =
      pendencias.agehab ||
      pendencias.pro_soluto ||
      pendencias.juros_obra ||
      pendencias.reras ||
      pendencias.rescisao_contrato;

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

entregasRoutes.get("/entregas/disponibilidade", async (c) => {
  try {
    const desdeParam = c.req.query("desde");
    const ateParam = c.req.query("ate");

    const desde = desdeParam ?? dataMinimaAgendavel();
    const ate =
      ateParam ??
      (() => {
        const d = new Date(desde + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 90);
        return d.toISOString().slice(0, 10);
      })();

    const supabase = getSupabase();

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

    const { data: clientes, error: errCli } = await supabase
      .from("clientes_entrega_santorini")
      .select(
        "id, cliente, bloco, unidade, telefone, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, pendencia_reras, pendencia_rescisao_contrato, cpf_cnpj",
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

    // Gate de reserva: bloqueia se qualquer pendência estiver ativa.
    if (
      cliente.pendencia_agehab ||
      cliente.pendencia_prosoluto ||
      cliente.pendencia_jurosobra ||
      cliente.pendencia_reras ||
      cliente.pendencia_rescisao_contrato
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

entregasRoutes.post("/entregas/confirmar", async (c) => {
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

    const { data: updated, error: errUp } = await supabase
      .from("entrega_slot")
      .update({ checkin_token: crypto.randomUUID() })
      .eq("id", (slot as any).id)
      .select("id, data, hora_inicio, hora_fim, checkin_token")
      .maybeSingle();
    if (errUp) throw errUp;

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

entregasRoutes.post("/entregas/remarcar", async (c) => {
  try {
    const body = await c.req.json();
    const cpf = onlyDigits(body?.cpf);
    const slotId = String(body?.slot_id ?? "");

    if (cpf.length !== 11 || !slotId) {
      return c.json({ ok: false, error: "Parâmetros inválidos" }, 400);
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

    const { data: slotAtual } = await supabase
      .from("entrega_slot")
      .select("id")
      .eq("reserva_cliente_id", cliente.id)
      .maybeSingle();

    if (slotAtual) {
      await supabase
        .from("entrega_slot")
        .update({ reserva_cliente_id: null, reservado_em: null })
        .eq("id", (slotAtual as any).id);
    }

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
// Fase 2: Recebimento / Vistoria (engenheiro logado)
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

async function decodeBase64Image(base64: string): Promise<{ bytes: Uint8Array; ext: "png" | "jpg" }> {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const bytes = Uint8Array.from(atob(raw), (ch) => ch.charCodeAt(0));
  const ext: "png" | "jpg" = base64.startsWith("data:image/png") ? "png" : "jpg";
  return { bytes, ext };
}

async function signedUrl(path: string | null, ttlSeconds = 24 * 60 * 60): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabase();
  const { data } = await supabase.storage
    .from(BUCKET_RECEBIMENTO)
    .createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}

// ───────────────────────────────────────────────────────────────────
// GET /entregas/checkin/:token
// Engenheiro escaneia QR → identifica slot + cliente + vistoria (se houver)
// Marca token_usado_checkin_em na primeira leitura.
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
         token_usado_checkin_em, token_usado_assinatura_em,
         clientes_entrega_santorini!entrega_slot_reserva_cliente_id_fkey (
           id, cliente, bloco, unidade, cpf_cnpj, telefone, email, reserva,
           pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra,
           pendencia_reras, pendencia_rescisao_contrato
         )`,
      )
      .eq("checkin_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!slot) return c.json({ ok: false, error: "Token não encontrado", code: "TOKEN_INVALIDO" }, 404);

    const cli = (slot as any).clientes_entrega_santorini;

    const { data: vistoria } = await supabase
      .from("vistoria_entrega")
      .select("id, status, parecer_cliente, iniciada_em, finalizada_em, termo_assinado_em")
      .eq("entrega_slot_id", slot.id)
      .maybeSingle();

    // Marca primeira leitura do QR (não sobrescreve)
    if (!(slot as any).token_usado_checkin_em) {
      await supabase
        .from("entrega_slot")
        .update({ token_usado_checkin_em: new Date().toISOString() })
        .eq("id", (slot as any).id)
        .is("token_usado_checkin_em", null);
    }

    return c.json({
      ok: true,
      slot: {
        id: (slot as any).id,
        data: (slot as any).data,
        hora_inicio: (slot as any).hora_inicio,
        hora_fim: (slot as any).hora_fim,
        token_usado_checkin_em: (slot as any).token_usado_checkin_em,
        token_usado_assinatura_em: (slot as any).token_usado_assinatura_em,
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
        pendencias: {
          agehab: cli?.pendencia_agehab === true,
          pro_soluto: cli?.pendencia_prosoluto === true,
          juros_obra: cli?.pendencia_jurosobra === true,
          reras: cli?.pendencia_reras === true,
          rescisao_contrato: cli?.pendencia_rescisao_contrato === true,
        },
      },
      vistoria: vistoria ?? null,
    });
  } catch (err) {
    console.error("❌ /entregas/checkin:", err);
    return c.json({ ok: false, error: "Erro no check-in" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// GET /entregas/recebimento/lista
// Lista todas as vistorias (em andamento + finalizadas) do engenheiro
// ───────────────────────────────────────────────────────────────────
entregasRoutes.get("/entregas/recebimento/lista", async (c) => {
  try {
    const supabase = getSupabase();

    // Só lista vistorias que o engenheiro de fato começou — a prova de vida é
    // ter enviado o primeiro doc (identidade, sempre obrigatório). Vistorias
    // "zumbi" em aguardando_docs sem nenhum upload ficam ocultas e são
    // reaproveitadas quando o engenheiro escaneia o QR daquele slot.
    const { data, error } = await supabase
      .from("vistoria_entrega")
      .select(
        `id, status, parecer_cliente, iniciada_em, finalizada_em, termo_assinado_em,
         engenheiro_user_id, doc_identidade_path, created_at, updated_at,
         clientes_entrega_santorini!vistoria_entrega_cliente_id_fkey (
           cliente, bloco, unidade, cpf_cnpj
         ),
         entrega_slot!vistoria_entrega_entrega_slot_id_fkey (
           data, hora_inicio, hora_fim, checkin_token
         ),
         engenheiro:User!vistoria_entrega_engenheiro_user_id_fkey (
           id, nome, email
         )`,
      )
      .or("doc_identidade_path.not.is.null,status.neq.aguardando_docs")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const vistorias = (data ?? []).map((v: any) => ({
      id: v.id,
      status: v.status,
      parecer_cliente: v.parecer_cliente,
      iniciada_em: v.iniciada_em,
      finalizada_em: v.finalizada_em,
      termo_assinado_em: v.termo_assinado_em,
      created_at: v.created_at,
      updated_at: v.updated_at,
      cliente: {
        nome: v.clientes_entrega_santorini?.cliente,
        bloco: v.clientes_entrega_santorini?.bloco,
        unidade: v.clientes_entrega_santorini?.unidade,
        cpf: v.clientes_entrega_santorini?.cpf_cnpj,
      },
      slot: {
        data: v.entrega_slot?.data,
        hora_inicio: v.entrega_slot?.hora_inicio,
        hora_fim: v.entrega_slot?.hora_fim,
        checkin_token: v.entrega_slot?.checkin_token,
      },
      engenheiro: v.engenheiro
        ? {
            id: v.engenheiro.id,
            nome: v.engenheiro.nome?.trim() || null,
            email: v.engenheiro.email,
          }
        : null,
    }));

    return c.json({ ok: true, vistorias });
  } catch (err) {
    console.error("❌ /entregas/recebimento/lista:", err);
    return c.json({ ok: false, error: "Erro ao listar vistorias" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/criar
// Cria vistoria (idempotente) + snapshot do catálogo de itens
// Body: { slot_id, tipo_representante?, engenheiro_user_id? }
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/criar", async (c) => {
  try {
    const body = await c.req.json();
    const slotId = String(body?.slot_id ?? "");
    const tipo = body?.tipo_representante ?? "cliente";
    const engenheiroUserId = body?.engenheiro_user_id ?? null;

    if (!slotId) return c.json({ ok: false, error: "slot_id obrigatório" }, 400);

    const supabase = getSupabase();

    const { data: slot, error: errSlot } = await supabase
      .from("entrega_slot")
      .select("id, empreendimento, reserva_cliente_id, checkin_token")
      .eq("id", slotId)
      .maybeSingle();

    if (errSlot) throw errSlot;
    if (!slot) return c.json({ ok: false, error: "Slot não encontrado" }, 404);
    if (!(slot as any).reserva_cliente_id)
      return c.json({ ok: false, error: "Slot sem reserva" }, 400);

    const { data: existente } = await supabase
      .from("vistoria_entrega")
      .select("id, status, engenheiro_user_id")
      .eq("entrega_slot_id", slotId)
      .maybeSingle();

    if (existente) {
      // Backfill: se nunca teve engenheiro, grava o que abriu agora
      if (!(existente as any).engenheiro_user_id && engenheiroUserId) {
        await supabase
          .from("vistoria_entrega")
          .update({ engenheiro_user_id: engenheiroUserId })
          .eq("id", (existente as any).id)
          .is("engenheiro_user_id", null);
      }
      return c.json({ ok: true, vistoria: existente, ja_existia: true });
    }

    const insertPayload: Record<string, any> = {
      entrega_slot_id: slotId,
      cliente_id: (slot as any).reserva_cliente_id,
      tipo_representante: tipo,
      status: "aguardando_docs",
    };
    if (engenheiroUserId) insertPayload.engenheiro_user_id = engenheiroUserId;

    const { data: vistoria, error: errVis } = await supabase
      .from("vistoria_entrega")
      .insert(insertPayload)
      .select("id, status")
      .single();

    if (errVis) throw errVis;

    // Snapshot do catálogo ativo do empreendimento → itens da vistoria
    const empreendimento = (slot as any).empreendimento || EMPREENDIMENTO_PADRAO;
    const { data: templates, error: errTpl } = await supabase
      .from("vistoria_item_template")
      .select("id, categoria, descricao, ordem, foto_obrigatoria")
      .eq("empreendimento", empreendimento)
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (errTpl) throw errTpl;

    if ((templates ?? []).length > 0) {
      const itens = (templates ?? []).map((t: any) => ({
        vistoria_id: (vistoria as any).id,
        template_id: t.id,
        item_key: t.id, // backwards-compat com código legado
        item_label: t.descricao,
        categoria: t.categoria,
        ordem: t.ordem ?? 0,
      }));

      const { error: errItens } = await supabase
        .from("vistoria_entrega_item")
        .insert(itens);

      if (errItens) throw errItens;
    }

    return c.json({ ok: true, vistoria, ja_existia: false });
  } catch (err) {
    console.error("❌ /entregas/vistoria/criar:", err);
    return c.json({ ok: false, error: "Erro ao criar vistoria" }, 500);
  }
});

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

    // Guard: só pode enviar docs se vistoria está em aguardando_docs
    const { data: vistoria } = await supabase
      .from("vistoria_entrega")
      .select("id, status")
      .eq("id", vistoriaId)
      .maybeSingle();

    if (!vistoria)
      return c.json({ ok: false, error: "Vistoria não encontrada" }, 404);

    if ((vistoria as any).status !== "aguardando_docs") {
      return c.json(
        { ok: false, error: "Documentos já foram validados", code: "DOCS_BLOQUEADOS" },
        409,
      );
    }

    await ensureRecBucket();

    const { bytes, ext } = await decodeBase64Image(base64);
    const path = `${vistoriaId}/docs/${tipo}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET_RECEBIMENTO)
      .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });

    if (upErr) throw upErr;

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

    const url = await signedUrl(path, 365 * 24 * 60 * 60);

    return c.json({ ok: true, path, url });
  } catch (err) {
    console.error("❌ /entregas/vistoria/upload-doc:", err);
    return c.json({ ok: false, error: "Erro ao fazer upload" }, 500);
  }
});

entregasRoutes.post("/entregas/vistoria/:id/validar-docs", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const tipoRepresentante = body?.tipo_representante;

    const supabase = getSupabase();

    const { data: vis, error: errVis } = await supabase
      .from("vistoria_entrega")
      .select("id, status, tipo_representante, doc_identidade_path, doc_procuracao_path, doc_proprietario_path")
      .eq("id", vistoriaId)
      .maybeSingle();

    if (errVis) throw errVis;
    if (!vis) return c.json({ ok: false, error: "Vistoria não encontrada" }, 404);

    // Guard: só valida se está no estado certo
    if ((vis as any).status !== "aguardando_docs") {
      return c.json(
        { ok: false, error: "Documentos já foram validados", code: "ESTADO_INVALIDO" },
        409,
      );
    }

    const tipoFinal = tipoRepresentante || (vis as any).tipo_representante || "cliente";

    if (!(vis as any).doc_identidade_path)
      return c.json({ ok: false, error: "Documento de identidade não enviado" }, 400);

    if (tipoFinal === "terceiro") {
      if (!(vis as any).doc_procuracao_path)
        return c.json({ ok: false, error: "Procuração não enviada" }, 400);
      if (!(vis as any).doc_proprietario_path)
        return c.json({ ok: false, error: "Doc. do proprietário não enviado" }, 400);
    }

    const { error } = await supabase
      .from("vistoria_entrega")
      .update({
        docs_validados_em: new Date().toISOString(),
        tipo_representante: tipoFinal,
        status: "docs_validados",
        updated_at: new Date().toISOString(),
      })
      .eq("id", vistoriaId)
      .eq("status", "aguardando_docs");

    if (error) throw error;
    return c.json({ ok: true });
  } catch (err) {
    console.error("❌ /entregas/vistoria/validar-docs:", err);
    return c.json({ ok: false, error: "Erro ao validar docs" }, 500);
  }
});

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
           id, data, hora_inicio, hora_fim, checkin_token,
           token_usado_checkin_em, token_usado_assinatura_em
         ),
         engenheiro:User!vistoria_entrega_engenheiro_user_id_fkey (
           id, nome, email
         )`,
      )
      .eq("id", vistoriaId)
      .maybeSingle();

    if (errVis) throw errVis;
    if (!vis) return c.json({ ok: false, error: "Vistoria não encontrada" }, 404);

    const { data: itens, error: errItens } = await supabase
      .from("vistoria_entrega_item")
      .select("*")
      .eq("vistoria_id", vistoriaId)
      .order("ordem", { ascending: true })
      .order("item_label", { ascending: true });

    if (errItens) throw errItens;

    const docUrls = {
      identidade: await signedUrl((vis as any).doc_identidade_path),
      procuracao: await signedUrl((vis as any).doc_procuracao_path),
      proprietario: await signedUrl((vis as any).doc_proprietario_path),
    };

    const itensComUrl = await Promise.all(
      (itens ?? []).map(async (item: any) => ({
        ...item,
        foto_url: await signedUrl(item.foto_path),
      })),
    );

    const cli = (vis as any).clientes_entrega_santorini;
    const slot = (vis as any).entrega_slot;

    return c.json({
      ok: true,
      vistoria: {
        id: (vis as any).id,
        status: (vis as any).status,
        tipo_representante: (vis as any).tipo_representante,
        docs_validados_em: (vis as any).docs_validados_em,
        iniciada_em: (vis as any).iniciada_em,
        concluida_em: (vis as any).concluida_em,
        finalizada_em: (vis as any).finalizada_em,
        parecer_cliente: (vis as any).parecer_cliente,
        observacoes_gerais: (vis as any).observacoes_gerais,
        termo_assinado_em: (vis as any).termo_assinado_em,
        engenheiro_user_id: (vis as any).engenheiro_user_id,
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
        id: slot?.id,
        data: slot?.data,
        hora_inicio: slot?.hora_inicio,
        hora_fim: slot?.hora_fim,
        checkin_token: slot?.checkin_token,
        token_usado_checkin_em: slot?.token_usado_checkin_em,
        token_usado_assinatura_em: slot?.token_usado_assinatura_em,
      },
      engenheiro: (vis as any).engenheiro
        ? {
            id: (vis as any).engenheiro.id,
            nome: (vis as any).engenheiro.nome?.trim() || null,
            email: (vis as any).engenheiro.email,
          }
        : null,
      docs: docUrls,
      itens: itensComUrl,
    });
  } catch (err) {
    console.error("❌ GET /entregas/vistoria:", err);
    return c.json({ ok: false, error: "Erro ao buscar vistoria" }, 500);
  }
});

entregasRoutes.post("/entregas/vistoria/:id/iniciar", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const supabase = getSupabase();

    // Guard: só inicia se docs validados (máquina de estados)
    const { data, error } = await supabase
      .from("vistoria_entrega")
      .update({
        status: "vistoria_em_andamento",
        iniciada_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", vistoriaId)
      .eq("status", "docs_validados")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return c.json(
        {
          ok: false,
          error: "Vistoria não está pronta para iniciar (documentos não validados)",
          code: "ESTADO_INVALIDO",
        },
        409,
      );
    }
    return c.json({ ok: true });
  } catch (err) {
    console.error("❌ /entregas/vistoria/iniciar:", err);
    return c.json({ ok: false, error: "Erro ao iniciar vistoria" }, 500);
  }
});

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

    // Guard: só edita itens se vistoria está em andamento
    const { data: vistoria } = await supabase
      .from("vistoria_entrega")
      .select("status")
      .eq("id", vistoriaId)
      .maybeSingle();

    if (!vistoria)
      return c.json({ ok: false, error: "Vistoria não encontrada" }, 404);

    const statusOk = (vistoria as any).status === "vistoria_em_andamento" ||
                     (vistoria as any).status === "docs_validados";
    if (!statusOk) {
      return c.json(
        { ok: false, error: "Vistoria não está em andamento", code: "ESTADO_INVALIDO" },
        409,
      );
    }

    let fotoPath: string | undefined;
    if (fotoBase64) {
      await ensureRecBucket();
      const { bytes, ext } = await decodeBase64Image(fotoBase64);
      fotoPath = `${vistoriaId}/itens/${itemKey}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET_RECEBIMENTO)
        .upload(fotoPath, bytes, { contentType: `image/${ext}`, upsert: true });

      if (upErr) throw upErr;
    }

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

    const fotoUrl = await signedUrl((data as any).foto_path);

    return c.json({ ok: true, item: { ...data, foto_url: fotoUrl } });
  } catch (err) {
    console.error("❌ /entregas/vistoria/item:", err);
    return c.json({ ok: false, error: "Erro ao atualizar item" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/vistoria/:id/finalizar
// Finaliza com parecer do cliente (apto | nao_apto).
// Body: { parecer_cliente: 'apto' | 'nao_apto', observacoes_gerais?: string }
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/vistoria/:id/finalizar", async (c) => {
  try {
    const vistoriaId = c.req.param("id");
    const body = await c.req.json();
    const parecer = body?.parecer_cliente as string;
    const observacoes = body?.observacoes_gerais as string | undefined;

    if (parecer !== "apto" && parecer !== "nao_apto") {
      return c.json(
        { ok: false, error: "parecer_cliente inválido (apto|nao_apto)" },
        400,
      );
    }

    const supabase = getSupabase();

    // Valida que todos os itens têm status + foto
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
        error: `${pendentes.length} item(ns) pendente(s) — preencha status e foto`,
        pendentes: pendentes.map((i: any) => i.item_key),
      }, 400);
    }

    const novoStatus = parecer === "apto" ? "finalizada_apto" : "finalizada_nao_apto";

    const { data, error } = await supabase
      .from("vistoria_entrega")
      .update({
        status: novoStatus,
        parecer_cliente: parecer,
        observacoes_gerais: observacoes ?? null,
        finalizada_em: new Date().toISOString(),
        concluida_em: new Date().toISOString(), // backwards-compat
        updated_at: new Date().toISOString(),
      })
      .eq("id", vistoriaId)
      .eq("status", "vistoria_em_andamento")
      .select("id, status, parecer_cliente")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return c.json(
        {
          ok: false,
          error: "Vistoria não pode ser finalizada nesse estado",
          code: "ESTADO_INVALIDO",
        },
        409,
      );
    }

    return c.json({ ok: true, vistoria: data });
  } catch (err) {
    console.error("❌ /entregas/vistoria/finalizar:", err);
    return c.json({ ok: false, error: "Erro ao finalizar vistoria" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Fase 3: Assinatura (cliente, mesmo QR do check-in)
// ═══════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────
// GET /entregas/assinar/:token
// Cliente escaneia o MESMO QR para assinar o termo.
// Retorna contexto + habilita/bloqueia assinatura com base no status da vistoria.
// ───────────────────────────────────────────────────────────────────
entregasRoutes.get("/entregas/assinar/:token", async (c) => {
  try {
    const token = c.req.param("token");
    if (!token) return c.json({ ok: false, error: "Token inválido" }, 400);

    const supabase = getSupabase();

    const { data: slot, error } = await supabase
      .from("entrega_slot")
      .select(
        `id, data, hora_inicio, hora_fim,
         token_usado_checkin_em, token_usado_assinatura_em,
         clientes_entrega_santorini!entrega_slot_reserva_cliente_id_fkey (
           cliente, bloco, unidade, cpf_cnpj
         )`,
      )
      .eq("checkin_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!slot) {
      return c.json(
        { ok: false, error: "Código não reconhecido", code: "TOKEN_INVALIDO" },
        404,
      );
    }

    if ((slot as any).token_usado_assinatura_em) {
      return c.json({
        ok: true,
        pode_assinar: false,
        motivo: "JA_ASSINADO",
        mensagem: "Este termo já foi assinado.",
        cliente: {
          nome: (slot as any).clientes_entrega_santorini?.cliente,
          bloco: (slot as any).clientes_entrega_santorini?.bloco,
          unidade: (slot as any).clientes_entrega_santorini?.unidade,
        },
      });
    }

    const { data: vistoria } = await supabase
      .from("vistoria_entrega")
      .select("id, status, parecer_cliente")
      .eq("entrega_slot_id", (slot as any).id)
      .maybeSingle();

    const cli = (slot as any).clientes_entrega_santorini;
    const baseResp = {
      cliente: { nome: cli?.cliente, bloco: cli?.bloco, unidade: cli?.unidade },
      slot: {
        data: (slot as any).data,
        hora_inicio: (slot as any).hora_inicio,
        hora_fim: (slot as any).hora_fim,
      },
      vistoria: vistoria ?? null,
    };

    if (!vistoria) {
      return c.json({
        ok: true,
        pode_assinar: false,
        motivo: "VISTORIA_NAO_INICIADA",
        mensagem: "A vistoria ainda não foi iniciada. Aguarde o engenheiro.",
        ...baseResp,
      });
    }

    if ((vistoria as any).status === "finalizada_nao_apto") {
      return c.json({
        ok: true,
        pode_assinar: false,
        motivo: "NAO_APTO",
        mensagem: "A unidade foi considerada não apta para recebimento.",
        ...baseResp,
      });
    }

    if ((vistoria as any).status !== "finalizada_apto") {
      return c.json({
        ok: true,
        pode_assinar: false,
        motivo: "VISTORIA_EM_ANDAMENTO",
        mensagem: "A vistoria ainda está em andamento.",
        ...baseResp,
      });
    }

    return c.json({
      ok: true,
      pode_assinar: true,
      ...baseResp,
    });
  } catch (err) {
    console.error("❌ /entregas/assinar GET:", err);
    return c.json({ ok: false, error: "Erro ao validar assinatura" }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────
// POST /entregas/assinar/:token/confirmar
// Marca termo como assinado (stub — integração Clicksign virá depois).
// Queima o token (token_usado_assinatura_em).
// Guard de segurança: só permite se vistoria.status = finalizada_apto.
// ───────────────────────────────────────────────────────────────────
entregasRoutes.post("/entregas/assinar/:token/confirmar", async (c) => {
  try {
    const token = c.req.param("token");
    if (!token) return c.json({ ok: false, error: "Token inválido" }, 400);

    const supabase = getSupabase();

    const { data: slot, error: errSlot } = await supabase
      .from("entrega_slot")
      .select("id, token_usado_assinatura_em")
      .eq("checkin_token", token)
      .maybeSingle();

    if (errSlot) throw errSlot;
    if (!slot) return c.json({ ok: false, error: "Token inválido" }, 404);

    if ((slot as any).token_usado_assinatura_em) {
      return c.json(
        { ok: false, error: "Termo já assinado", code: "JA_ASSINADO" },
        409,
      );
    }

    const { data: vistoria } = await supabase
      .from("vistoria_entrega")
      .select("id, status")
      .eq("entrega_slot_id", (slot as any).id)
      .maybeSingle();

    if (!vistoria || (vistoria as any).status !== "finalizada_apto") {
      return c.json(
        {
          ok: false,
          error: "Vistoria não está apta para assinatura",
          code: "NAO_APTO",
        },
        403,
      );
    }

    const agora = new Date().toISOString();

    // Transição atômica: vistoria → termo_assinado só se estava em finalizada_apto
    const { data: updatedVis, error: errVis } = await supabase
      .from("vistoria_entrega")
      .update({
        status: "termo_assinado",
        termo_assinado_em: agora,
        updated_at: agora,
      })
      .eq("id", (vistoria as any).id)
      .eq("status", "finalizada_apto")
      .select("id, status, termo_assinado_em")
      .maybeSingle();

    if (errVis) throw errVis;
    if (!updatedVis) {
      return c.json(
        { ok: false, error: "Estado da vistoria mudou, tente novamente", code: "ESTADO_INVALIDO" },
        409,
      );
    }

    // Queima o token
    const { error: errSlotUp } = await supabase
      .from("entrega_slot")
      .update({ token_usado_assinatura_em: agora })
      .eq("id", (slot as any).id);

    if (errSlotUp) throw errSlotUp;

    return c.json({ ok: true, vistoria: updatedVis });
  } catch (err) {
    console.error("❌ /entregas/assinar POST:", err);
    return c.json({ ok: false, error: "Erro ao confirmar assinatura" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Admin: catálogo de itens (para futura tela de gerenciamento)
// ═══════════════════════════════════════════════════════════════════
entregasRoutes.get("/entregas/catalogo-itens", async (c) => {
  try {
    const empreendimento = c.req.query("empreendimento") ?? EMPREENDIMENTO_PADRAO;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("vistoria_item_template")
      .select("id, categoria, descricao, ordem, foto_obrigatoria, ativo")
      .eq("empreendimento", empreendimento)
      .order("ordem", { ascending: true });

    if (error) throw error;
    return c.json({ ok: true, itens: data ?? [] });
  } catch (err) {
    console.error("❌ /entregas/catalogo-itens:", err);
    return c.json({ ok: false, error: "Erro ao listar catálogo" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// Toggle de pendências por setor (3 setores)
// Mapeamento campo → setor:
//   pendencia_agehab              → AGEHAB     (verificado_agehab_em)
//   pendencia_prosoluto           → Financeiro (verificado_financeiro_em)
//   pendencia_jurosobra           → Financeiro (verificado_financeiro_em)
//   pendencia_reras               → Contratos  (verificado_contratos_em)
//   pendencia_rescisao_contrato   → Contratos  (verificado_contratos_em)
// Valida permissão a partir de User.permissions (auth_user_id).
// ═══════════════════════════════════════════════════════════════════

type Setor = "agehab" | "financeiro" | "contratos";

type PendenciaCampo =
  | "pendencia_agehab"
  | "pendencia_prosoluto"
  | "pendencia_jurosobra"
  | "pendencia_reras";

const CAMPO_SETOR: Record<PendenciaCampo, Setor> = {
  pendencia_agehab: "agehab",
  pendencia_prosoluto: "financeiro",
  pendencia_jurosobra: "financeiro",
  pendencia_reras: "contratos",
};

const SETOR_VERIFICADO_FIELD: Record<
  Setor,
  "verificado_agehab_em" | "verificado_financeiro_em" | "verificado_contratos_em"
> = {
  agehab: "verificado_agehab_em",
  financeiro: "verificado_financeiro_em",
  contratos: "verificado_contratos_em",
};

function podePendencia(permissions: any, setor: Setor): boolean {
  const p = permissions?.entregas?.santorini?.pendencias;
  if (p === true) return false; // Formato legado (boolean) não distingue setor
  if (p && typeof p === "object" && p[setor] === true) return true;
  return false;
}

entregasRoutes.post("/entregas/pendencias/toggle", async (c) => {
  try {
    const body = await c.req.json();
    const clienteId = String(body?.cliente_id ?? "");
    const campo = body?.campo as PendenciaCampo;
    const valor = Boolean(body?.valor);
    const authUserId = String(body?.auth_user_id ?? "");

    if (!clienteId || !authUserId) {
      return c.json({ ok: false, error: "cliente_id e auth_user_id obrigatórios" }, 400);
    }
    if (!(campo in CAMPO_SETOR)) {
      return c.json({ ok: false, error: "Campo inválido" }, 400);
    }

    const supabase = getSupabase();

    // Lookup do usuário pelos Supabase auth UUID → permissions
    const { data: user, error: errUser } = await supabase
      .from("User")
      .select("id, nome, permissions")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (errUser) throw errUser;
    if (!user) {
      return c.json({ ok: false, error: "Usuário não encontrado", code: "USER_NAO_ENCONTRADO" }, 401);
    }

    const setor = CAMPO_SETOR[campo];
    if (!podePendencia((user as any).permissions, setor)) {
      return c.json(
        {
          ok: false,
          error: `Você não tem permissão para alterar este campo (setor ${setor}).`,
          code: "SEM_PERMISSAO",
        },
        403,
      );
    }

    // Qualquer ação (OK ou Pendência) conta como "verificação" pelo setor dono do campo.
    // AGEHAB → verificado_agehab_em; Financeiro → verificado_financeiro_em; Contratos → verificado_contratos_em.
    const verificadoField = SETOR_VERIFICADO_FIELD[setor];
    const agoraISO = new Date().toISOString();

    // Lê valor anterior antes do UPDATE (para o log de auditoria da campanha).
    const { data: anterior } = await supabase
      .from("clientes_entrega_santorini")
      .select(campo)
      .eq("id", clienteId)
      .maybeSingle();
    const valorAnterior =
      anterior && typeof (anterior as any)[campo] === "boolean"
        ? Boolean((anterior as any)[campo])
        : null;

    const { data: atualizado, error: errUp } = await supabase
      .from("clientes_entrega_santorini")
      .update({
        [campo]: valor,
        [verificadoField]: agoraISO,
      })
      .eq("id", clienteId)
      .select(`id, ${campo}, ${verificadoField}`)
      .maybeSingle();

    if (errUp) throw errUp;
    if (!atualizado) {
      return c.json({ ok: false, error: "Cliente não encontrado" }, 404);
    }

    // Carimba o log da campanha. Falha aqui não derruba o toggle.
    const { error: errLog } = await supabase
      .from("pendencias_alteracoes_log")
      .insert({
        cliente_entrega_id: clienteId,
        setor,
        campo,
        valor_anterior: valorAnterior,
        valor_novo: valor,
        origem: "toggle",
        alterado_por_user_id: (user as any).id ? String((user as any).id) : null,
        alterado_por_nome: (user as any).nome?.trim() || null,
        auth_user_id: authUserId,
      });
    if (errLog) {
      console.error("⚠️ Falha ao gravar pendencias_alteracoes_log:", errLog);
    }

    return c.json({
      ok: true,
      cliente: atualizado,
      alterado_por: { id: (user as any).id, nome: (user as any).nome?.trim() || null },
    });
  } catch (err) {
    console.error("❌ /entregas/pendencias/toggle:", err);
    return c.json({ ok: false, error: "Erro ao atualizar pendência" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📊 EFICIÊNCIA DA CAMPANHA DE PENDÊNCIAS
// Retorna baseline (snapshot inicial), estado atual, transições no
// período (resolvidas/reabertas), evolução diária e top resolvedores.
// ═══════════════════════════════════════════════════════════════════
entregasRoutes.get("/entregas/pendencias/eficiencia", async (c) => {
  try {
    const dataInicio = c.req.query("dataInicio");
    const dataFim = c.req.query("dataFim");
    const setorFiltro = c.req.query("setor");

    const supabase = getSupabase();

    // 1) Baseline (por pendência): contagem por setor no snapshot inicial.
    const { data: baselineRows, error: errBaseline } = await supabase
      .from("pendencias_alteracoes_log")
      .select("cliente_entrega_id, setor, campo")
      .eq("origem", "snapshot_inicial");
    if (errBaseline) throw errBaseline;

    const baseline = { agehab: 0, financeiro: 0, contratos: 0 };
    const baselinePorCampo: Record<string, number> = {
      pendencia_agehab: 0,
      pendencia_prosoluto: 0,
      pendencia_jurosobra: 0,
      pendencia_reras: 0,
    };
    const clientesBaselineSet = new Set<string>();
    const baselineQtdPorCliente = new Map<string, number>(); // pendências por cliente no baseline
    for (const r of baselineRows || []) {
      const x = r as any;
      const s = x.setor as Setor;
      if (s in baseline) (baseline as any)[s] += 1;
      if (x.campo in baselinePorCampo) baselinePorCampo[x.campo] += 1;
      clientesBaselineSet.add(x.cliente_entrega_id);
      baselineQtdPorCliente.set(
        x.cliente_entrega_id,
        (baselineQtdPorCliente.get(x.cliente_entrega_id) || 0) + 1,
      );
    }
    const clientesBaseline = clientesBaselineSet.size;

    // 1b) Data do snapshot inicial (para uso como default de dataInicio se omitido).
    const { data: snapMin } = await supabase
      .from("pendencias_alteracoes_log")
      .select("alterado_em")
      .eq("origem", "snapshot_inicial")
      .order("alterado_em", { ascending: true })
      .limit(1)
      .maybeSingle();
    const snapshotInicialEm = (snapMin as any)?.alterado_em || null;

    // 2) Estado atual: por pendência (campo true), por cliente (qualquer true), por empreendimento.
    const { data: clientes, error: errClientes } = await supabase
      .from("clientes_entrega_santorini")
      .select(
        "id, empreendimento, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, pendencia_reras",
      );
    if (errClientes) throw errClientes;

    const atual = { agehab: 0, financeiro: 0, contratos: 0 };
    const atualPorCampo: Record<string, number> = {
      pendencia_agehab: 0,
      pendencia_prosoluto: 0,
      pendencia_jurosobra: 0,
      pendencia_reras: 0,
    };
    let clientesAtual = 0;
    const clientesAtualSet = new Set<string>();
    const atualQtdPorCliente = new Map<string, number>();
    const porEmpreendimento: Record<
      string,
      { agehab: number; financeiro: number; contratos: number; clientes: number }
    > = {};

    for (const r of clientes || []) {
      const x = r as any;
      const empreendimento = x.empreendimento || "Não informado";
      if (!porEmpreendimento[empreendimento]) {
        porEmpreendimento[empreendimento] = { agehab: 0, financeiro: 0, contratos: 0, clientes: 0 };
      }
      let qtd = 0;
      if (x.pendencia_agehab) {
        atual.agehab += 1;
        atualPorCampo.pendencia_agehab += 1;
        porEmpreendimento[empreendimento].agehab += 1;
        qtd += 1;
      }
      if (x.pendencia_prosoluto) {
        atual.financeiro += 1;
        atualPorCampo.pendencia_prosoluto += 1;
        porEmpreendimento[empreendimento].financeiro += 1;
        qtd += 1;
      }
      if (x.pendencia_jurosobra) {
        atual.financeiro += 1;
        atualPorCampo.pendencia_jurosobra += 1;
        porEmpreendimento[empreendimento].financeiro += 1;
        qtd += 1;
      }
      if (x.pendencia_reras) {
        atual.contratos += 1;
        atualPorCampo.pendencia_reras += 1;
        porEmpreendimento[empreendimento].contratos += 1;
        qtd += 1;
      }
      if (qtd > 0) {
        clientesAtual += 1;
        clientesAtualSet.add(String(x.id));
        atualQtdPorCliente.set(String(x.id), qtd);
        porEmpreendimento[empreendimento].clientes += 1;
      }
    }

    // Clientes liberados desde o início = baseline ∖ atual (clientes que estavam pendentes e hoje têm 0).
    let clientesLiberados = 0;
    for (const id of clientesBaselineSet) {
      if (!clientesAtualSet.has(id)) clientesLiberados += 1;
    }

    // Distribuição de pendências por cliente (quantos clientes com 1, 2, 3, 4 pendências) — baseline e atual.
    const distribuicao = {
      baseline: { "1": 0, "2": 0, "3": 0, "4": 0 },
      atual: { "1": 0, "2": 0, "3": 0, "4": 0 },
    } as { baseline: Record<string, number>; atual: Record<string, number> };
    for (const qtd of baselineQtdPorCliente.values()) {
      const k = String(Math.min(4, qtd));
      distribuicao.baseline[k] = (distribuicao.baseline[k] || 0) + 1;
    }
    for (const qtd of atualQtdPorCliente.values()) {
      const k = String(Math.min(4, qtd));
      distribuicao.atual[k] = (distribuicao.atual[k] || 0) + 1;
    }

    // Top 10 empreendimentos com mais pendências (clientes pendentes hoje).
    const topEmpreendimentos = Object.entries(porEmpreendimento)
      .map(([nome, v]) => ({
        nome,
        clientes: v.clientes,
        agehab: v.agehab,
        financeiro: v.financeiro,
        contratos: v.contratos,
        total: v.agehab + v.financeiro + v.contratos,
      }))
      .filter((e) => e.total > 0)
      .sort((a, b) => b.clientes - a.clientes || b.total - a.total)
      .slice(0, 10);

    // 3) Período da janela de análise.
    const inicioISO = dataInicio
      ? `${dataInicio}T00:00:00-03:00`
      : (snapshotInicialEm || new Date(Date.now() - 30 * 86400000).toISOString());
    const fimISO = dataFim ? `${dataFim}T23:59:59-03:00` : new Date().toISOString();

    // 4) Transições no período: log de origem='toggle' com valor anterior != novo.
    let qLog = supabase
      .from("pendencias_alteracoes_log")
      .select("cliente_entrega_id, setor, campo, valor_anterior, valor_novo, alterado_em, alterado_por_nome")
      .eq("origem", "toggle")
      .gte("alterado_em", inicioISO)
      .lte("alterado_em", fimISO);
    if (setorFiltro && ["agehab", "financeiro", "contratos"].includes(setorFiltro)) {
      qLog = qLog.eq("setor", setorFiltro);
    }
    const { data: toggles, error: errToggles } = await qLog;
    if (errToggles) throw errToggles;

    const resolvidas = { agehab: 0, financeiro: 0, contratos: 0 };
    const reabertas = { agehab: 0, financeiro: 0, contratos: 0 };
    const resolvidasPorCampo: Record<string, number> = {
      pendencia_agehab: 0,
      pendencia_prosoluto: 0,
      pendencia_jurosobra: 0,
      pendencia_reras: 0,
    };
    const reabertasPorCampo: Record<string, number> = {
      pendencia_agehab: 0,
      pendencia_prosoluto: 0,
      pendencia_jurosobra: 0,
      pendencia_reras: 0,
    };
    const porResolvedor: Record<string, number> = {};

    for (const r of toggles || []) {
      const x = r as any;
      const s = x.setor as Setor;
      if (x.valor_anterior === true && x.valor_novo === false) {
        if (s in resolvidas) (resolvidas as any)[s] += 1;
        if (x.campo in resolvidasPorCampo) resolvidasPorCampo[x.campo] += 1;
        const nome = (x.alterado_por_nome || "").trim();
        if (nome) porResolvedor[nome] = (porResolvedor[nome] || 0) + 1;
      } else if (x.valor_anterior === false && x.valor_novo === true) {
        if (s in reabertas) (reabertas as any)[s] += 1;
        if (x.campo in reabertasPorCampo) reabertasPorCampo[x.campo] += 1;
      }
    }

    const topResolvedores = Object.entries(porResolvedor)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 5) Evolução diária — partindo do baseline e aplicando transições por dia.
    const dayKey = (iso: string) => iso.slice(0, 10);
    const inicioDate = new Date(inicioISO);
    const fimDate = new Date(fimISO);
    const dias: string[] = [];
    {
      const cursor = new Date(Date.UTC(inicioDate.getUTCFullYear(), inicioDate.getUTCMonth(), inicioDate.getUTCDate()));
      const fimDay = new Date(Date.UTC(fimDate.getUTCFullYear(), fimDate.getUTCMonth(), fimDate.getUTCDate()));
      while (cursor <= fimDay) {
        dias.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    // Mudanças líquidas por dia/setor (resolvidas reduzem, reabertas aumentam)
    const deltaPorDia: Record<string, { agehab: number; financeiro: number; contratos: number }> = {};
    for (const r of toggles || []) {
      const x = r as any;
      const k = dayKey(x.alterado_em);
      if (!deltaPorDia[k]) deltaPorDia[k] = { agehab: 0, financeiro: 0, contratos: 0 };
      const delta = x.valor_anterior === true && x.valor_novo === false ? -1
        : x.valor_anterior === false && x.valor_novo === true ? 1
        : 0;
      const s = x.setor as Setor;
      if (s in deltaPorDia[k]) (deltaPorDia[k] as any)[s] += delta;
    }

    // Reconstrução de estado por cliente para a série "clientesPendentes" por dia.
    // Estado inicial: para cada cliente do baseline, set dos campos pendentes.
    const estadoPorCliente = new Map<string, Set<string>>();
    for (const r of baselineRows || []) {
      const x = r as any;
      const id = String(x.cliente_entrega_id);
      if (!estadoPorCliente.has(id)) estadoPorCliente.set(id, new Set<string>());
      estadoPorCliente.get(id)!.add(x.campo);
    }
    // Toggles ordenados crescentes (já vêm sem ordem garantida).
    const togglesOrd = (toggles || []).slice().sort((a: any, b: any) =>
      String(a.alterado_em).localeCompare(String(b.alterado_em)),
    );
    // Inclui também eventuais toggles fora da janela mas precisamos do estado correto;
    // como filtramos pelo período, o estado parte do baseline e aplica só os do período.
    let cursorTog = 0;

    const evolucaoDiaria: Array<{
      data: string;
      agehab: number;
      financeiro: number;
      contratos: number;
      clientesPendentes: number;
    }> = [];
    let acc = { agehab: baseline.agehab, financeiro: baseline.financeiro, contratos: baseline.contratos };

    for (const d of dias) {
      const delta = deltaPorDia[d] || { agehab: 0, financeiro: 0, contratos: 0 };
      acc = {
        agehab: acc.agehab + delta.agehab,
        financeiro: acc.financeiro + delta.financeiro,
        contratos: acc.contratos + delta.contratos,
      };

      // Aplica todos os toggles do dia ao estado por cliente.
      const fimDoDia = `${d}T23:59:59.999Z`;
      while (cursorTog < togglesOrd.length && String((togglesOrd[cursorTog] as any).alterado_em) <= fimDoDia) {
        const t: any = togglesOrd[cursorTog];
        const id = String((t as any).cliente_entrega_id ?? "");
        // O log inclui cliente_entrega_id no SELECT? — relemos com cliente_entrega_id abaixo.
        // (campo, valor_novo) determinam mudança de pertencimento ao set.
        const set = estadoPorCliente.get(id) || new Set<string>();
        if (t.valor_novo === false) set.delete(t.campo);
        else if (t.valor_novo === true) set.add(t.campo);
        estadoPorCliente.set(id, set);
        cursorTog++;
      }

      let clientesPendentes = 0;
      for (const set of estadoPorCliente.values()) {
        if (set.size > 0) clientesPendentes += 1;
      }
      evolucaoDiaria.push({ data: d, ...acc, clientesPendentes });
    }

    return c.json({
      baseline,
      atual,
      resolvidas,
      reabertas,
      porCampo: {
        baseline: baselinePorCampo,
        atual: atualPorCampo,
        resolvidas: resolvidasPorCampo,
        reabertas: reabertasPorCampo,
      },
      clientes: {
        total: clientes?.length ?? 0,
        baseline: clientesBaseline,
        atual: clientesAtual,
        liberados: clientesLiberados,
      },
      distribuicao,
      topEmpreendimentos,
      evolucaoDiaria,
      topResolvedores,
      periodo: { inicioISO, fimISO, snapshotInicialEm },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /entregas/pendencias/eficiencia:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ⚙️  CONFIG DE DISPAROS DE PENDÊNCIAS
// GET: leitura aberta a quem tiver permissão de eficiência.
// PATCH: requer permissão `entregas.santorini.eficiencia` (gestores).
// ═══════════════════════════════════════════════════════════════════

function podeEficiencia(permissions: any): boolean {
  const p = permissions?.entregas?.santorini?.eficiencia;
  return p === true || (p && typeof p === "object" && p.view === true);
}

async function configEnriquecida(supabase: any) {
  const { data: cfg } = await supabase
    .from("pendencias_disparo_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  // Conta disparos de hoje no log (para a tela mostrar uso vs cota).
  const hojeStart = new Date();
  hojeStart.setHours(0, 0, 0, 0);
  const { data: logsHoje } = await supabase
    .from("notificacoes_manychat_log")
    .select("campanha, status")
    .gte("enviado_em", hojeStart.toISOString());

  const disparosHoje: Record<string, { total: number; success: number; failed: number }> = {
    agehab: { total: 0, success: 0, failed: 0 },
    financeiro: { total: 0, success: 0, failed: 0 },
    contratos: { total: 0, success: 0, failed: 0 },
  };
  for (const r of logsHoje || []) {
    const camp = (r as any).campanha as string;
    if (camp in disparosHoje) {
      disparosHoje[camp].total += 1;
      if ((r as any).status === "success") disparosHoje[camp].success += 1;
      else disparosHoje[camp].failed += 1;
    }
  }

  return { cfg, disparosHoje };
}

entregasRoutes.get("/entregas/pendencias/disparo-config", async (c) => {
  try {
    const supabase = getSupabase();
    const { cfg, disparosHoje } = await configEnriquecida(supabase);
    return c.json({ cfg, disparosHoje, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("❌ GET /disparo-config:", err);
    return c.json({ error: String(err) }, 500);
  }
});

entregasRoutes.patch("/entregas/pendencias/disparo-config", async (c) => {
  try {
    const body = await c.req.json();
    const authUserId = String(body?.auth_user_id ?? "");
    if (!authUserId) {
      return c.json({ ok: false, error: "auth_user_id obrigatório" }, 400);
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from("User")
      .select("id, nome, permissions")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!user || !podeEficiencia((user as any).permissions)) {
      return c.json(
        { ok: false, error: "Sem permissão para alterar configuração de disparos.", code: "SEM_PERMISSAO" },
        403,
      );
    }

    // Whitelist de campos editáveis.
    const patch: Record<string, unknown> = {};
    const numFields = [
      "cota_agehab_dia",
      "cota_financeiro_dia",
      "cota_contratos_dia",
      "cadencia_dias",
      "slots_por_dia",
    ] as const;
    const boolFields = [
      "pausado_global",
      "pausado_agehab",
      "pausado_financeiro",
      "pausado_contratos",
    ] as const;
    for (const f of numFields) {
      if (typeof body?.[f] === "number" && Number.isFinite(body[f]) && body[f] >= 0) {
        patch[f] = Math.floor(body[f]);
      }
    }
    for (const f of boolFields) {
      if (typeof body?.[f] === "boolean") patch[f] = body[f];
    }

    if (Object.keys(patch).length === 0) {
      return c.json({ ok: false, error: "Nenhum campo válido informado" }, 400);
    }

    patch.updated_at = new Date().toISOString();
    patch.updated_by = (user as any).nome?.trim() || authUserId;

    const { data: updated, error } = await supabase
      .from("pendencias_disparo_config")
      .update(patch)
      .eq("id", 1)
      .select("*")
      .maybeSingle();
    if (error) throw error;

    return c.json({ ok: true, cfg: updated, alterado_por: (user as any).nome?.trim() || null });
  } catch (err) {
    console.error("❌ PATCH /disparo-config:", err);
    return c.json({ ok: false, error: String(err) }, 500);
  }
});
