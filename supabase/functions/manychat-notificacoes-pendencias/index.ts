// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: ManyChat Notificações de Pendências
//
// Dispara notificações via ManyChat para clientes com pendências em aberto
// (AGEHAB / Pró-Soluto / Juros Obra), respeitando cadência de 10 dias por
// cliente desde o último disparo bem-sucedido.
//
// Regra de seleção do content:
//   - pendencia_agehab = true                         → Content Documental (AGEHAB)
//   - caso contrário (prosoluto OR jurosobra)         → Content Financeiro
//
// Invocação: chamada pelo pg_cron (seg-sex 10:00 America/Cuiaba).
// Autenticação: header Authorization: Bearer <CRON_SECRET>
//
// Body (opcional):
//   { "target_cliente_ids": ["<uuid>", ...] }
//   → Modo de teste: ignora cadência e processa só esses clientes
//     (ainda exige pelo menos 1 pendência = true e id_manychat preenchido).
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MANYCHAT_API_TOKEN = Deno.env.get("MANYCHAT_API_TOKEN")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

// Content IDs (flow_ns) configurados no ManyChat. Se recriarem os flows, atualizar aqui.
const CONTENT_AGEHAB_DOCUMENTAL = "content20260424131334_198241";
const CONTENT_FINANCEIRO = "content20260423133808_754395";

// Endpoint universal do ManyChat — o prefixo /fb/ é legacy mas funciona para todos os canais (WhatsApp/IG/Messenger)
const MANYCHAT_SEND_URL = "https://api.manychat.com/fb/sending/sendFlow";

const CADENCIA_DIAS = 10;
const BATCH_LIMIT = 100;

type Candidate = {
  id: string;
  id_manychat: string;
  pendencia_agehab: boolean;
  pendencia_prosoluto: boolean;
  pendencia_jurosobra: boolean;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const targetIds = Array.isArray((body as { target_cliente_ids?: unknown }).target_cliente_ids)
    ? ((body as { target_cliente_ids: unknown[] }).target_cliente_ids.filter(
        (x): x is string => typeof x === "string",
      ))
    : [];
  const isTestMode = targetIds.length > 0;

  let list: Candidate[] = [];

  if (isTestMode) {
    const { data, error } = await supabase
      .from("clientes_entrega_santorini")
      .select("id, id_manychat, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra")
      .in("id", targetIds)
      .not("id_manychat", "is", null)
      .neq("id_manychat", "")
      .or(
        "pendencia_agehab.eq.true,pendencia_prosoluto.eq.true,pendencia_jurosobra.eq.true",
      );
    if (error) {
      console.error("Erro ao buscar candidatos (modo teste):", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    list = (data ?? []) as Candidate[];
  } else {
    const { data, error } = await supabase.rpc("manychat_eligible_clients", {
      cadencia_dias: CADENCIA_DIAS,
      batch_limit: BATCH_LIMIT,
    });
    if (error) {
      console.error("Erro ao buscar candidatos:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    list = (data ?? []) as Candidate[];
  }
  const batchId = crypto.randomUUID();
  const summary = {
    startedAt: new Date().toISOString(),
    mode: isTestMode ? "test" : "scheduled",
    batchId,
    total: list.length,
    success: 0,
    failed: 0,
    byCampanha: { agehab: 0, financeiro: 0 },
    failures: [] as Array<{ cliente_id: string; error: string }>,
  };

  for (const c of list) {
    const campanha: "agehab" | "financeiro" = c.pendencia_agehab
      ? "agehab"
      : "financeiro";
    const contentId = campanha === "agehab"
      ? CONTENT_AGEHAB_DOCUMENTAL
      : CONTENT_FINANCEIRO;

    let status: "success" | "failed" = "failed";
    let httpStatus: number | null = null;
    let responseJson: unknown = null;
    let errorMsg: string | null = null;

    try {
      const resp = await fetch(MANYCHAT_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriber_id: c.id_manychat,
          flow_ns: contentId,
        }),
      });
      httpStatus = resp.status;
      responseJson = await resp.json().catch(() => null);
      const ok = resp.ok && (responseJson as { status?: string })?.status === "success";
      status = ok ? "success" : "failed";
      if (!ok) {
        errorMsg = (responseJson as { message?: string })?.message
          ?? `HTTP ${resp.status}`;
      }
    } catch (e) {
      errorMsg = (e as Error).message;
    }

    const { error: logErr } = await supabase
      .from("notificacoes_manychat_log")
      .insert({
        batch_id: batchId,
        cliente_entrega_id: c.id,
        id_manychat: c.id_manychat,
        campanha,
        content_id: contentId,
        pendencia_snapshot: {
          agehab: c.pendencia_agehab,
          prosoluto: c.pendencia_prosoluto,
          jurosobra: c.pendencia_jurosobra,
        },
        status,
        http_status: httpStatus,
        manychat_response: responseJson,
        error_message: errorMsg,
      });

    if (logErr) {
      console.error("Erro ao gravar log:", logErr, "cliente:", c.id);
    }

    if (status === "success") {
      summary.success++;
      summary.byCampanha[campanha]++;
    } else {
      summary.failed++;
      summary.failures.push({ cliente_id: c.id, error: errorMsg ?? "unknown" });
    }
  }

  return Response.json({ ...summary, finishedAt: new Date().toISOString() });
});
