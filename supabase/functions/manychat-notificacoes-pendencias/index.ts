// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: ManyChat Notificações de Pendências
//
// Dispara notificações via ManyChat para clientes com pendências em aberto,
// respeitando cotas por setor e cadência configuradas em
// `pendencias_disparo_config`. Cada cliente cai em exatamente um setor,
// na prioridade Contratos (RERAS) > Financeiro > AGEHAB.
//
// Invocação: chamada por pg_cron em 3 slots/dia (10h, 12h, 14h America/Sao_Paulo,
// seg-sex). Cada slot processa 1/N da cota de cada setor (N = slots_por_dia).
// Autenticação: header Authorization: Bearer <CRON_SECRET>.
//
// Body (todos opcionais):
//   { "slot": 1|2|3 }
//     → Identifica o slot (afeta o cálculo de quota; default = 1).
//   { "target_cliente_ids": ["<uuid>", ...], "force_content": "agehab"|"financeiro"|"contratos" }
//     → Modo de teste: ignora cadência/cotas/pausa e processa só esses clientes,
//       opcionalmente forçando o content do setor escolhido.
//   { "dry_run": true }
//     → Não dispara nem grava log; só retorna a lista de quem seria notificado.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MANYCHAT_API_TOKEN = Deno.env.get("MANYCHAT_API_TOKEN")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

// Content IDs (flow_ns) configurados no ManyChat. Se recriarem os flows, atualizar aqui.
const CONTENT_AGEHAB_DOCUMENTAL = "content20260424131334_198241";
const CONTENT_FINANCEIRO = "content20260423133808_754395";
const CONTENT_RERAS = "content20260504130812_095808";

const MANYCHAT_SEND_URL = "https://api.manychat.com/fb/sending/sendFlow";

type Setor = "agehab" | "financeiro" | "contratos";

const SETORES_PRIORIDADE: Setor[] = ["contratos", "financeiro", "agehab"];

const CONTENT_BY_SETOR: Record<Setor, string> = {
  agehab: CONTENT_AGEHAB_DOCUMENTAL,
  financeiro: CONTENT_FINANCEIRO,
  contratos: CONTENT_RERAS,
};

type Candidate = {
  id: string;
  id_manychat: string;
  pendencia_agehab: boolean;
  pendencia_prosoluto: boolean;
  pendencia_jurosobra: boolean;
  pendencia_reras: boolean;
  setor: Setor;
};

type Config = {
  pausado_global: boolean;
  pausado_agehab: boolean;
  pausado_financeiro: boolean;
  pausado_contratos: boolean;
  cota_agehab_dia: number;
  cota_financeiro_dia: number;
  cota_contratos_dia: number;
  cadencia_dias: number;
  slots_por_dia: number;
};

const DEFAULT_CONFIG: Config = {
  pausado_global: false,
  pausado_agehab: false,
  pausado_financeiro: false,
  pausado_contratos: false,
  cota_agehab_dia: 30,
  cota_financeiro_dia: 30,
  cota_contratos_dia: 10,
  cadencia_dias: 12,
  slots_por_dia: 3,
};

function quotaPorSlot(cotaDia: number, slotsPorDia: number, slotIdx: number): number {
  // Distribui a cota diária entre N slots, jogando o resto pros primeiros slots.
  // ex: 30 dia / 3 slots = 10/10/10. 31 / 3 = 11/10/10.
  const base = Math.floor(cotaDia / slotsPorDia);
  const resto = cotaDia % slotsPorDia;
  return base + (slotIdx <= resto ? 1 : 0);
}

async function disparar(
  supabase: ReturnType<typeof createClient>,
  c: Candidate,
  contentId: string,
  campanha: Setor,
  batchId: string,
  modo: "scheduled" | "test",
  dryRun: boolean,
): Promise<{ ok: boolean; errorMsg?: string | null; httpStatus?: number | null; resp?: unknown }> {
  if (dryRun) {
    return { ok: true, errorMsg: null, httpStatus: null, resp: { dry_run: true } };
  }

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
      errorMsg = (responseJson as { message?: string })?.message ?? `HTTP ${resp.status}`;
    }
  } catch (e) {
    errorMsg = (e as Error).message;
  }

  const { error: logErr } = await supabase.from("notificacoes_manychat_log").insert({
    batch_id: batchId,
    cliente_entrega_id: c.id,
    id_manychat: c.id_manychat,
    campanha,
    content_id: contentId,
    pendencia_snapshot: {
      agehab: c.pendencia_agehab,
      prosoluto: c.pendencia_prosoluto,
      jurosobra: c.pendencia_jurosobra,
      reras: c.pendencia_reras,
      modo,
    },
    status,
    http_status: httpStatus,
    manychat_response: responseJson,
    error_message: errorMsg,
  });
  if (logErr) {
    console.error("Erro ao gravar log:", logErr, "cliente:", c.id);
  }

  return { ok: status === "success", errorMsg, httpStatus, resp: responseJson };
}

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
  const slotRaw = Number((body as { slot?: unknown }).slot);
  const slot = Number.isFinite(slotRaw) && slotRaw >= 1 ? Math.floor(slotRaw) : 1;
  const dryRun = Boolean((body as { dry_run?: unknown }).dry_run);
  const targetIds = Array.isArray((body as { target_cliente_ids?: unknown }).target_cliente_ids)
    ? ((body as { target_cliente_ids: unknown[] }).target_cliente_ids.filter(
        (x): x is string => typeof x === "string",
      ))
    : [];
  const forceContent = (body as { force_content?: unknown }).force_content as Setor | undefined;
  const isTestMode = targetIds.length > 0;

  // ── Carrega config (com fallback pros defaults) ──
  let cfg: Config = { ...DEFAULT_CONFIG };
  try {
    const { data } = await supabase
      .from("pendencias_disparo_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) cfg = { ...DEFAULT_CONFIG, ...(data as Partial<Config>) };
  } catch (e) {
    console.warn("Config não encontrada, usando defaults:", (e as Error).message);
  }

  // Pausa global vale apenas pro modo agendado (modo teste sempre dispara).
  if (!isTestMode && cfg.pausado_global) {
    return Response.json({
      mode: "scheduled",
      skipped: true,
      reason: "pausado_global",
      timestamp: new Date().toISOString(),
    });
  }

  const batchId = crypto.randomUUID();
  const summary = {
    startedAt: new Date().toISOString(),
    mode: isTestMode ? "test" : "scheduled",
    slot,
    dryRun,
    batchId,
    total: 0,
    success: 0,
    failed: 0,
    bySetor: { agehab: 0, financeiro: 0, contratos: 0 } as Record<Setor, number>,
    skippedSetores: [] as Setor[],
    failures: [] as Array<{ cliente_id: string; error: string }>,
    config: cfg,
  };

  // ── MODO TESTE ─────────────────────────────────────────────────
  if (isTestMode) {
    const { data, error } = await supabase
      .from("clientes_entrega_santorini")
      .select(
        "id, id_manychat, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, pendencia_reras",
      )
      .in("id", targetIds)
      .not("id_manychat", "is", null)
      .neq("id_manychat", "");
    if (error) {
      console.error("Erro ao buscar candidatos (modo teste):", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    const list = (data ?? []) as Omit<Candidate, "setor">[];

    for (const c of list) {
      // Decide setor: force_content (se passado) tem prioridade absoluta;
      // senão usa a regra de prioridade Contratos > Financeiro > AGEHAB.
      const setor: Setor = forceContent
        ? forceContent
        : c.pendencia_reras
        ? "contratos"
        : c.pendencia_prosoluto || c.pendencia_jurosobra
        ? "financeiro"
        : "agehab";
      const contentId = CONTENT_BY_SETOR[setor];
      const candidate: Candidate = { ...c, setor };

      const r = await disparar(supabase, candidate, contentId, setor, batchId, "test", dryRun);
      summary.total += 1;
      if (r.ok) {
        summary.success += 1;
        summary.bySetor[setor] += 1;
      } else {
        summary.failed += 1;
        summary.failures.push({ cliente_id: c.id, error: r.errorMsg ?? "unknown" });
      }
    }

    return Response.json({ ...summary, finishedAt: new Date().toISOString() });
  }

  // ── MODO AGENDADO (3 setores, cota proporcional ao slot) ──
  const cotaDiaPorSetor: Record<Setor, number> = {
    agehab: cfg.cota_agehab_dia,
    financeiro: cfg.cota_financeiro_dia,
    contratos: cfg.cota_contratos_dia,
  };
  const pausadoPorSetor: Record<Setor, boolean> = {
    agehab: cfg.pausado_agehab,
    financeiro: cfg.pausado_financeiro,
    contratos: cfg.pausado_contratos,
  };

  for (const setor of SETORES_PRIORIDADE) {
    if (pausadoPorSetor[setor]) {
      summary.skippedSetores.push(setor);
      continue;
    }
    const cotaSlot = quotaPorSlot(cotaDiaPorSetor[setor], cfg.slots_por_dia, slot);
    if (cotaSlot <= 0) continue;

    const { data, error } = await supabase.rpc("manychat_eligible_clients_setor", {
      setor_param: setor,
      cadencia_dias: cfg.cadencia_dias,
      batch_limit: cotaSlot,
    });
    if (error) {
      console.error(`Erro RPC setor=${setor}:`, error);
      continue;
    }
    const list = (data ?? []) as Candidate[];
    summary.total += list.length;

    for (const c of list) {
      const contentId = CONTENT_BY_SETOR[setor];
      const r = await disparar(supabase, c, contentId, setor, batchId, "scheduled", dryRun);
      if (r.ok) {
        summary.success += 1;
        summary.bySetor[setor] += 1;
      } else {
        summary.failed += 1;
        summary.failures.push({ cliente_id: c.id, error: r.errorMsg ?? "unknown" });
      }
    }
  }

  return Response.json({ ...summary, finishedAt: new Date().toISOString() });
});
