import { Hono } from "npm:hono@4";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cadastrosRoutes } from "./cadastros.tsx";
import { entregasRoutes } from "./entregas.tsx";
// 🔥 OTIMIZAÇÃO DE MEMÓRIA v3: whatsapp, chat, scheduler, openai carregados sob demanda (lazy-load)

const app = new Hono();

// 🔥 OTIMIZAÇÃO DE MEMÓRIA: Supabase client lazy (criado sob demanda no 1º request)
let _supabaseInstance: ReturnType<typeof createClient> | null = null;
function _getSupabase() {
  if (!_supabaseInstance) {
    _supabaseInstance = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    console.log('✅ Supabase client inicializado (lazy)');
  }
  return _supabaseInstance;
}
// Proxy transparente: todas as 80+ referências a `supabase` continuam funcionando
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const instance = _getSupabase();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📦 BUCKET SUPABASE STORAGE - Termos de Assistência Técnica (PDFs)
// ═══════════════════════════════════════════════════════════════════
const BUCKET_TERMOS = 'make-a8708d5d-termos-assistencia';
export const BUCKET_RECEBIMENTO = 'entrega-recebimento';

// 🔥 OTIMIZAÇÃO: Buckets criados sob demanda (lazy) em vez de no startup
const _bucketsChecked = new Set<string>();
async function ensureBucketExistsByName(bucketName: string) {
  if (_bucketsChecked.has(bucketName)) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === bucketName);
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(bucketName, { public: false });
      if (error) {
        console.error(`❌ Erro ao criar bucket "${bucketName}":`, error);
      } else {
        console.log(`✅ Bucket "${bucketName}" criado com sucesso`);
      }
    }
    _bucketsChecked.add(bucketName);
  } catch (err) {
    console.error(`❌ Erro na verificação do bucket "${bucketName}":`, err);
  }
}

async function ensureBucketExists() {
  await ensureBucketExistsByName(BUCKET_TERMOS);
}

// ═══════════════════════════════════════════════════════════════════
// 🛡️ HELPER: Query com timeout para evitar travamentos
// ═══════════════════════════════════════════════════════════════════
async function queryWithTimeout<T>(
  queryPromise: Promise<T>, 
  timeoutMs: number = 8000
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => 
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
  );
  
  return Promise.race([queryPromise, timeoutPromise]);
}

// 🔥 OTIMIZAÇÃO v3: enviarMensagemWhatsAppComRegistro removida (código morto - só era chamada em bloco de notificação desativado)

// ═══════════════════════════════════════════════════════════════════
// 🔧 HELPER: Flatten clientes JOIN data into main object
// Dados do cliente (proprietario, email, telefone, bloco, unidade, empreendimento, cpf)
// agora vivem na tabela "clientes" e são buscados via JOIN (embedded resource).
// Esta função achata o objeto aninhado para manter compatibilidade com o frontend.
// ═══════════════════════════════════════════════════════════════════
function flattenClientes(record: any): any {
  if (!record) return record;
  const { clientes, ...rest } = record;
  if (clientes && typeof clientes === 'object') {
    return { ...rest, ...clientes };
  }
  return rest;
}
function flattenClientesArray(records: any[]): any[] {
  return (records || []).map(flattenClientes);
}

// Enable CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ═══════════════════════════════════════════════════════════════════
// 📊 MIDDLEWARE DE LOGGING (console apenas - sem escrita no banco)
// 🔥 OTIMIZAÇÃO: Removido insert no edge_function_logs para economizar memória
// ═══════════════════════════════════════════════════════════════════

app.use('*', async (c, next) => {
  const startTime = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  
  if (method === 'OPTIONS') {
    await next();
    return;
  }
  
  console.log(`📥 ${method} ${path}`);
  
  try {
    await next();
    console.log(`📤 ${method} ${path} - ${c.res.status || 200} (${Date.now() - startTime}ms)`);
  } catch (e) {
    console.error(`❌ ${method} ${path} - Erro:`, e);
    throw e;
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📦 REGISTRAR ROTAS DE MÓDULOS
// ═══════════════════════════════════════════════════════════════════

// 📦 Módulo eager (leve, usa apenas kv_store):
app.route("/make-server-a8708d5d", cadastrosRoutes);
app.route("/make-server-a8708d5d", entregasRoutes);

// 🔥 OTIMIZAÇÃO DE MEMÓRIA v3: Todos os outros módulos carregados sob demanda (lazy-load)
// Cada rota faz dynamic import apenas quando acessada, economizando ~2000+ linhas no startup

// 🔥 OTIMIZAÇÃO v4: Helper com cache de módulos + CORS explícito + query params preservados
const _lazyCache = new Map<string, any>();

async function lazyRoute(c: any, prefix: string, cacheKey: string, moduleLoader: () => Promise<any>, routeExtractor: (mod: any) => any) {
  try {
    let subApp = _lazyCache.get(cacheKey);
    if (!subApp) {
      console.log(`📦 Lazy-loading módulo "${cacheKey}"...`);
      const mod = await moduleLoader();
      const routes = routeExtractor(mod);
      subApp = new Hono();
      subApp.route("/", routes);
      _lazyCache.set(cacheKey, subApp);
      console.log(`✅ Módulo "${cacheKey}" carregado e cacheado`);
    }

    // 🔧 FIX: Preservar query parameters (antes eram perdidos)
    const url = new URL(c.req.url);
    const subPath = url.pathname.replace(prefix, "") || "/";
    const subReq = new Request(`http://localhost${subPath}${url.search}`, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
    });

    const subRes = await subApp.fetch(subReq);

    // 🔧 FIX: Criar Response com CORS explícito (o middleware do app pai perde headers ao substituir c.res)
    const headers = new Headers(subRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Expose-Headers', 'Content-Length');

    return new Response(subRes.body, {
      status: subRes.status,
      headers,
    });
  } catch (error) {
    console.error(`❌ Erro no lazyRoute "${cacheKey}":`, error);
    return c.json({
      error: 'Erro interno ao processar rota',
      details: String(error),
    }, 500);
  }
}

// 🔧 FIX: Cache do createChatRoutes() para não recriar a cada request
let _chatRoutesCache: any = null;

app.all("/make-server-a8708d5d/whatsapp/*", (c) =>
  lazyRoute(c, "/make-server-a8708d5d/whatsapp", "whatsapp", () => import("./whatsapp.tsx"), (m) => m.whatsappRoutes)
);

app.all("/make-server-a8708d5d/chat/*", (c) =>
  lazyRoute(c, "/make-server-a8708d5d/chat", "chat", () => import("./chat.tsx"), (m) => {
    if (!_chatRoutesCache) {
      _chatRoutesCache = m.createChatRoutes();
    }
    return _chatRoutesCache;
  })
);

app.all("/make-server-a8708d5d/scheduler/*", (c) =>
  lazyRoute(c, "/make-server-a8708d5d/scheduler", "scheduler", () => import("./scheduler.tsx"), (m) => m.schedulerRoutes)
);

app.all("/make-server-a8708d5d/ai/*", (c) =>
  lazyRoute(c, "/make-server-a8708d5d/ai", "ai", () => import("./openai.tsx"), (m) => m.openaiRoutes)
);

// 🔥 OTIMIZAÇÃO v7: Sienge ERP routes (lazy-loaded - ~445 linhas removidas do startup)
app.post("/make-server-a8708d5d/assistencia-finalizada/:id/enviar-sienge", (c) =>
  lazyRoute(c, "/make-server-a8708d5d", "sienge", () => import("./sienge.tsx"), (m) => m.siengeRoutes)
);
app.post("/make-server-a8708d5d/assistencia-finalizada/:id/finalizar-manual", (c) =>
  lazyRoute(c, "/make-server-a8708d5d", "sienge", () => import("./sienge.tsx"), (m) => m.siengeRoutes)
);

// 🔥 OTIMIZAÇÃO v7: Monitoring routes (lazy-loaded - ~185 linhas removidas do startup)
app.all("/make-server-a8708d5d/monitoring/*", (c) =>
  lazyRoute(c, "/make-server-a8708d5d/monitoring", "monitoring", () => import("./analytics.tsx"), (m) => m.monitoringRoutes)
);

// 🔥 OTIMIZAÇÃO v7: AI Insights route (lazy-loaded - ~230 linhas removidas do startup)
app.post("/make-server-a8708d5d/ai-insights", (c) =>
  lazyRoute(c, "/make-server-a8708d5d", "ai-insights", () => import("./analytics.tsx"), (m) => m.aiInsightsRoutes)
);

// ═══════════════════════════════════════════════════════════════════
// 🔗 ROTA PROXY PARA WEBHOOK MAKE.COM (EVITAR CORS)
// ═══════════════════════════════════════════════════════════════════

app.post("/make-server-a8708d5d/webhook/makecom", async (c) => {
  try {
    const body = await c.req.json();
    const { webhookUrl, data } = body;
    
    console.log('📤 Proxy: Enviando dados para webhook Make.com...');
    console.log('   URL:', webhookUrl);
    console.log('   Dados:', JSON.stringify(data).substring(0, 200) + '...');
    
    // Validar entrada
    if (!webhookUrl || !data) {
      return c.json({
        success: false,
        error: 'webhookUrl e data são obrigatórios'
      }, 400);
    }
    
    // Enviar para o webhook Make.com
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const responseText = await response.text();
    console.log('✅ Resposta do Make.com:', response.status, responseText.substring(0, 100));
    
    // Tentar parsear como JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText };
    }
    
    return c.json({
      success: response.ok,
      status: response.status,
      response: responseData,
      error: response.ok ? null : 'Webhook retornou erro',
      details: response.ok ? null : responseText
    });
  } catch (error) {
    console.error('❌ Erro no proxy do webhook:', error);
    return c.json({
      success: false,
      error: String(error),
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🧪 ROTAS DE TESTE
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/test-webhook", (c) => {
  return c.json({
    status: "success",
    message: "Servidor funcionando!",
    timestamp: new Date().toISOString(),
    version: "minimal-v1.0"
  });
});

app.get("/make-server-a8708d5d/health", (c) => {
  return c.json({
    status: "ok",
    database: "connected",
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════
// 📋 ROTA BÁSICA DE ASSISTÊNCIAS (SEM KV, SEM COMPLEXIDADE)
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/assistencia/:id", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    console.log(`📊 Buscando assistência #${id}...`);
    
    // ⚡ OTIMIZAÇÃO: Não carregar url_foto (lazy loading)
    // 🔧 JOIN com clientes via id_cliente (dados do cliente agora vivem na tabela clientes)
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .select('id, id_cliente, categoria_reparo, status_chamado, created_at, idempresa, data_vistoria, data_reparo, descricao_cliente, situacao, motivo_desqualificado, Empresa(nome), clientes!id_cliente(proprietario, email, telefone, bloco, unidade, empreendimento, cpf)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar assistência:', error);
      return c.json({ error: error.message, code: error.code }, 500);
    }

    if (!data) {
      return c.json({ error: 'Assistência não encontrada' }, 404);
    }

    const flatData = flattenClientes(data);
    console.log(`✅ Assistência encontrada: ${flatData.proprietario}`);
    return c.json({ data: flatData });
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/make-server-a8708d5d/assistencia", async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;
    
    console.log(`📊 [ENDPOINT /assistencia] Página ${page}, Limite ${limit}, Offset ${offset}`);

    // 🔧 JOIN com clientes via id_cliente (dados do cliente agora vivem na tabela clientes)
    const selectFields = 'id, id_cliente, categoria_reparo, status_chamado, situacao, motivo_desqualificado, created_at, idempresa, data_vistoria, data_reparo, descricao_cliente, Empresa(nome), clientes!id_cliente(proprietario, email, telefone, bloco, unidade, empreendimento, cpf)';
    const statusList = ['Abertos', 'Vistoria agendada', 'Reparo agendado'];

    // 📊 Contagens + dados POR STATUS em paralelo (cada status recebe seus próprios N registros)
    const [
      countTodosRegistros,
      countDesqualificados,
      countAssinatura,
      ...statusResults
    ] = await Promise.all([
      // 🔥 Contagem TOTAL sem nenhum filtro (todos os registros da tabela Assistência Técnica)
      supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }),
      supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }).eq('situacao', 'Desqualificado'),
      supabase.from('assistencia_finalizada').select('id', { count: 'exact', head: true }).eq('status', 'Aguardando assinatura'),
      ...statusList.flatMap(status => [
        supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }).eq('situacao', 'Ativo').eq('status_chamado', status),
        supabase.from('Assistência Técnica').select(selectFields).eq('situacao', 'Ativo').eq('status_chamado', status).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      ]),
    ]);

    const contagemPorStatus: Record<string, number> = {
      'Aguardando assinatura': countAssinatura.count || 0,
    };

    let allData: any[] = [];
    let anyHasMore = false;

    for (let i = 0; i < statusList.length; i++) {
      const status = statusList[i];
      const countResult = statusResults[i * 2];
      const dataResult = statusResults[i * 2 + 1];

      const statusCount = countResult.count || 0;
      contagemPorStatus[status] = statusCount;

      if (dataResult.error) {
        console.error(`❌ Erro ao buscar ${status}:`, dataResult.error);
      } else {
        const records = flattenClientesArray(dataResult.data || []);
        allData = allData.concat(records);
        if (offset + records.length < statusCount) {
          anyHasMore = true;
        }
      }
    }

    const totalAtivos = statusList.reduce((sum, s) => sum + (contagemPorStatus[s] || 0), 0);
    const totalDesqualificados = countDesqualificados.count || 0;
    const totalRegistros = totalAtivos + totalDesqualificados;
    const totalGeralTabela = countTodosRegistros.count || 0;

    console.log(`📊 [COUNT] Ativos: ${totalAtivos}, Desqualificados: ${totalDesqualificados}, Total Tabela (sem filtro): ${totalGeralTabela}`);
    console.log(`📊 [COUNT POR STATUS]`, contagemPorStatus);
    console.log(`✅ [RESULTADO] Página ${page} - ${allData.length} registros retornados (hasMore: ${anyHasMore})`);

    return c.json({
      data: allData,
      pagination: {
        total: totalRegistros,
        returned: allData.length,
        page,
        limit,
        totalPages: Math.ceil(Math.max(...statusList.map(s => contagemPorStatus[s] || 0), 1) / limit),
        hasMore: anyHasMore,
        totalAtivos,
        totalDesqualificados,
        totalBancoDados: totalRegistros,
        totalGeralTabela,
        contagemPorStatus,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📊 CONTAGEM TOTAL DA TABELA ASSISTÊNCIA TÉCNICA (com filtro de data opcional)
// Endpoint leve: retorna apenas counts, sem dados
// ═══════════════════════════════════════════════════════════════════
app.get("/make-server-a8708d5d/assistencia-count", async (c) => {
  try {
    const dataInicio = c.req.query('dataInicio');
    const dataFim = c.req.query('dataFim');

    let query = supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true });

    if (dataInicio) {
      query = query.gte('created_at', `${dataInicio}T00:00:00-03:00`);
    }
    if (dataFim) {
      query = query.lte('created_at', `${dataFim}T23:59:59-03:00`);
    }

    const { count, error } = await query;

    if (error) {
      console.error('❌ Erro em /assistencia-count:', error);
      return c.json({ error: `Erro ao contar registros: ${error.message}` }, 500);
    }

    const total = count || 0;
    console.log(`📊 [assistencia-count] Total=${total} (dataInicio=${dataInicio || 'N/A'}, dataFim=${dataFim || 'N/A'})`);

    return c.json({ total });
  } catch (error) {
    console.error('❌ Erro geral em /assistencia-count:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📊 DASHBOARD STATS — Agregações server-side para gráficos e contadores
// Resolve: gráficos baseados em dados parciais (50 registros) vs totais reais
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/dashboard-stats", async (c) => {
  try {
    const dataInicio = c.req.query('dataInicio');
    const dataFim = c.req.query('dataFim');

    console.log(`📊 [dashboard-stats] dataInicio=${dataInicio || 'N/A'}, dataFim=${dataFim || 'N/A'}`);

    // Helper para aplicar filtro de data em queries
    const applyDateFilter = (query: any, column = 'created_at') => {
      if (dataInicio) query = query.gte(column, `${dataInicio}T00:00:00-03:00`);
      if (dataFim) query = query.lte(column, `${dataFim}T23:59:59-03:00`);
      return query;
    };

    // ── TODAS AS QUERIES EM PARALELO ──────────────────────────────
    const [
      // Counts
      countTotal,
      countDesqualificados,
      countAbertos,
      countVistoria,
      countReparo,
      countAguardandoAssinatura,
      countFinalizado,
      // Chart data (colunas mínimas, sem limite)
      dataEmpreendimento,
      dataCategoria,
      dataEmpresa,
      // Responsáveis (de finalizadas)
      dataResponsaveis,
      // Insumos (material + quantidade)
      dataInsumos,
      // NPS (da tabela avaliacoes_nps)
      dataNps,
    ] = await Promise.all([
      // ── Counts ──
      applyDateFilter(supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true })).then((r: any) => r.count || 0),
      applyDateFilter(supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }).eq('situacao', 'Desqualificado')).then((r: any) => r.count || 0),
      applyDateFilter(supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }).eq('situacao', 'Ativo').eq('status_chamado', 'Abertos')).then((r: any) => r.count || 0),
      applyDateFilter(supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }).eq('situacao', 'Ativo').eq('status_chamado', 'Vistoria agendada')).then((r: any) => r.count || 0),
      applyDateFilter(supabase.from('Assistência Técnica').select('id', { count: 'exact', head: true }).eq('situacao', 'Ativo').eq('status_chamado', 'Reparo agendado')).then((r: any) => r.count || 0),
      applyDateFilter(supabase.from('assistencia_finalizada').select('id', { count: 'exact', head: true }).eq('status', 'Aguardando assinatura')).then((r: any) => r.count || 0),
      applyDateFilter(supabase.from('assistencia_finalizada').select('id', { count: 'exact', head: true }).eq('status', 'Finalizado')).then((r: any) => r.count || 0),

      // ── Chart: empreendimento (via JOIN com clientes) ──
      applyDateFilter(
        supabase.from('Assistência Técnica')
          .select('clientes!id_cliente(empreendimento)')
          .neq('situacao', 'Desqualificado')
      ).then((r: any) => r.data || []),

      // ── Chart: categoria ──
      applyDateFilter(
        supabase.from('Assistência Técnica')
          .select('categoria_reparo')
          .neq('situacao', 'Desqualificado')
      ).then((r: any) => r.data || []),

      // ── Chart: empresa ──
      applyDateFilter(
        supabase.from('Assistência Técnica')
          .select('idempresa, Empresa(nome)')
          .neq('situacao', 'Desqualificado')
      ).then((r: any) => r.data || []),

      // ── Chart: responsáveis (de finalizadas) ──
      applyDateFilter(
        supabase.from('assistencia_finalizada').select('responsaveis')
      ).then((r: any) => r.data || []),

      // ── Chart: insumos (material + quantidade) ──
      applyDateFilter(
        supabase.from('itens_utilizados_posobra').select('material_utilizado, medida, quantidade')
      ).then((r: any) => r.data || []),

      // ── NPS: da tabela avaliacoes_nps ──
      (() => {
        let q = supabase.from('avaliacoes_nps').select('nota').eq('status', 'respondida');
        if (dataInicio) q = q.gte('responded_at', `${dataInicio}T00:00:00-03:00`);
        if (dataFim) q = q.lte('responded_at', `${dataFim}T23:59:59-03:00`);
        return q.then((r: any) => r.data || []);
      })(),
    ]);

    // ── AGREGAÇÕES EM MEMÓRIA ─────────────────────────────────────

    // Empreendimento
    const porEmpreendimento: Record<string, number> = {};
    for (const row of dataEmpreendimento) {
      const nome = (row as any).clientes?.empreendimento || 'Não informado';
      porEmpreendimento[nome] = (porEmpreendimento[nome] || 0) + 1;
    }
    const chartEmpreendimento = Object.entries(porEmpreendimento)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    // Categoria
    const porCategoria: Record<string, number> = {};
    for (const row of dataCategoria) {
      const nome = (row as any).categoria_reparo || 'Não informado';
      porCategoria[nome] = (porCategoria[nome] || 0) + 1;
    }
    const chartCategoria = Object.entries(porCategoria)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    // Empresa
    const porEmpresa: Record<string, number> = {};
    for (const row of dataEmpresa) {
      const nome = (row as any).Empresa?.nome || 'Não informado';
      porEmpresa[nome] = (porEmpresa[nome] || 0) + 1;
    }
    const chartEmpresa = Object.entries(porEmpresa)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    // Responsáveis
    const porResponsavel: Record<string, number> = {};
    for (const row of dataResponsaveis) {
      const resps = (row as any).responsaveis;
      if (Array.isArray(resps)) {
        for (const r of resps) porResponsavel[r || 'Não informado'] = (porResponsavel[r || 'Não informado'] || 0) + 1;
      } else if (resps) {
        porResponsavel[resps] = (porResponsavel[resps] || 0) + 1;
      }
    }
    const chartResponsavel = Object.entries(porResponsavel)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    // Top 10 Insumos (soma de quantidade, não contagem de ocorrências)
    const porInsumo: Record<string, { quantidade: number; medida: string }> = {};
    for (const row of dataInsumos) {
      const material = (row as any).material_utilizado || 'Material não informado';
      const qty = parseFloat((row as any).quantidade) || 0;
      const medida = (row as any).medida || 'Un';
      if (!porInsumo[material]) {
        porInsumo[material] = { quantidade: 0, medida };
      }
      porInsumo[material].quantidade += qty;
    }
    const chartTopInsumos = Object.entries(porInsumo)
      .map(([nome, { quantidade, medida }]) => ({ nome, quantidade: Math.round(quantidade * 100) / 100, medida }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    // NPS (da tabela avaliacoes_nps)
    let npsMedia: number | null = null;
    let npsTotalAvaliacoes = 0;
    if (dataNps.length > 0) {
      let soma = 0;
      for (const row of dataNps) {
        const nota = (row as any).nota;
        if (nota !== null && nota !== undefined && nota >= 1 && nota <= 10) {
          soma += nota;
          npsTotalAvaliacoes++;
        }
      }
      if (npsTotalAvaliacoes > 0) npsMedia = soma / npsTotalAvaliacoes;
    }

    const totalAtivos = countAbertos + countVistoria + countReparo;

    console.log(`📊 [dashboard-stats] Total=${countTotal}, Ativos=${totalAtivos}, Desq=${countDesqualificados}, NPS=${npsMedia?.toFixed(1) || 'N/A'} (${npsTotalAvaliacoes} aval.)`);

    return c.json({
      counts: {
        total: countTotal,
        procedentes: countTotal - countDesqualificados,
        desqualificados: countDesqualificados,
        abertos: countAbertos,
        vistoriaAgendada: countVistoria,
        reparoAgendado: countReparo,
        aguardandoAssinatura: countAguardandoAssinatura,
        finalizado: countFinalizado,
        totalFinalizacoes: countAguardandoAssinatura + countFinalizado,
      },
      charts: {
        porEmpreendimento: chartEmpreendimento,
        porCategoria: chartCategoria,
        porEmpresa: chartEmpresa,
        porResponsavel: chartResponsavel,
        topInsumos: chartTopInsumos,
      },
      nps: {
        media: npsMedia,
        totalAvaliacoes: npsTotalAvaliacoes,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erro em /dashboard-stats:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ⭐ AVALIAÇÕES NPS — Lista detalhada com filtros e paginação
// Usa o mesmo recorte de período do dashboard (responded_at).
// ═══════════════════════════════════════════════════════════════════
app.get("/make-server-a8708d5d/avaliacoes-nps", async (c) => {
  try {
    const dataInicio = c.req.query('dataInicio');
    const dataFim = c.req.query('dataFim');
    const minNota = c.req.query('minNota');
    const maxNota = c.req.query('maxNota');
    const apenasComComentario = c.req.query('apenasComComentario') === 'true';
    const search = (c.req.query('search') || '').trim();
    const empreendimento = (c.req.query('empreendimento') || '').trim();
    const responsavel = (c.req.query('responsavel') || '').trim();
    const categoria = (c.req.query('categoria') || '').trim();
    const ordem = c.req.query('ordem') === 'nota_asc' ? 'nota_asc'
      : c.req.query('ordem') === 'nota_desc' ? 'nota_desc'
      : 'data_desc';
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '50')));

    let query = supabase
      .from('avaliacoes_nps')
      .select(`
        id,
        nota,
        comentario,
        responded_at,
        created_at,
        status,
        id_assistencia,
        assistencia_finalizada_id,
        responsaveis,
        "Assistência Técnica":id_assistencia (
          categoria_reparo,
          id_cliente,
          clientes:id_cliente (
            proprietario,
            cpf,
            empreendimento,
            bloco,
            unidade
          )
        )
      `, { count: 'exact' })
      .eq('status', 'respondida');

    if (dataInicio) query = query.gte('responded_at', `${dataInicio}T00:00:00-03:00`);
    if (dataFim) query = query.lte('responded_at', `${dataFim}T23:59:59-03:00`);
    if (minNota) query = query.gte('nota', parseInt(minNota));
    if (maxNota) query = query.lte('nota', parseInt(maxNota));
    if (apenasComComentario) query = query.not('comentario', 'is', null).neq('comentario', '');

    if (ordem === 'nota_asc') query = query.order('nota', { ascending: true, nullsFirst: false });
    else if (ordem === 'nota_desc') query = query.order('nota', { ascending: false, nullsFirst: false });
    else query = query.order('responded_at', { ascending: false, nullsFirst: false });

    // Buscamos um pool maior para permitir filtragem em memória dos campos
    // que dependem do JOIN (proprietário, CPF, empreendimento, responsável, categoria),
    // já que filtros relacionais via PostgREST têm limitações com aliases.
    const POOL_SIZE = 1000;
    const { data: rows, count, error } = await query.range(0, POOL_SIZE - 1);

    if (error) {
      console.error('❌ Erro em /avaliacoes-nps:', error);
      return c.json({ error: `Erro ao buscar avaliações: ${error.message}` }, 500);
    }

    type Row = any;
    const flat = (rows || []).map((r: Row) => {
      const at = r['Assistência Técnica'] || {};
      const cli = at?.clientes || {};
      return {
        id: r.id,
        nota: r.nota,
        comentario: r.comentario,
        responded_at: r.responded_at,
        created_at: r.created_at,
        id_assistencia: r.id_assistencia,
        assistencia_finalizada_id: r.assistencia_finalizada_id,
        responsaveis: Array.isArray(r.responsaveis) ? r.responsaveis : (r.responsaveis ? [r.responsaveis] : []),
        categoria_reparo: at?.categoria_reparo || null,
        proprietario: cli?.proprietario || null,
        cpf: cli?.cpf || null,
        empreendimento: cli?.empreendimento || null,
        bloco: cli?.bloco || null,
        unidade: cli?.unidade || null,
      };
    });

    const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const onlyDigits = (s: any) => String(s || '').replace(/\D/g, '');

    const searchN = norm(search);
    const searchDigits = onlyDigits(search);
    const empN = norm(empreendimento);
    const respN = norm(responsavel);
    const catN = norm(categoria);

    const filtered = flat.filter((row: any) => {
      if (search) {
        const matchProp = norm(row.proprietario).includes(searchN);
        const matchCpf = searchDigits ? onlyDigits(row.cpf).includes(searchDigits) : false;
        const matchComentario = norm(row.comentario).includes(searchN);
        if (!matchProp && !matchCpf && !matchComentario) return false;
      }
      if (empreendimento && norm(row.empreendimento) !== empN) return false;
      if (categoria && norm(row.categoria_reparo) !== catN) return false;
      if (responsavel) {
        const has = (row.responsaveis || []).some((r: any) => norm(r) === respN);
        if (!has) return false;
      }
      return true;
    });

    const totalFiltered = filtered.length;
    const offset = (page - 1) * limit;
    const pageItems = filtered.slice(offset, offset + limit);

    // Agregados também sobre o conjunto filtrado (para refletir os filtros aplicados)
    const notas = filtered.map((r: any) => Number(r.nota)).filter((n: number) => !Number.isNaN(n));
    const total = notas.length;
    const media = total > 0 ? notas.reduce((a: number, b: number) => a + b, 0) / total : null;

    const distribuicao: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) distribuicao[String(i)] = 0;
    for (const n of notas) {
      const k = String(n);
      if (distribuicao[k] !== undefined) distribuicao[k] += 1;
    }

    // Classificação NPS clássica (0-10): Detrator (0-6), Neutro (7-8), Promotor (9-10)
    const detratores = notas.filter((n: number) => n <= 6).length;
    const neutros = notas.filter((n: number) => n === 7 || n === 8).length;
    const promotores = notas.filter((n: number) => n >= 9).length;
    const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;

    // Listas únicas para popular filtros no front (do pool, não da página)
    const empreendimentosUnicos = Array.from(new Set(flat.map((r: any) => r.empreendimento).filter(Boolean))).sort();
    const responsaveisUnicos = Array.from(new Set(flat.flatMap((r: any) => r.responsaveis || []).filter(Boolean))).sort();
    const categoriasUnicas = Array.from(new Set(flat.map((r: any) => r.categoria_reparo).filter(Boolean))).sort();

    return c.json({
      data: pageItems,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPool: count ?? flat.length,
        hasMore: offset + pageItems.length < totalFiltered,
        truncatedPool: (count ?? 0) > POOL_SIZE,
      },
      agregados: {
        media: media !== null ? Number(media.toFixed(2)) : null,
        total,
        distribuicao,
        detratores,
        neutros,
        promotores,
        npsScore,
      },
      filtrosDisponiveis: {
        empreendimentos: empreendimentosUnicos,
        responsaveis: responsaveisUnicos,
        categorias: categoriasUnicas,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erro geral em /avaliacoes-nps:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🏥 ROTA DE SOLICITAÇÃO PÚBLICA (SIMPLIFICADA)
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// 👤 LISTAR CLIENTES (protegido - painel admin)
// ─────────────────────────────────────────────────────────────────
app.get("/make-server-a8708d5d/clientes", async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
    const offset = (page - 1) * limit;
    const search = (c.req.query('search') || '').trim();
    const empreendimento = (c.req.query('empreendimento') || '').trim();

    console.log(`👤 [GET /clientes] page=${page}, limit=${limit}, search="${search}", empreendimento="${empreendimento}"`);

    let countQuery = supabase.from('clientes').select('id_cliente', { count: 'exact', head: true });
    let dataQuery = supabase.from('clientes').select('*');

    if (search) {
      const searchFilter = `proprietario.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,bloco.ilike.%${search}%,unidade.ilike.%${search}%`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
    }

    if (empreendimento) {
      countQuery = countQuery.eq('empreendimento', empreendimento);
      dataQuery = dataQuery.eq('empreendimento', empreendimento);
    }

    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery.order('proprietario', { ascending: true }).range(offset, offset + limit - 1),
    ]);

    if (dataResult.error) {
      console.error('❌ Erro ao listar clientes:', dataResult.error);
      return c.json({ error: dataResult.error.message }, 500);
    }

    const total = countResult.count ?? 0;
    console.log(`✅ ${dataResult.data?.length || 0} clientes retornados (total: ${total})`);

    return c.json({
      data: dataResult.data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Erro geral ao listar clientes:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 👤 BUSCAR EMPREENDIMENTOS DISTINTOS (para filtro)
// ─────────────────────────────────────────────────────────────────
app.get("/make-server-a8708d5d/clientes-empreendimentos", async (c) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('empreendimento')
      .not('empreendimento', 'is', null)
      .order('empreendimento');
    
    if (error) {
      console.error('❌ Erro ao buscar empreendimentos:', error);
      return c.json({ error: error.message }, 500);
    }

    const unique = [...new Set((data || []).map((d: any) => d.empreendimento).filter(Boolean))];
    return c.json({ data: unique });
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 👤 BUSCAR CLIENTE POR CPF (público)
// ─────────────────────────────────────────────────────────────────
app.get("/make-server-a8708d5d/clientes-cpf/:cpf", async (c) => {
  try {
    const cpf = c.req.param('cpf');
    
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
      return c.json({ error: 'CPF inválido' }, 400);
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar cliente por CPF:', error);
      return c.json({ error: error.message }, 500);
    }

    if (!data) {
      return c.json({ found: false, cliente: null });
    }

    console.log(`✅ Cliente encontrado por CPF. Colunas: ${Object.keys(data).join(', ')}. ID: ${data.id}`);
    return c.json({ found: true, cliente: data });
  } catch (error) {
    console.error('❌ Erro na busca de cliente por CPF:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 🏢 LISTAR EMPREENDIMENTOS (público)
// ─────────────────────────────────────────────────────────────────
app.get("/make-server-a8708d5d/empreendimentos", async (c) => {
  try {
    const { data, error } = await supabase
      .from('empreendimentos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.error('❌ Erro ao listar empreendimentos:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Empreendimentos listados: ${data?.length || 0}`, data?.length ? `Colunas: ${Object.keys(data[0]).join(', ')}` : '');
    return c.json({ empreendimentos: data || [] });
  } catch (error) {
    console.error('❌ Erro ao listar empreendimentos:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 🏘️ LISTAR SÍNDICOS (público)
// ─────────────────────────────────────────────────────────────────
app.get("/make-server-a8708d5d/sindicos", async (c) => {
  try {
    const { data, error } = await supabase
      .from('sindicos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.error('❌ Erro ao listar síndicos:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Síndicos listados: ${data?.length || 0}`, data?.length ? `Colunas: ${Object.keys(data[0]).join(', ')}` : '');
    return c.json({ sindicos: data || [] });
  } catch (error) {
    console.error('❌ Erro ao listar síndicos:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 👤 CRIAR NOVO CLIENTE (público)
// ─────────────────────────────────────────────────────────────────
app.post("/make-server-a8708d5d/clientes", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.cpf || !body.nome || !body.empreendimento) {
      return c.json({ error: 'CPF, nome e empreendimento são obrigatórios' }, 400);
    }

    const cpfLimpo = body.cpf.replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    // Checar duplicata — SELECT * para retornar dados completos se já existir
    const { data: existente } = await supabase
      .from('clientes')
      .select('*')
      .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
      .maybeSingle();

    if (existente) {
      console.log(`⚠️ Cliente já existe para CPF ${cpfFormatado}. Colunas: ${Object.keys(existente).join(', ')}. Dados: ${JSON.stringify(existente).substring(0, 500)}`);
      return c.json({ error: 'Cliente com este CPF já existe', code: 'CPF_EXISTS', cliente: existente }, 409);
    }

    const insertPayload: Record<string, unknown> = {
        proprietario: body.nome,
        cpf: body.cpf,
        email: body.email || null,
        telefone: body.telefone || null,
        bloco: body.bloco || null,
        unidade: body.unidade || null,
        empreendimento: body.empreendimento,
        created_at: new Date().toISOString()
    };

    // Campos opcionais de relacionamento
    if (body.id_empreendimento) insertPayload.id_empreendimento = body.id_empreendimento;
    if (body.idSindico) insertPayload.idSindico = body.idSindico;

    console.log(`📝 Inserindo cliente. Payload: ${JSON.stringify(insertPayload).substring(0, 500)}`);

    const { data, error } = await supabase
      .from('clientes')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar cliente (insert+select):', error);
      // INSERT pode ter sucedido mas RLS bloqueou o SELECT — tentar fallback por CPF
      console.log('🔄 Tentando buscar cliente recém-criado por CPF como fallback...');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('clientes')
        .select('*')
        .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
        .maybeSingle();

      if (fallbackData) {
        console.log(`✅ Cliente encontrado via fallback CPF. Colunas: ${Object.keys(fallbackData).join(', ')}. Dados: ${JSON.stringify(fallbackData).substring(0, 500)}`);
        return c.json({ success: true, cliente: fallbackData }, 201);
      }

      console.error('❌ Fallback CPF também falhou:', fallbackError);
      return c.json({ error: error.message }, 500);
    }

    if (!data) {
      // .select() retornou null — buscar por CPF como fallback
      console.log('⚠️ INSERT ok mas .select() retornou null. Buscando por CPF...');
      const { data: fallbackData } = await supabase
        .from('clientes')
        .select('*')
        .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
        .maybeSingle();

      if (fallbackData) {
        console.log(`✅ Cliente encontrado via fallback CPF (pós-insert). Colunas: ${Object.keys(fallbackData).join(', ')}. Dados: ${JSON.stringify(fallbackData).substring(0, 500)}`);
        return c.json({ success: true, cliente: fallbackData }, 201);
      }

      return c.json({ error: 'Cliente criado mas não foi possível recuperar os dados. Possível problema de RLS.' }, 500);
    }

    console.log(`✅ Novo cliente criado. Colunas: ${Object.keys(data).join(', ')}. Dados: ${JSON.stringify(data).substring(0, 500)}`);
    return c.json({ success: true, cliente: data }, 201);
  } catch (error) {
    console.error('❌ Erro ao criar cliente:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 👤 ATUALIZAR EMPREENDIMENTO DO CLIENTE (PATCH - usado por síndicos)
// ─────────────────────────────────────────────────────────────────
app.patch("/make-server-a8708d5d/clientes/:id", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    if (!id || isNaN(id)) {
      return c.json({ error: 'ID do cliente inválido' }, 400);
    }

    // Apenas campos permitidos para atualização pública
    const allowedFields = ['empreendimento', 'email', 'telefone', 'idSindico'];
    const updatePayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return c.json({ error: 'Nenhum campo válido para atualizar' }, 400);
    }

    console.log(`🔄 [PATCH /clientes/${id}] Atualizando: ${JSON.stringify(updatePayload)}`);

    const { data, error } = await supabase
      .from('clientes')
      .update(updatePayload)
      .eq('id_cliente', id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Erro ao atualizar cliente #${id}:`, error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Cliente #${id} atualizado com sucesso. Empreendimento: ${data?.empreendimento}, idSindico: ${data?.idSindico}`);
    return c.json({ success: true, cliente: data });
  } catch (error) {
    console.error('❌ Erro geral ao atualizar cliente:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 📋 LISTAR CHAMADOS DE UM CLIENTE (por id_cliente)
// ─────────────────────────────────────────────────────────────────
app.get("/make-server-a8708d5d/chamados-cliente/:id", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) {
      return c.json({ error: 'ID do cliente inválido' }, 400);
    }

    // 1. Buscar chamados da Assistência Técnica
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .select('id, categoria_reparo, status_chamado, descricao_cliente, situacao, created_at')
      .eq('id_cliente', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`❌ Erro ao buscar chamados do cliente #${id}:`, error);
      return c.json({ error: error.message }, 500);
    }

    const chamados = data || [];
    let temPendenciaAssinatura = false;

    // Log detalhado dos status para debug
    console.log(`🔍 [chamados-cliente] Status dos ${chamados.length} chamados:`, 
      chamados.map((ch: any) => ({ id: ch.id, status_chamado: ch.status_chamado, situacao: ch.situacao }))
    );

    // 2. Verificar pendência em AMBAS as fontes de verdade
    if (chamados.length > 0) {
      // 2a. Checar status_chamado direto na Assistência Técnica (case-insensitive, inclui variações)
      const aguardandoDireto = chamados.filter((ch: any) => 
        ch.status_chamado?.toLowerCase().includes('aguardando') && ch.situacao !== 'Desqualificado'
      );
      if (aguardandoDireto.length > 0) {
        temPendenciaAssinatura = true;
        console.log(`🔍 [chamados-cliente] ${aguardandoDireto.length} chamados com status 'aguardando*' direto na AT`);
        for (const ch of aguardandoDireto) {
          (ch as any).status_finalizacao = 'Aguardando assinatura';
        }
      }

      // 2b. Checar tabela assistencia_finalizada (com dados completos para reenvio)
      const chamadoIds = chamados.map((ch: any) => ch.id).filter(Boolean);
      console.log(`🔍 [chamados-cliente] IDs para buscar em assistencia_finalizada:`, chamadoIds);
      
      let todasFinalizacoes: any[] = [];
      
      if (chamadoIds.length > 0) {
        const { data: finalizacoes, error: errFin } = await supabase
          .from('assistencia_finalizada')
          .select('id, id_assistencia, cpf_assistencia, status, responsaveis, providencias, nps, created_at')
          .in('id_assistencia', chamadoIds);

        if (errFin) {
          console.error(`⚠️ Erro ao verificar finalizações por id_assistencia do cliente #${id}:`, errFin);
        } else {
          todasFinalizacoes = finalizacoes || [];
          console.log(`🔍 [chamados-cliente] Finalizações por id_assistencia: ${todasFinalizacoes.length} encontradas`);
        }
      }

      // 2c. Fallback: buscar por CPF caso id_assistencia não tenha matches
      if (todasFinalizacoes.length === 0) {
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('cpf')
          .eq('id_cliente', id)
          .single();
        
        if (clienteData?.cpf) {
          const cpfLimpo = clienteData.cpf.replace(/\D/g, '');
          console.log(`🔍 [chamados-cliente] Tentando fallback por CPF: ${cpfLimpo}`);
          const { data: finPorCpf, error: errCpf } = await supabase
            .from('assistencia_finalizada')
            .select('id, id_assistencia, cpf_assistencia, status, responsaveis, providencias, nps, created_at')
            .eq('cpf_assistencia', cpfLimpo);
          
          if (!errCpf && finPorCpf && finPorCpf.length > 0) {
            todasFinalizacoes = finPorCpf;
            console.log(`🔍 [chamados-cliente] Fallback por CPF encontrou ${finPorCpf.length} finalizações`);
          }
        }
      }

      // Processar finalizações encontradas
      if (todasFinalizacoes.length > 0) {
        console.log(`🔍 [chamados-cliente] Finalizações detalhadas:`, todasFinalizacoes.map((f: any) => ({ id: f.id, id_assistencia: f.id_assistencia, status: f.status, cpf: f.cpf_assistencia })));
        
        const aguardando = todasFinalizacoes.filter((f: any) => 
          f.status?.toLowerCase().includes('aguardando')
        );
        
        if (aguardando.length > 0) {
          temPendenciaAssinatura = true;
          console.log(`🔍 [chamados-cliente] ${aguardando.length} finalizações 'aguardando*' encontradas`);
        }
        
        // Enriquecer chamados com dados da finalização (id_finalizacao para reenvio direto)
        console.log(`🔍 [chamados-cliente] Tentando enriquecer ${chamados.length} chamados com ${todasFinalizacoes.length} finalizações`);
        console.log(`🔍 [chamados-cliente] IDs chamados: [${chamados.map((ch: any) => `${ch.id}(${typeof ch.id})`).join(', ')}]`);
        console.log(`🔍 [chamados-cliente] IDs finalizações (id_assistencia): [${todasFinalizacoes.map((f: any) => `${f.id_assistencia}(${typeof f.id_assistencia}) -> fin.id=${f.id}`).join(', ')}]`);
        for (const ch of chamados) {
          let fin = todasFinalizacoes.find((f: any) => f.id_assistencia === ch.id);
          if (!fin) fin = todasFinalizacoes.find((f: any) => String(f.id_assistencia) === String(ch.id));
          // Fallback numérico: converter ambos para number
          if (!fin) fin = todasFinalizacoes.find((f: any) => Number(f.id_assistencia) === Number(ch.id));
          
          if (fin) {
            console.log(`✅ [chamados-cliente] Chamado #${ch.id} enriquecido com finalização #${fin.id} (id_assistencia=${fin.id_assistencia})`);
            if (fin.status?.toLowerCase().includes('aguardando')) {
              (ch as any).status_finalizacao = 'Aguardando assinatura';
            }
            (ch as any).id_finalizacao = fin.id;
            (ch as any).fin_responsaveis = fin.responsaveis;
            (ch as any).fin_providencias = fin.providencias;
            (ch as any).fin_itens_reparo = []; // itens ficam na tabela itens_utilizados_posobra, não em assistencia_finalizada
            (ch as any).fin_nps = fin.nps;
            (ch as any).fin_data_finalizacao = fin.created_at; // tabela não tem coluna data_finalizacao, usar created_at
            (ch as any).fin_status = fin.status;
          } else {
            console.log(`⚠️ [chamados-cliente] Chamado #${ch.id} SEM match em finalizações`);
          }
        }
      }
    }

    console.log(`✅ Chamados do cliente #${id}: ${chamados.length} encontrados, pendência assinatura: ${temPendenciaAssinatura}`);
    return c.json({ chamados, temPendenciaAssinatura });
  } catch (error) {
    console.error('❌ Erro geral ao buscar chamados do cliente:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 🏥 CRIAR SOLICITAÇÃO v2 (vinculada a cliente existente)
// ─────────────────────────────────────────────────────────────────
app.post("/make-server-a8708d5d/solicitacao-assistencia-v2", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log(`📥 Nova solicitação v2 recebida. cliente_id=${body.cliente_id}, cpf=${body.cpf || 'N/A'}`);
    
    if (!body.cliente_id && !body.cpf) {
      return c.json({ error: 'ID do cliente ou CPF é obrigatório', code: 'MISSING_CLIENT' }, 400);
    }

    if (!body.url_foto || body.url_foto.trim() === '') {
      return c.json({ error: 'A foto do problema é obrigatória', code: 'MISSING_PHOTO' }, 400);
    }
    
    if (!body.url_foto.startsWith('data:image/')) {
      return c.json({ error: 'Formato de imagem inválido', code: 'INVALID_IMAGE_FORMAT' }, 400);
    }

    // Estratégia de lookup resiliente: tentar por ID, depois por CPF
    let cliente: any = null;

    // Tentativa 1: buscar por ID (pode ser coluna "id")
    if (body.cliente_id) {
      const { data: byId, error: errId } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', body.cliente_id)
        .maybeSingle();

      if (byId) {
        console.log(`✅ Cliente encontrado por id=${body.cliente_id}`);
        cliente = byId;
      } else {
        console.log(`⚠️ Lookup por id=${body.cliente_id} falhou: ${errId?.message || 'não encontrado'}. Tentando fallbacks...`);
      }
    }

    // Tentativa 2: buscar por CPF (fallback robusto)
    if (!cliente && body.cpf) {
      const cpfLimpo = body.cpf.replace(/\D/g, '');
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      const { data: byCpf } = await supabase
        .from('clientes')
        .select('*')
        .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
        .maybeSingle();

      if (byCpf) {
        console.log(`✅ Cliente encontrado por CPF fallback. Colunas: ${Object.keys(byCpf).join(', ')}`);
        cliente = byCpf;
      } else {
        console.log(`⚠️ Lookup por CPF ${cpfFormatado} também falhou.`);
      }
    }

    if (!cliente) {
      console.error(`❌ Cliente não encontrado. cliente_id=${body.cliente_id}, cpf=${body.cpf || 'N/A'}`);
      return c.json({ error: 'Cliente não encontrado', code: 'CLIENT_NOT_FOUND' }, 404);
    }

    // Extrair o PK real do cliente para salvar na solicitação
    const clientePK = cliente.id ?? cliente.ID ?? body.cliente_id;

    // Dados do cliente (nome, email, telefone, endereço) agora ficam APENAS na tabela "clientes"
    // A tabela "Assistência Técnica" só guarda dados do problema + FK id_cliente
    const emailFinal = cliente.email;
    const telefoneFinal = cliente.telefone;
    
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .insert([{
        id_cliente: clientePK,
        descricao_cliente: body.descricao_cliente,
        categoria_reparo: body.categoria_reparo,
        url_foto: body.url_foto,
        idempresa: body.idempresa || 1,
        status_chamado: 'Abertos',
        situacao: 'Ativo',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar solicitação v2:', error);
      return c.json({ error: error.message }, 500);
    }

    // 📱 NOTIFICAÇÃO WHATSAPP
    try {
      const grupoWhatsApp = Deno.env.get('WHATSAPP_GROUP_ID_ABERTURA') || '120363401267232313-group';
      const { ZApiClient } = await import("./chat.tsx");
      const zapi = new ZApiClient();
      
      const mensagem = `⚠️NOVO CHAMADO ABERTO⚠️\n\n` +
        `*Proprietario:* ${cliente.proprietario}\n` +
        `*CPF:* ${cliente.cpf}\n` +
        `*Telefone:* ${telefoneFinal}\n` +
        `*E-mail:* ${emailFinal}\n` +
        `*Bloco - Apt:* ${cliente.bloco}-${cliente.unidade}\n` +
        `*Empreendimento:* ${cliente.empreendimento}\n\n` +
        `*Categoria do reparo:* ${body.categoria_reparo}\n` +
        `*Descrição do problema:* ${body.descricao_cliente}`;
      
      const buttonActions = [{ id: "1", type: "URL", url: "https://connect.eonbr.com", label: "Ver chamado" }];
      
      if (body.url_foto) {
        const resultadoFoto = await zapi.sendImageWithButtonsToGroup(grupoWhatsApp, body.url_foto, mensagem, buttonActions);
        if (!resultadoFoto.success) {
          await zapi.sendMessageToGroup(grupoWhatsApp, mensagem);
        }
      }
    } catch (errorWhatsApp) {
      console.error('❌ Erro WhatsApp (não crítico):', errorWhatsApp);
    }

    // 🤖 ANÁLISE GPT AUTOMÁTICA
    import("./openai.tsx").then(({ analisarChamadoAutomatico }) => {
      analisarChamadoAutomatico({
        id: data.id,
        descricao_cliente: body.descricao_cliente,
        categoria_reparo: body.categoria_reparo,
        empreendimento: cliente.empreendimento,
        bloco: cliente.bloco,
        unidade: cliente.unidade,
        proprietario: cliente.proprietario,
      }).catch((err: any) => console.error('⚠️ Erro GPT:', err));
    }).catch((err: any) => console.error('⚠️ Erro ao carregar openai:', err));

    return c.json({ success: true, data, message: 'Solicitação criada com sucesso!' });
  } catch (error) {
    console.error('❌ Erro na solicitação v2:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// 🏥 CRIAR SOLICITAÇÃO v1 (legado - NORMALIZADO para nova arquitetura)
// 🔧 Agora cria/reutiliza cliente na tabela "clientes" e vincula via id_cliente
// ───────────────────────────────────────────���─────────────────────
app.post("/make-server-a8708d5d/solicitacao-assistencia", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('📥 [v1 NORMALIZADO] Nova solicitação recebida. Validando foto...');
    
    // 📸 VALIDAÇÃO: Foto é obrigatória
    if (!body.url_foto || body.url_foto.trim() === '') {
      console.error('❌ Tentativa de criar solicitação sem foto');
      return c.json({ 
        error: 'A foto do problema é obrigatória',
        code: 'MISSING_PHOTO' 
      }, 400);
    }
    
    // Validar se é uma imagem base64 válida
    if (!body.url_foto.startsWith('data:image/')) {
      console.error('❌ Formato de foto inválido');
      return c.json({ 
        error: 'Formato de imagem inválido',
        code: 'INVALID_IMAGE_FORMAT' 
      }, 400);
    }
    
    console.log('✅ Foto validada com sucesso');
    
    // 🔧 NORMALIZADO: Criar/buscar cliente na tabela "clientes" antes de criar a solicitação
    let clientePK: number | null = null;

    if (body.cpf) {
      const cpfLimpo = body.cpf.replace(/\D/g, '');
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

      // Verificar se já existe
      const { data: existente } = await supabase
        .from('clientes')
        .select('id')
        .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
        .maybeSingle();

      if (existente) {
        clientePK = existente.id;
        console.log(`✅ [v1] Cliente já existe: id=${clientePK}`);
      } else {
        // Criar novo cliente
        const { data: novoCliente, error: errCliente } = await supabase
          .from('clientes')
          .insert([{
            proprietario: body.proprietario,
            cpf: body.cpf,
            email: body.email || null,
            telefone: body.telefone || null,
            bloco: body.bloco || null,
            unidade: body.unidade || null,
            empreendimento: body.empreendimento,
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();

        if (novoCliente) {
          clientePK = novoCliente.id;
          console.log(`✅ [v1] Novo cliente criado: id=${clientePK}`);
        } else {
          console.error('❌ [v1] Erro ao criar cliente:', errCliente);
          // Fallback: tentar buscar por CPF novamente (pode ter sido criado em paralelo)
          const { data: fallback } = await supabase
            .from('clientes')
            .select('id')
            .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
            .maybeSingle();
          if (fallback) clientePK = fallback.id;
        }
      }
    }

    // Inserir solicitação usando id_cliente (dados do cliente NÃO são mais inseridos inline)
    const insertPayload: Record<string, unknown> = {
      descricao_cliente: body.descricao_cliente,
      categoria_reparo: body.categoria_reparo,
      url_foto: body.url_foto,
      idempresa: body.idempresa || 1,
      status_chamado: 'Abertos',
      situacao: 'Ativo',
      created_at: new Date().toISOString(),
    };

    if (clientePK) {
      insertPayload.id_cliente = clientePK;
    }

    const { data, error } = await supabase
      .from('Assistência Técnica')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    // 📱 ENVIAR NOTIFICAÇÃO PARA GRUPO DE WHATSAPP
    try {
      const grupoWhatsApp = Deno.env.get('WHATSAPP_GROUP_ID_ABERTURA') || '120363401267232313-group';
      
      const { ZApiClient } = await import("./chat.tsx");
      const zapi = new ZApiClient();
      
      const mensagem = `⚠️NOVO CHAMADO ABERTO⚠️\n\n` +
        `*Proprietario:* ${body.proprietario}\n` +
        `*CPF:* ${body.cpf}\n` +
        `*Telefone:* ${body.telefone}\n` +
        `*E-mail:* ${body.email}\n` +
        `*Bloco - Apt:* ${body.bloco}-${body.unidade}\n` +
        `*Empreendimento:* ${body.empreendimento}\n\n` +
        `*Categoria do reparo:* ${body.categoria_reparo}\n` +
        `*Descrição do problema:* ${body.descricao_cliente}`;
      
      const buttonActions = [{ id: "1", type: "URL", url: "https://connect.eonbr.com", label: "Ver chamado" }];
      
      if (body.url_foto) {
        const resultadoFoto = await zapi.sendImageWithButtonsToGroup(grupoWhatsApp, body.url_foto, mensagem, buttonActions);
        if (!resultadoFoto.success) {
          await zapi.sendMessageToGroup(grupoWhatsApp, mensagem);
        }
      } else {
        await zapi.sendMessageToGroup(grupoWhatsApp, mensagem);
      }
    } catch (errorWhatsApp) {
      console.error('❌ Erro WhatsApp (não crítico):', errorWhatsApp);
    }

    // 🤖 ANÁLISE GPT AUTOMÁTICA
    import("./openai.tsx").then(({ analisarChamadoAutomatico }) => {
      analisarChamadoAutomatico({
        id: data.id,
        descricao_cliente: body.descricao_cliente,
        categoria_reparo: body.categoria_reparo,
        empreendimento: body.empreendimento,
        bloco: body.bloco,
        unidade: body.unidade,
        proprietario: body.proprietario,
      }).catch((err: any) => {
        console.error('⚠️ Erro GPT:', err);
      });
    }).catch((err: any) => {
      console.error('⚠️ Erro ao carregar openai:', err);
    });

    return c.json({
      success: true,
      data,
      message: 'Solicitação criada com sucesso!'
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📊 ENDPOINT dashboard-stats REMOVIDO
// ═══════════════════════════════════════════════════════════════════
// 🔥 REFATORAÇÃO: Dashboard agora processa dados diretamente das tabelas no frontend
// - Dados de Solicitações: SELECT direto da tabela "Assistência Técnica"
// - Dados de Finalizações: SELECT direto da tabela "assistencia_finalizada"
// Benefícios: Sem VIEWs, sem JOINs complexos, mais performance e consistência

// ═══════════════════════════════════════════════════════════════════
// 🚫 ROTA PARA DESQUALIFICAR ASSISTÊNCIA
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia/:id/desqualificar", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const motivo = body.motivo || '';
    const justificativa = body.justificativa || '';
    
    console.log(`🚫 Desqualificando assistência ${id} com motivo: ${motivo}`);
    if (justificativa) {
      console.log(`📝 Justificativa: ${justificativa}`);
    }
    
    const updateData: any = { 
      situacao: 'Desqualificado',
      motivo_desqualificado: motivo
    };
    
    // Adicionar justificativa se fornecida
    if (justificativa) {
      updateData.justificativa = justificativa;
    }
    
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao desqualificar assistência:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Assistência desqualificada com sucesso`);
    return c.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🔄 ROTA PARA REATIVAR ASSISTÊNCIA DESQUALIFICADA
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia/:id/reativar", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    console.log(`🔄 Reativando assistência ${id}...`);
    
    // Buscar dados atuais da assistência (🔧 FIX v6: select específico, sem url_foto base64)
    const { data: assistenciaAtual, error: errorBusca } = await supabase
      .from('Assistência Técnica')
      .select('id, situacao, status_chamado')
      .eq('id', id)
      .single();

    if (errorBusca || !assistenciaAtual) {
      console.error('❌ Assistência não encontrada:', errorBusca);
      return c.json({ error: 'Assistência não encontrada' }, 404);
    }

    if (assistenciaAtual.situacao !== 'Desqualificado') {
      console.error('❌ Assistência não está desqualificada');
      return c.json({ error: 'Apenas assistências desqualificadas podem ser reativadas' }, 400);
    }

    console.log(`📋 Status atual: ${assistenciaAtual.status_chamado}`);

    // Reativar assistência - volta para o status anterior
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .update({ 
        situacao: 'Ativo',
        motivo_desqualificado: null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao reativar assistência:', error);
      return c.json({ error: error.message, details: error }, 500);
    }

    console.log(`✅ Assistência reativada com sucesso! Voltou para: ${data.status_chamado}`);
    return c.json({ 
      success: true, 
      data,
      message: `Assistência reativada e voltou para a etapa: ${data.status_chamado}`
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🔄 ROTA PARA ATUALIZAR STATUS DE ASSISTÊNCIA
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia/:id/status", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    console.log(`📝 Atualizando status da assistência ${id} para: ${body.status_chamado}`);
    
    // 1. Buscar dados da assistência ANTES de atualizar (🔧 FIX v6: select específico)
    const { data: assistenciaAntes, error: errorBusca } = await supabase
      .from('Assistência Técnica')
      .select('id, status_chamado')
      .eq('id', id)
      .single();

    if (errorBusca || !assistenciaAntes) {
      console.error('❌ Assistência não encontrada:', errorBusca);
      return c.json({ error: 'Assistência não encontrada' }, 404);
    }
    
    // 2. Atualizar o status
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .update({ status_chamado: body.status_chamado })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar status:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Status atualizado com sucesso`);
    
    // 🔕 Notificações ao cliente desativadas (2025-01-19) - código removido para otimização de memória v3
    
    return c.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📸 ROTA PARA BUSCAR FOTO DE UMA ASSISTÊNCIA (LAZY LOADING)
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/assistencia/:id/foto", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    console.log(`📸 Buscando foto da assistência ${id}`);
    
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .select('url_foto')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar foto:', error);
      return c.json({ error: error.message }, 500);
    }

    if (!data?.url_foto) {
      console.log('⚠️ Assistência não possui foto');
      return c.json({ url_foto: null });
    }

    console.log(`✅ Foto encontrada (${Math.round(data.url_foto.length / 1024)} KB)`);
    return c.json({ url_foto: data.url_foto });
  } catch (error) {
    console.error('❌ Erro:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📅 ROTA PARA ATUALIZAR DATAS (VISTORIA/REPARO)
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia/:id/data", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    console.log(`📅 Atualizando data da assistência ${id}:`, body);
    
    const updateData: any = {};
    // 🌎 Garantir que a data seja salva no timezone de São Paulo
    // Se vier no formato "YYYY-MM-DD HH:MM:SS", adicionar o timezone explicitamente
    if (body.data_vistoria !== undefined) {
      const dataVistoria = body.data_vistoria;
      // 🔧 Verificar se já tem timezone (+ ou - seguido de números, ou Z no final)
      const temTimezone = /[+-]\d{2}:\d{2}|Z$/.test(dataVistoria);
      updateData.data_vistoria = temTimezone 
        ? dataVistoria 
        : `${dataVistoria}-03:00`;
      console.log(`📅 Data vistoria formatada: ${updateData.data_vistoria}`);
    }
    if (body.data_reparo !== undefined) {
      const dataReparo = body.data_reparo;
      // 🔧 Verificar se já tem timezone (+ ou - seguido de números, ou Z no final)
      const temTimezone = /[+-]\d{2}:\d{2}|Z$/.test(dataReparo);
      updateData.data_reparo = temTimezone 
        ? dataReparo 
        : `${dataReparo}-03:00`;
      console.log(`📅 Data reparo formatada: ${updateData.data_reparo}`);
    }
    
    const { data, error } = await supabase
      .from('Assistência Técnica')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar data:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Data atualizada com sucesso`);
    return c.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ✏️ ROTA PARA ATUALIZAR DADOS DE CONTATO (proprietario, cpf, email)
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia/:id/contato", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    console.log(`✏️ Atualizando dados de contato da assistência ${id}:`, body);

    // Dados de contato agora vivem na tabela "clientes" — buscar id_cliente da assistência
    const { data: assistencia, error: errAssist } = await supabase
      .from('Assistência Técnica')
      .select('id, id_cliente')
      .eq('id', id)
      .single();

    if (errAssist || !assistencia) {
      return c.json({ error: 'Assistência não encontrada' }, 404);
    }

    if (!assistencia.id_cliente) {
      return c.json({ error: 'Assistência sem cliente vinculado (id_cliente ausente)' }, 400);
    }

    const camposPermitidos = ['proprietario', 'cpf', 'email'];
    const updateData: Record<string, string> = {};

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined && body[campo] !== null) {
        updateData[campo] = String(body[campo]).trim();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'Nenhum campo válido enviado. Campos permitidos: proprietario, cpf, email' }, 400);
    }

    if (updateData.cpf) {
      const cpfLimpo = updateData.cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        return c.json({ error: 'CPF deve conter 11 dígitos' }, 400);
      }
    }

    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return c.json({ error: 'E-mail inválido' }, 400);
      }
    }

    if (updateData.proprietario && updateData.proprietario.length < 2) {
      return c.json({ error: 'Nome deve ter pelo menos 2 caracteres' }, 400);
    }

    // 🔧 Atualizar na tabela "clientes" (não mais em "Assistência Técnica")
    const { data, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id_cliente', assistencia.id_cliente)
      .select('id_cliente, proprietario, cpf, email')
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar contato no clientes:', error);
      return c.json({ error: `Erro ao atualizar dados de contato: ${error.message}` }, 500);
    }

    if (!data) {
      return c.json({ error: 'Cliente não encontrado' }, 404);
    }

    console.log(`✅ Contato atualizado para cliente #${assistencia.id_cliente} (assistência #${id}):`, updateData);
    return c.json({ 
      success: true, 
      data,
      message: `Dados de contato atualizados: ${Object.keys(updateData).join(', ')}`
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar contato:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📊 ROTA PARA ASSISTÊNCIAS FINALIZADAS (DASHBOARD)
// ═══════════════════════════════════════════════════════════════════

// Buscar finalização por ID da assistência técnica
app.get("/make-server-a8708d5d/assistencia-finalizada/by-assistencia/:id_assistencia", async (c) => {
  try {
    const id_assistencia = parseInt(c.req.param('id_assistencia'));
    
    console.log(`📊 Buscando finalização da assistência #${id_assistencia}...`);
    
    // 🔧 FIX v6: select específico (sem foto_reparo base64 que pode ter MBs)
    const { data, error } = await supabase
      .from('assistencia_finalizada')
      .select('id, id_assistencia, cpf_assistencia, responsaveis, providencias, nps, status, termo_assinado, reparo_avaliado, assinatura_vencida, created_at')
      .eq('id_assistencia', id_assistencia)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar finalização:', error);
      return c.json({ error: error.message, code: error.code }, 500);
    }

    if (!data || data.length === 0) {
      console.log(`⚠️ Nenhuma finalização encontrada para assistência #${id_assistencia}`);
      return c.json({ error: 'Finalização não encontrada' }, 404);
    }

    console.log(`✅ Finalização encontrada: ID ${data[0].id}`);
    return c.json({ data: data[0] });
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/make-server-a8708d5d/assistencia-finalizada", async (c) => {
  try {
    // 🔧 FIX v9: Respeitar query param ?status= para filtrar
    const statusFilter = c.req.query('status') || null;
    console.log(`📋 [GET /assistencia-finalizada] Filtro de status: ${statusFilter || 'TODOS'}`);

    // ═══════════════════════════════════════════════════════════════
    // 🔧 FIX v9: CAMINHO DIRETO para "Aguardando assinatura" (Kanban)
    // Consulta direto da assistencia_finalizada, pois o status_chamado
    // na Assistência Técnica pode ser 'Aguardando assinatura' OU 'Finalizado'
    // dependendo de quando o chamado foi criado (antes/depois do v8).
    // A assistencia_finalizada.status é a source of truth para este filtro.
    // ═══════════════════════════════════════════════════════════════
    if (statusFilter === 'Aguardando assinatura') {
      const { data: finalizacoes, error: errorFin } = await supabase
        .from('assistencia_finalizada')
        .select('id, id_assistencia, responsaveis, providencias, nps, status, termo_assinado, reparo_avaliado, assinatura_vencida, created_at')
        .eq('status', 'Aguardando assinatura')
        .order('created_at', { ascending: false });

      if (errorFin) {
        console.error('Erro ao buscar aguardando assinatura:', errorFin);
        return c.json({ error: errorFin.message }, 500);
      }

      const dataAguardando = (finalizacoes || []).map(fin => ({
        id: fin.id,
        id_assistencia: fin.id_assistencia,
        status: fin.status,
        responsaveis: fin.responsaveis || null,
        providencias: fin.providencias || null,
        nps: fin.nps || null,
        termo_assinado: fin.termo_assinado || false,
        reparo_avaliado: fin.reparo_avaliado || false,
        assinatura_vencida: fin.assinatura_vencida || false,
        created_at: fin.created_at,
      }));

      console.log(`✅ [GET /assistencia-finalizada] ${dataAguardando.length} registros "Aguardando assinatura" (direto de assistencia_finalizada)`);

      c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');

      return c.json({
        data: dataAguardando,
        pagination: {
          total: dataAguardando.length,
          returned: dataAguardando.length,
        },
        timestamp: new Date().toISOString()
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CAMINHO PADRÃO (Dashboard): source of truth = tabela assistencia_finalizada
    // Todos os dados de finalizações (Aguardando assinatura + Finalizado)
    // vêm exclusivamente da tabela assistencia_finalizada.
    // ═══════════════════════════════════════════════════════════════
    
    const { data: todasFinalizacoes, error: errorFinalizacoes } = await supabase
      .from('assistencia_finalizada')
      .select('id, id_assistencia, responsaveis, providencias, nps, status, termo_assinado, reparo_avaliado, assinatura_vencida, created_at')
      .order('created_at', { ascending: false });

    if (errorFinalizacoes) {
      console.error('Erro ao buscar assistencia_finalizada:', JSON.stringify(errorFinalizacoes));
      return c.json({ error: `Erro ao buscar dados: ${errorFinalizacoes.message || JSON.stringify(errorFinalizacoes)}` }, 500);
    }

    const dataMapeada = (todasFinalizacoes || []).map(fin => ({
      id: fin.id,
      id_assistencia: fin.id_assistencia,
      status: fin.status,
      responsaveis: fin.responsaveis || null,
      providencias: fin.providencias || null,
      nps: fin.nps || null,
      termo_assinado: fin.termo_assinado || false,
      reparo_avaliado: fin.reparo_avaliado || false,
      assinatura_vencida: fin.assinatura_vencida || false,
      created_at: fin.created_at,
    }));

    const totalFinalizados = dataMapeada.filter(d => d.status === 'Finalizado').length;
    const totalAguardando = dataMapeada.filter(d => d.status === 'Aguardando assinatura').length;

    console.log(`📊 [GET /assistencia-finalizada] Total=${dataMapeada.length}, Finalizados=${totalFinalizados}, Aguardando=${totalAguardando} (source: assistencia_finalizada)`);

    // Aplicar filtro de status genérico se fornecido
    const dataFiltrada = statusFilter
      ? dataMapeada.filter(item => item.status === statusFilter)
      : dataMapeada;

    console.log(`✅ [GET /assistencia-finalizada] ${dataFiltrada.length}/${dataMapeada.length} registros retornados (filtro: ${statusFilter || 'nenhum'})`);

    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    
    return c.json({
      data: dataFiltrada,
      pagination: {
        total: dataFiltrada.length,
        returned: dataFiltrada.length,
        totalSemFiltro: dataMapeada.length,
        totalFinalizados,
        totalAguardando,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro geral em GET /assistencia-finalizada:', error);
    return c.json({ error: `Erro interno do servidor em GET /assistencia-finalizada: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ✅ ROTA PARA FINALIZAR ASSISTÊNCIA (CRIAR REGISTRO)
// ═══════════════════════════════════════════════════════════════════

app.post("/make-server-a8708d5d/assistencia-finalizada/:id", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    console.log(`✅ Finalizando assistência ${id}...`);
    console.log('Dados recebidos:', {
      responsaveis: body.responsaveis,
      itens_reparo: body.itens_reparo,
      providencias_length: body.providencias?.length || 0,
      foto_length: body.foto_reparo?.length || 0,
      nps: body.nps,
      cpf_assistencia: body.cpf_assistencia,
    });
    
    // 1. Buscar dados da assistência original (🔧 JOIN com clientes via id_cliente)
    const { data: assistenciaRaw, error: errorBusca } = await supabase
      .from('Assistência Técnica')
      .select('id, id_cliente, categoria_reparo, descricao_cliente, status_chamado, situacao, clientes!id_cliente(proprietario, cpf, telefone, email, bloco, unidade, empreendimento)')
      .eq('id', id)
      .single();

    if (errorBusca || !assistenciaRaw) {
      console.error('❌ Erro ao buscar assistência:', errorBusca);
      return c.json({ error: 'Assistência não encontrada', details: errorBusca?.message }, 404);
    }

    const assistenciaOriginal = flattenClientes(assistenciaRaw);
    console.log('✅ Assistência encontrada:', assistenciaOriginal.proprietario);

    // 2. Inserir na tabela assistencia_finalizada PRIMEIRO (para obter o id_finalizacao)
    console.log('📝 Criando registro de assistência finalizada...');
    
    const dadosParaInserir: any = {
      id_assistencia: id,
      cpf_assistencia: assistenciaOriginal.cpf,
      responsaveis: body.responsaveis,
      providencias: body.providencias,
      foto_reparo: body.foto_reparo,
      nps: body.nps,
      status: 'Aguardando assinatura',
      termo_assinado: false,
      reparo_avaliado: false,
      created_at: new Date().toISOString(),
    };
    
    console.log('📝 Dados a inserir em assistencia_finalizada:', Object.keys(dadosParaInserir));
    
    const { data: assistenciaFinalizada, error: errorFinalizada } = await supabase
      .from('assistencia_finalizada')
      .insert([dadosParaInserir])
      .select()
      .single();

    if (errorFinalizada) {
      console.error('❌ Erro ao criar assistência finalizada:', errorFinalizada);
      return c.json({ error: 'Erro ao finalizar assistência', details: errorFinalizada.message }, 500);
    }

    console.log('✅ Assistência finalizada criada:', assistenciaFinalizada.id);

    // 3. Inserir na tabela itens_utilizados_posobra (AGORA com id_finalizacao e empreendimento)
    if (body.itens_reparo && Array.isArray(body.itens_reparo) && body.itens_reparo.length > 0) {
      console.log(`📦 Processando ${body.itens_reparo.length} itens de reparo...`);
      console.log('📦 BODY itens_reparo RECEBIDO:', JSON.stringify(body.itens_reparo, null, 2));
      
      // Filtrar itens que NÃO são "Nenhum material"
      const itensComMaterial = body.itens_reparo.filter((item: any) => 
        item.material && item.material !== 'Nenhum material'
      );
      
      if (itensComMaterial.length > 0) {
        console.log(`📦 Inserindo ${itensComMaterial.length} itens utilizados no pós-obra...`);
        
        const itensParaInserir = itensComMaterial.map((item: any) => ({
          material_utilizado: item.material, // ✅ CORRIGIDO: Campo correto no banco
          medida: item.unidade, // ✅ CORRIGIDO: Campo correto no banco
          quantidade: parseFloat(item.quantidade) || 0,
          Empreendimento: assistenciaOriginal.empreendimento, // ✅ Campo adicionado
          id_finalizacao: assistenciaFinalizada.id, // ✅ Campo adicionado (ID da finalização)
        }));

        console.log('📦 Itens MAPEADOS para inserir:', JSON.stringify(itensParaInserir, null, 2));

        const { error: errorItens } = await supabase
          .from('itens_utilizados_posobra')
          .insert(itensParaInserir);

        if (errorItens) {
          console.error('❌ Erro ao inserir itens utilizados:', errorItens);
          console.error('Detalhes do erro:', errorItens.message, errorItens.details, errorItens.hint);
          console.warn('⚠️ Continuando com a finalização mesmo com erro nos itens...');
        } else {
          console.log(`✅ ${itensComMaterial.length} itens utilizados salvos com sucesso (com empreendimento e id_finalizacao)`);
        }
      } else {
        console.log('ℹ️ Nenhum material utilizado (selecionado "Nenhum material")');
      }
    } else {
      console.log('ℹ️ Nenhum item de reparo para inserir');
    }

    // 4. Atualizar status da assistência original para 'Finalizado' e situação para 'Inativo'
    console.log('🔄 Atualizando assistência original...');
    
    const { error: errorUpdate } = await supabase
      .from('Assistência Técnica')
      .update({
        status_chamado: 'Finalizado',
        situacao: 'Inativo'
      })
      .eq('id', id);

    if (errorUpdate) {
      console.error('❌ Erro ao atualizar assistência original:', errorUpdate);
      // Não retornamos erro aqui pois a finalização já foi salva
    } else {
      console.log('✅ Assistência original atualizada para Finalizado/Inativo');
    }

    // 5. 📱 ENVIAR NOTIFICAÇÃO PARA GRUPO DE WHATSAPP
    console.log('───────────────────────────────────────────────────────');
    console.log('📱 ETAPA 5: Enviando notificação para grupo de WhatsApp...');
    
    try {
      // ID do grupo de WhatsApp (pode ser sobrescrito por variável de ambiente)
      const grupoWhatsApp = Deno.env.get('WHATSAPP_GROUP_ID_FINALIZACAO') || '120363401267232313-group';
      
      console.log(`📱 ID do grupo configurado: ${grupoWhatsApp}`);
      
      // 🔥 LAZY: ZApiClient carregado sob demanda
      const { ZApiClient } = await import("./chat.tsx");
      const zapi = new ZApiClient();
      
      // Formatar mensagem seguindo o template exato
      const mensagem = `✅CHAMADO CONCLUÍDO✅

` +
        `*Proprietário:* ${assistenciaOriginal.proprietario}
` +
        `*Telefone:* ${assistenciaOriginal.telefone}
` +
        `*Bloco - Apt:* ${assistenciaOriginal.bloco}-${assistenciaOriginal.unidade}
` +
        `*Empreendimento:* ${assistenciaOriginal.empreendimento}
` +
        `*Providencias tomadas:* ${body.providencias}

` +
        `*Responsável BP:* ${body.responsaveis.join(' e ')}
` +
        `*NPS de atendimento:* ${body.nps}`;
      
      // Tentar enviar a foto primeiro (se houver)
      if (body.foto_reparo) {
        console.log('📸 Enviando foto do reparo para o grupo...');
        const resultadoFoto = await zapi.sendImageToGroup(
          grupoWhatsApp,
          body.foto_reparo,
          mensagem
        );
        
        if (resultadoFoto.success) {
          console.log(`✅ Foto enviada para grupo com sucesso! Message ID: ${resultadoFoto.messageId}`);
        } else {
          console.error('❌ Erro ao enviar foto para grupo:', resultadoFoto.error);
          // Se falhar ao enviar foto, tenta enviar só o texto
          console.log('📝 Tentando enviar apenas texto...');
          const resultadoTexto = await zapi.sendMessageToGroup(grupoWhatsApp, mensagem);
          if (resultadoTexto.success) {
            console.log(`✅ Mensagem de texto enviada para grupo! Message ID: ${resultadoTexto.messageId}`);
          } else {
            console.error('❌ Erro ao enviar mensagem de texto para grupo:', resultadoTexto.error);
          }
        }
      } else {
        // Se não houver foto, envia apenas o texto
        console.log('📝 Enviando mensagem de texto para o grupo...');
        const resultadoTexto = await zapi.sendMessageToGroup(grupoWhatsApp, mensagem);
        if (resultadoTexto.success) {
          console.log(`✅ Mensagem enviada para grupo com sucesso! Message ID: ${resultadoTexto.messageId}`);
        } else {
          console.error('❌ Erro ao enviar mensagem para grupo:', resultadoTexto.error);
        }
      }
    } catch (errorWhatsApp) {
      console.error('❌ Erro ao enviar notificação para WhatsApp:', errorWhatsApp);
      console.warn('⚠️ Continuando com a finalização mesmo com erro no WhatsApp...');
    }
    console.log('───────────────────────────────────────────────────────');

    return c.json({
      success: true,
      message: 'Assistência finalizada com sucesso!',
      data: assistenciaFinalizada
    });
  } catch (error) {
    console.error('❌ Erro geral ao finalizar assistência:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📝 ROTA PARA ATUALIZAR ASSISTÊNCIA FINALIZADA (WEBHOOK CLICKSIGN)
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia-finalizada/:id", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    console.log(`📝 Atualizando assistência finalizada #${id}...`);
    console.log('Dados recebidos:', body);
    
    // Montar objeto de atualização apenas com campos fornecidos
    const updateData: any = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.termo_assinado !== undefined) updateData.termo_assinado = body.termo_assinado;
    if (body.reparo_avaliado !== undefined) updateData.reparo_avaliado = body.reparo_avaliado;
    
    console.log('📝 Campos a atualizar:', Object.keys(updateData));
    
    // Atualizar registro na tabela assistencia_finalizada
    const { data, error } = await supabase
      .from('assistencia_finalizada')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar assistência finalizada:', error);
      return c.json({ 
        success: false,
        error: error.message, 
        code: error.code 
      }, 500);
    }

    if (!data) {
      console.error('❌ Assistência finalizada não encontrada');
      return c.json({ 
        success: false,
        error: 'Assistência finalizada não encontrada' 
      }, 404);
    }

    console.log('✅ Assistência finalizada atualizada com sucesso');
    
    // Se o status foi alterado para "Finalizado", atualizar a assistência original também
    if (body.status === 'Finalizado') {
      console.log('🔄 Atualizando assistência original para status Finalizado...');
      
      const { error: errorUpdateOriginal } = await supabase
        .from('Assistência Técnica')
        .update({
          status_chamado: 'Finalizado',
          situacao: 'Inativo'
        })
        .eq('id', data.id_assistencia);
      
      if (errorUpdateOriginal) {
        console.error('❌ Erro ao atualizar assistência original:', errorUpdateOriginal);
        console.warn('⚠️ Assistência finalizada atualizada, mas assistência original não foi atualizada');
      } else {
        console.log('✅ Assistência original atualizada para Finalizado/Inativo');
      }
    }

    return c.json({
      success: true,
      message: 'Assistência finalizada atualizada com sucesso',
      data
    });
  } catch (error) {
    console.error('❌ Erro geral ao atualizar assistência finalizada:', error);
    return c.json({ 
      success: false,
      error: String(error) 
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ✅ ROTA PARA FINALIZAR AUTOMATICAMENTE APÓS 7 DIAS (ASSINATURA VENCIDA)
// ═══════════════════════════════════════════════════════════════════

app.patch("/make-server-a8708d5d/assistencia-finalizada/:id/finalizar-vencida", async (c) => {
  try {
    const idFinalizacao = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    
    console.log(`✅ Finalizando assistência #${idFinalizacao} (assinatura vencida)...`);
    
    // 1️⃣ Buscar dados da finalização para pegar o id_assistencia
    const { data: finalizacao, error: errorBusca } = await supabase
      .from('assistencia_finalizada')
      .select('id, id_assistencia, status, created_at')
      .eq('id', idFinalizacao)
      .single();
    
    if (errorBusca || !finalizacao) {
      console.error('❌ Assistência finalizada não encontrada:', errorBusca);
      return c.json({ 
        success: false,
        error: 'Registro de finalização não encontrado' 
      }, 404);
    }
    
    console.log(`📋 Dados da finalização:`, finalizacao);
    
    // Nota: não bloqueia se já finalizada - permite re-salvar o PDF

    // 2️⃣ Salvar PDF no Supabase Storage (se enviado)
    let pdfUrl: string | null = null;
    let pdfPath: string | null = null;

    if (body.pdf_base64 && body.pdf_filename) {
      console.log(`📄 Salvando PDF: ${body.pdf_filename} (${(body.pdf_base64.length * 0.75 / 1024).toFixed(1)} KB)...`);
      
      // Garantir que o bucket existe (lazy)
      await ensureBucketExists();
      
      // Converter base64 para Uint8Array
      const binaryString = atob(body.pdf_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload para o bucket
      pdfPath = `finalizacao-${idFinalizacao}/${body.pdf_filename}`;
      
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_TERMOS)
        .upload(pdfPath, bytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('❌ Erro ao fazer upload do PDF:', uploadError);
        return c.json({
          success: false,
          error: 'Erro ao salvar PDF: ' + uploadError.message
        }, 500);
      }

      // Gerar URL assinada (válida por 1 ano)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(BUCKET_TERMOS)
        .createSignedUrl(pdfPath, 365 * 24 * 60 * 60); // 1 ano

      if (signedUrlError) {
        console.error('❌ Erro ao gerar URL assinada:', signedUrlError);
      } else {
        pdfUrl = signedUrlData.signedUrl;
      }

      console.log(`✅ PDF salvo com sucesso: ${pdfPath}`);
    }
    
    // 3️⃣ Atualizar tabela assistencia_finalizada (apenas marcar assinatura vencida, sem mudar status — status muda ao enviar ao Sienge)
    console.log(`📝 Atualizando assistencia_finalizada #${idFinalizacao} (assinatura_vencida=true)...`);
    const updateData: any = {
      assinatura_vencida: true,
    };
    
    // Atualizar registro existente em termos_assistencia com o PDF da vencida (carimbo de aceitação tácita)
    // O registro original já foi criado na finalização do chamado (fluxo Clicksign)
    let termoRecord: any = null;
    if (pdfPath) {
      try {
        // Primeiro, tentar atualizar registro existente
        const { data: existingTermo } = await supabase
          .from('termos_assistencia')
          .select('id')
          .eq('id_finalizacao', idFinalizacao)
          .maybeSingle();

        if (existingTermo) {
          // Registro já existe — salvar PDF vencida no campo separado
          const { data: termoData, error: termoError } = await supabase
            .from('termos_assistencia')
            .update({
              pdf_storage_path_vencida: pdfPath,
              tipo_finalizacao: 'vencida',
              finalizado_em: new Date().toISOString(),
            })
            .eq('id', existingTermo.id)
            .select()
            .single();

          if (termoError) {
            console.error('❌ Erro ao atualizar termos_assistencia:', termoError);
          } else {
            termoRecord = termoData;
            console.log(`✅ termos_assistencia atualizado: id=${termoData.id}, pdf_vencida=${pdfPath}`);
          }
        } else {
          // Registro não existe (caso legado) — criar com ambos os campos
          const { data: termoData, error: termoError } = await supabase
            .from('termos_assistencia')
            .insert({
              id_solicitacao: finalizacao.id_assistencia,
              id_finalizacao: idFinalizacao,
              pdf_storage_path: pdfPath,
              pdf_storage_path_vencida: pdfPath,
              pdf_bucket: BUCKET_TERMOS,
              tipo_finalizacao: 'vencida',
              finalizado_em: new Date().toISOString(),
            })
            .select()
            .single();

          if (termoError) {
            console.error('❌ Erro ao criar termos_assistencia:', termoError);
          } else {
            termoRecord = termoData;
            console.log(`✅ termos_assistencia criado (legado): id=${termoData.id}, path=${pdfPath}`);
          }
        }
      } catch (termoErr) {
        console.error('❌ Erro inesperado ao salvar em termos_assistencia:', termoErr);
      }
    }

    const { error: errorUpdateFinalizada } = await supabase
      .from('assistencia_finalizada')
      .update(updateData)
      .eq('id', idFinalizacao);
    
    if (errorUpdateFinalizada) {
      console.error('❌ Erro ao atualizar assistencia_finalizada:', errorUpdateFinalizada);
      return c.json({ 
        success: false,
        error: 'Erro ao atualizar registro de finalização: ' + errorUpdateFinalizada.message
      }, 500);
    }
    
    console.log('✅ assistencia_finalizada atualizada com sucesso');
    
    // 4️⃣ Status da Assistência Técnica NÃO é alterado aqui — permanece "Aguardando assinatura"
    // A mudança para "Finalizado" ocorrerá quando o termo for enviado ao Sienge
    
    console.log('🎉 Termo PDF salvo com sucesso! Card permanece na esteira.');
    
    return c.json({
      success: true,
      message: 'Termo PDF salvo com sucesso',
      pdf_url: pdfUrl,
      pdf_path: pdfPath,
      termo_id: termoRecord?.id || null,
    });
    
  } catch (error) {
    console.error('❌ Erro geral ao finalizar assistência vencida:', error);
    return c.json({ 
      success: false,
      error: 'Erro ao processar finalização: ' + String(error)
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📄 ROTA PARA OBTER URL ASSINADA DO PDF DO TERMO
// ═══════════════════════════════════════════════════════════════════

// Buscar foto_reparo de uma finalização por ID
app.get("/make-server-a8708d5d/assistencia-finalizada/:id/foto-reparo", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    console.log(`📸 Buscando foto_reparo da finalização #${id}...`);

    const { data, error } = await supabase
      .from('assistencia_finalizada')
      .select('foto_reparo')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar foto_reparo:', error);
      return c.json({ error: error.message }, 500);
    }

    if (!data || !data.foto_reparo) {
      return c.json({ foto_reparo: null }, 404);
    }

    return c.json({ foto_reparo: data.foto_reparo });
  } catch (error) {
    console.error('❌ Erro na rota foto-reparo:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-a8708d5d/assistencia-finalizada/:id/termo-pdf", async (c) => {
  try {
    const idFinalizacao = parseInt(c.req.param('id'));
    
    console.log(`📄 Buscando PDF do termo para finalização #${idFinalizacao}...`);
    
    // Buscar o registro na tabela termos_assistencia
    const { data: termoRecord, error: termoError } = await supabase
      .from('termos_assistencia')
      .select('id, id_finalizacao, id_solicitacao, pdf_storage_path, pdf_storage_path_assinado, pdf_storage_path_vencida, pdf_bucket, enviado_sienge, data_envio_sienge')
      .eq('id_finalizacao', idFinalizacao)
      .maybeSingle();

    if (termoError) {
      console.error('❌ Erro ao consultar termos_assistencia:', termoError);
      return c.json({ success: false, error: 'Erro ao consultar termo' }, 500);
    }

    if (!termoRecord) {
      console.log(`ℹ️ Nenhum termo salvo para finalização #${idFinalizacao}`);
      return c.json({ success: false, error: 'Nenhum PDF associado a este termo' }, 404);
    }

    // Prioridade: assinado (Clicksign) > vencida (carimbo) > original
    const pdfPath = termoRecord.pdf_storage_path_assinado
      || termoRecord.pdf_storage_path_vencida
      || termoRecord.pdf_storage_path;
    const bucket = termoRecord.pdf_bucket || BUCKET_TERMOS;
    
    if (!pdfPath) {
      return c.json({ success: false, error: 'Registro encontrado mas sem caminho do PDF' }, 404);
    }
    
    // Gerar URL assinada (válida por 1 hora)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(pdfPath, 3600); // 1 hora
    
    if (signedUrlError) {
      console.error('❌ Erro ao gerar URL assinada:', signedUrlError);
      return c.json({ success: false, error: 'Erro ao gerar URL do PDF: ' + signedUrlError.message }, 500);
    }
    
    return c.json({
      success: true,
      pdf_url: signedUrlData.signedUrl,
      pdf_path: pdfPath,
      termo_id: termoRecord.id,
      id_solicitacao: termoRecord.id_solicitacao,
      id_finalizacao: termoRecord.id_finalizacao,
      enviado_sienge: termoRecord.enviado_sienge,
      data_envio_sienge: termoRecord.data_envio_sienge,
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar PDF do termo:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// 🔥 OTIMIZAÇÃO v7: Rotas Sienge (enviar-sienge + finalizar-manual) movidas para ./sienge.tsx (lazy-loaded)

// ══════════════════════════════════════════════════════════════════
// 🔍 ROTA DE DEBUG - Ver dados da tabela itens_utilizados_posobra
// ══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/debug/itens-posobra", async (c) => {
  try {
    console.log('🔍 DEBUG: Buscando itens da tabela itens_utilizados_posobra...');
    
    // 🔧 FIX v6: select específico + removido .order('id')
    const { data, error } = await supabase
      .from('itens_utilizados_posobra')
      .select('material_utilizado, medida, quantidade, Empreendimento, id_finalizacao, created_at')
      .limit(10);

    if (error) {
      console.error('❌ Erro ao buscar itens:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ ${data?.length || 0} itens encontrados`);
    console.log('📦 Primeiros registros:', JSON.stringify(data, null, 2));

    return c.json({ 
      success: true,
      total: data?.length || 0,
      data 
    });
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// 👥 ROTAS DE GERENCIAMENTO DE USUÁRIOS
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/users/all", async (c) => {
  try {
    console.log('📊 Buscando usuários...');
    
    const { data, error } = await queryWithTimeout(
      supabase
        .from('User')
        .select('id, nome, email, cpf, telefone, idempresa, nivel_permissao, created_at, ativo, menu_assistencia, menu_gerenciamento, menu_planejamento, menu_cadastro, menu_notificacoes, permissions')
        .order('created_at', { ascending: false })
        .limit(50) // MÁXIMO ABSOLUTO: 50 usuários
    );

    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      return c.json({ error: 'Erro ao carregar dados', users: [] }, 500);
    }

    console.log(`✅ ${data?.length || 0} usuários retornados`);
    return c.json({ users: data || [] });
  } catch (error: any) {
    console.error('❌ Erro geral ao buscar usuários:', error);
    
    // Não expor detalhes técnicos para evitar exploração
    const message = error?.message?.includes('timeout') 
      ? 'Tempo esgotado. O servidor está demorando para responder.'
      : 'Erro temporário. Tente novamente em instantes.';
      
    return c.json({ 
      error: message, 
      users: [] 
    }, 500);
  }
});

app.get("/make-server-a8708d5d/users/me", async (c) => {
  try {
    const authUuid = c.req.query('authUuid');
    
    if (!authUuid) {
      console.error('❌ authUuid não fornecido');
      return c.json({ error: 'Parâmetro authUuid é obrigatório' }, 400);
    }
    
    console.log(`👤 Buscando usuário com authUuid: ${authUuid}`);
    
    // TENTATIVA 1: Buscar por auth_user_id
    let result = await queryWithTimeout(
      supabase
        .from('User')
        .select('id, nome, email, auth_user_id, ativo, menu_assistencia, menu_gerenciamento, menu_planejamento, menu_cadastro, menu_notificacoes, permissions')
        .eq('auth_user_id', authUuid)
        .maybeSingle()
    );
    
    if (result.error && result.error.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar usuário:', result.error);
      return c.json({ error: 'Erro ao buscar dados do usuário' }, 500);
    }
    
    let userData = result.data;
    
    // TENTATIVA 2: Se não encontrou por auth_user_id, buscar por email
    if (!userData) {
      const email = c.req.query('email');
      
      if (email) {
        console.log(`🔄 Tentando buscar por email: ${email}`);
        
        result = await queryWithTimeout(
          supabase
            .from('User')
            .select('id, nome, email, auth_user_id, ativo, menu_assistencia, menu_gerenciamento, menu_planejamento, menu_cadastro, menu_notificacoes, permissions')
            .eq('email', email)
            .maybeSingle()
        );
        
        if (result.error && result.error.code !== 'PGRST116') {
          console.error('❌ Erro ao buscar por email:', result.error);
          return c.json({ error: 'Erro ao buscar dados do usuário' }, 500);
        }
        
        userData = result.data;
        
        // Se encontrou, atualizar auth_user_id
        if (userData) {
          console.log(`🔧 Atualizando auth_user_id para usuário ${userData.id}`);
          
          await queryWithTimeout(
            supabase
              .from('User')
              .update({ auth_user_id: authUuid })
              .eq('id', userData.id)
          ).catch(err => {
            console.warn('⚠️ Não foi possível atualizar auth_user_id:', err);
          });
        }
      }
    }
    
    if (!userData) {
      console.warn('⚠️ Usuário não encontrado');
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    console.log(`✅ Usuário encontrado: ${userData.nome} (${userData.email})`);
    return c.json({ user: userData });
    
  } catch (error: any) {
    console.error('❌ Erro geral ao buscar usuário:', error);
    
    const message = error?.message?.includes('timeout') 
      ? 'Tempo esgotado ao buscar dados do usuário'
      : 'Erro ao processar solicitação';
      
    return c.json({ error: message }, 500);
  }
});

app.patch("/make-server-a8708d5d/users/:id/permissions", async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    console.log(`📝 Atualizando permissões do usuário ${id}:`, body);
    
    // Validar que ao menos um campo foi enviado
    if (Object.keys(body).length === 0) {
      console.error('❌ Nenhum campo para atualizar');
      return c.json({ error: 'Nenhum campo para atualizar' }, 400);
    }
    
    const updateData: any = {};
    if (body.menu_assistencia !== undefined) updateData.menu_assistencia = body.menu_assistencia;
    if (body.menu_gerenciamento !== undefined) updateData.menu_gerenciamento = body.menu_gerenciamento;
    if (body.menu_planejamento !== undefined) updateData.menu_planejamento = body.menu_planejamento;
    if (body.menu_cadastro !== undefined) updateData.menu_cadastro = body.menu_cadastro;
    if (body.menu_notificacoes !== undefined) updateData.menu_notificacoes = body.menu_notificacoes;
    if (body.ativo !== undefined) updateData.ativo = body.ativo;

    // Novo: permissions JSONB. Quando enviado, sincroniza as colunas menu_* legadas
    // a partir do campo .view de cada menu, mantendo compatibilidade.
    if (body.permissions !== undefined && body.permissions !== null && typeof body.permissions === 'object') {
      updateData.permissions = body.permissions;
      const p = body.permissions;
      updateData.menu_assistencia = p?.assistencia?.view === true;
      updateData.menu_gerenciamento = p?.gerenciamento?.view === true;
      updateData.menu_planejamento = p?.planejamento?.view === true;
      updateData.menu_cadastro = p?.cadastros?.view === true;
      updateData.menu_notificacoes = p?.notificacoes?.view === true;
    }
    
    console.log(`📝 Dados para atualizar:`, updateData);
    
    const { data, error } = await queryWithTimeout(
      supabase
        .from('User')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    );

    if (error) {
      console.error('❌ Erro ao atualizar permissões:', error);
      // Não expor detalhes técnicos
      return c.json({ 
        error: 'Erro ao atualizar dados'
      }, 500);
    }

    if (!data) {
      console.error('❌ Usuário não encontrado');
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }

    console.log(`✅ Permissões atualizadas com sucesso:`, data);
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Erro geral ao atualizar permissões:', error);
    
    const message = error?.message?.includes('timeout') 
      ? 'Tempo esgotado ao salvar dados'
      : 'Erro ao processar solicitação';
      
    return c.json({ error: message }, 500);
  }
});

// 🔥 FIX v6: Endpoint /assistencias-historico REMOVIDO (código morto - duplicava /assistencias-finalizadas + /assistencias-desqualificadas)
// O frontend usa os endpoints separados /assistencias-finalizadas e /assistencias-desqualificadas diretamente

// ═══════════════════════════════════════════════════════════════════
// ✅ HISTÓRICO DE ASSISTÊNCIAS FINALIZADAS (ENDPOINT OTIMIZADO)
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/assistencias-finalizadas", async (c) => {
  try {
    // 🔧 FIX v8: Source of truth = tabela "Assistência Técnica"
    // Finalizados = status_chamado='Finalizado' AND situacao='Inativo'
    // 🔧 JOIN com clientes via id_cliente (dados do cliente agora vivem na tabela clientes)
    const { data: assistenciasRaw, error: errorAssistencias } = await supabase
      .from('Assistência Técnica')
      .select('id, id_cliente, categoria_reparo, descricao_cliente, status_chamado, situacao, idempresa, created_at, Empresa(nome), clientes!id_cliente(proprietario, telefone, email, bloco, unidade, empreendimento, cpf)')
      .eq('status_chamado', 'Finalizado')
      .eq('situacao', 'Inativo')
      .order('created_at', { ascending: false });
    
    const assistencias = flattenClientesArray(assistenciasRaw || []);
    
    if (errorAssistencias) {
      console.error('Erro ao buscar finalizados:', errorAssistencias);
      return c.json({ error: errorAssistencias.message, historico: [] }, 500);
    }

    // 2️⃣ Buscar dados de finalização (assistencia_finalizada) para enriquecimento
    const idsAssistencias = (assistencias || []).map(a => a.id).filter(Boolean);
    
    let finalizacaoMap = new Map<number, any>();
    let idsFinalizacao: number[] = [];
    
    if (idsAssistencias.length > 0) {
      const { data: finalizacoes, error: errorFinalizacoes } = await supabase
        .from('assistencia_finalizada')
        .select('id, id_assistencia, responsaveis, providencias, nps, status, termo_assinado, reparo_avaliado, assinatura_vencida, created_at')
        .in('id_assistencia', idsAssistencias);
      
      if (!errorFinalizacoes && finalizacoes) {
        finalizacoes.forEach(f => {
          finalizacaoMap.set(f.id_assistencia, f);
          idsFinalizacao.push(f.id);
        });
      }
    }

    // 3️⃣ Buscar insumos utilizados
    let insumosUtilizados: any[] = [];
    if (idsFinalizacao.length > 0) {
      const { data: insumos, error: errorInsumos } = await supabase
        .from('itens_utilizados_posobra')
        .select('id_finalizacao, material_utilizado, medida, quantidade, Empreendimento')
        .in('id_finalizacao', idsFinalizacao);
      
      if (errorInsumos) {
        console.error('❌ Erro ao buscar insumos utilizados:', errorInsumos);
      } else {
        insumosUtilizados = insumos || [];
      }
    }

    console.log(`📦 ${insumosUtilizados.length} insumos utilizados encontrados`);

    // 4️⃣ Buscar registros de termos (PDFs) da tabela termos_assistencia
    const termosMap = new Map<number, any>();
    if (idsFinalizacao.length > 0) {
      const { data: termos, error: errorTermos } = await supabase
        .from('termos_assistencia')
        .select('id, id_finalizacao, id_solicitacao, pdf_storage_path, enviado_sienge, data_envio_sienge')
        .in('id_finalizacao', idsFinalizacao);
      
      if (errorTermos) {
        console.error('❌ Erro ao buscar termos de assistência:', errorTermos);
      } else {
        (termos || []).forEach((t: any) => termosMap.set(t.id_finalizacao, t));
        console.log(`📄 ${termos?.length || 0} termos de assistência encontrados`);
      }
    }

    // Criar mapa de insumos agrupados por id_finalizacao
    const insumosMap = new Map<number, any[]>();
    insumosUtilizados.forEach(insumo => {
      const idFin = insumo.id_finalizacao;
      if (!insumosMap.has(idFin)) {
        insumosMap.set(idFin, []);
      }
      insumosMap.get(idFin)!.push(insumo);
    });

    // 5️⃣ Montar resposta (source of truth: Assistência Técnica + enriquecimento: assistencia_finalizada)
    const finalizadosCompleto = (assistencias || []).map((assistencia) => {
      const finalizacao = finalizacaoMap.get(assistencia.id);
      const idFin = finalizacao?.id;
      const insumosDaFinalizacao = idFin ? (insumosMap.get(idFin) || []) : [];
      const termoInfo = idFin ? termosMap.get(idFin) : null;
      
      return {
        id: `finalizado-${idFin || assistencia.id}`,
        id_assistencia: assistencia.id,
        id_finalizacao: idFin || null,
        cpf_assistencia: assistencia.cpf,
        responsaveis: finalizacao?.responsaveis || null,
        providencias: finalizacao?.providencias || null,
        nps: finalizacao?.nps || null,
        status: 'Finalizado',
        termo_assinado: finalizacao?.termo_assinado || false,
        reparo_avaliado: finalizacao?.reparo_avaliado || false,
        assinatura_vencida: finalizacao?.assinatura_vencida || false,
        created_at: finalizacao?.created_at || assistencia.created_at,
        data_abertura: assistencia.created_at,
        termo_pdf_path: termoInfo?.pdf_storage_path || null,
        termo_id: termoInfo?.id || null,
        enviado_sienge: termoInfo?.enviado_sienge || false,
        data_envio_sienge: termoInfo?.data_envio_sienge || null,
        itens_reparo: insumosDaFinalizacao.map(insumo => ({
          material: insumo.material_utilizado,
          medida: insumo.medida,
          quantidade: insumo.quantidade,
          Empreendimento: insumo.Empreendimento
        })),
        assistencia: {
          id: assistencia.id,
          proprietario: assistencia.proprietario,
          telefone: assistencia.telefone,
          email: assistencia.email,
          bloco: assistencia.bloco,
          unidade: assistencia.unidade,
          categoria_reparo: assistencia.categoria_reparo,
          descricao_problema: assistencia.descricao_cliente,
          created_at: assistencia.created_at,
          empreendimento: assistencia.empreendimento,
          idempresa: assistencia.idempresa,
          empresa_nome: assistencia.Empresa?.nome || null,
          status_chamado: 'Finalizado',
        }
      };
    });

    console.log(`✅ ${finalizadosCompleto.length} registros finalizados retornados (source: Assistência Técnica)`);
    console.log(`📦 Total de insumos incluídos: ${insumosUtilizados.length}`);
    
    return c.json({ 
      historico: finalizadosCompleto,
      meta: {
        total: finalizadosCompleto.length,
        insumosTotal: insumosUtilizados.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar finalizadas:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error), 
      historico: [] 
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ❌ HISTÓRICO DE ASSISTÊNCIAS DESQUALIFICADAS (ENDPOINT OTIMIZADO)
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/assistencias-desqualificadas", async (c) => {
  try {
    // 🔧 JOIN com clientes via id_cliente (dados do cliente agora vivem na tabela clientes)
    const { data: desqualificadosRaw, error: errorDesqualificados } = await supabase
      .from('Assistência Técnica')
      .select('id, id_cliente, categoria_reparo, descricao_cliente, idempresa, status_chamado, situacao, motivo_desqualificado, justificativa, created_at, Empresa(nome), clientes!id_cliente(proprietario, telefone, email, bloco, unidade, empreendimento, cpf)')
      .eq('situacao', 'Desqualificado')
      .order('created_at', { ascending: false });
    
    const desqualificados = flattenClientesArray(desqualificadosRaw || []);
    
    if (errorDesqualificados) {
      console.error('Erro ao buscar desqualificados:', errorDesqualificados);
      return c.json({ error: errorDesqualificados.message, historico: [] }, 500);
    }

    // Processar DESQUALIFICADOS
    const desqualificadosCompleto = (desqualificados || []).map((assistencia) => ({
      id: `desqualificado-${assistencia.id}`,
      id_assistencia: assistencia.id,
      status: 'Desqualificado',
      motivo_desqualificado: assistencia.motivo_desqualificado,
      justificativa: assistencia.justificativa || null,
      created_at: assistencia.created_at,
      assistencia: {
        id: assistencia.id,
        proprietario: assistencia.proprietario,
        telefone: assistencia.telefone,
        email: assistencia.email,
        bloco: assistencia.bloco,
        unidade: assistencia.unidade,
        categoria_reparo: assistencia.categoria_reparo,
        descricao_problema: assistencia.descricao_cliente,
        created_at: assistencia.created_at,
        empreendimento: assistencia.empreendimento,
        idempresa: assistencia.idempresa,
        empresa_nome: assistencia.Empresa?.nome || null,
        status_chamado: assistencia.status_chamado,
      }
    }));

    console.log(`✅ ${desqualificadosCompleto.length} registros desqualificados retornados`);
    
    return c.json({ 
      historico: desqualificadosCompleto,
      meta: {
        total: desqualificadosCompleto.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar desqualificadas:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error), 
      historico: [] 
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📦 ROTA PARA LISTA DE MATERIAIS (CATÁLOGO)
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/materiais", async (c) => {
  try {
    console.log('📦 Buscando lista de materiais da tabela materiais_reparo_pos_obra...');
    
    const { data, error } = await supabase
      .from('materiais_reparo_pos_obra')
      .select('material')
      .order('material', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar materiais:', error);
      return c.json({ error: error.message, code: error.code }, 500);
    }

    // Extrair apenas os nomes dos materiais como array de strings
    const materiais = data?.map(item => item.material).filter(Boolean) || [];
    
    console.log(`✅ ${materiais.length} materiais retornados`);
    return c.json({
      success: true,
      data: materiais,
      total: materiais.length
    });
  } catch (error) {
    console.error('❌ Erro geral ao buscar materiais:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// 📦 POST - Adicionar novo material ao catálogo
app.post("/make-server-a8708d5d/materiais", async (c) => {
  try {
    const body = await c.req.json();
    const { material } = body;

    if (!material || typeof material !== 'string' || material.trim() === '') {
      return c.json({ 
        error: 'Material inválido. Forneça um nome de material válido.' 
      }, 400);
    }

    console.log(`📦 Adicionando novo material: "${material}"`);

    // Verificar se já existe
    const { data: existente } = await supabase
      .from('materiais_reparo_pos_obra')
      .select('material')
      .eq('material', material.trim())
      .single();

    if (existente) {
      console.log(`⚠️ Material "${material}" já existe no catálogo`);
      return c.json({ 
        success: true,
        message: 'Material já existe no catálogo',
        material: material.trim()
      });
    }

    // Inserir novo material
    const { data, error } = await supabase
      .from('materiais_reparo_pos_obra')
      .insert({ material: material.trim() })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao inserir material:', error);
      return c.json({ error: error.message }, 500);
    }

    console.log(`✅ Material "${material}" adicionado com sucesso`);
    return c.json({
      success: true,
      message: 'Material adicionado com sucesso',
      data
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar material:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// 📦 PATCH - Atualizar nome de um material (renomear)
app.patch("/make-server-a8708d5d/materiais", async (c) => {
  try {
    const body = await c.req.json();
    const { materialAntigo, materialNovo } = body;

    if (!materialAntigo || !materialNovo || 
        typeof materialAntigo !== 'string' || typeof materialNovo !== 'string' ||
        materialAntigo.trim() === '' || materialNovo.trim() === '') {
      return c.json({ 
        error: 'Materiais inválidos. Forneça materialAntigo e materialNovo válidos.' 
      }, 400);
    }

    console.log(`📦 Atualizando material: "${materialAntigo}" → "${materialNovo}"`);

    // Atualizar o material
    const { data, error } = await supabase
      .from('materiais_reparo_pos_obra')
      .update({ material: materialNovo.trim() })
      .eq('material', materialAntigo.trim())
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar material:', error);
      return c.json({ error: error.message }, 500);
    }

    if (!data || data.length === 0) {
      return c.json({ 
        error: `Material "${materialAntigo}" não encontrado no catálogo` 
      }, 404);
    }

    console.log(`✅ Material atualizado com sucesso`);
    return c.json({
      success: true,
      message: 'Material atualizado com sucesso',
      data
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar material:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// 📦 DELETE - Remover material do catálogo
app.delete("/make-server-a8708d5d/materiais", async (c) => {
  try {
    const body = await c.req.json();
    const { material } = body;

    if (!material || typeof material !== 'string' || material.trim() === '') {
      return c.json({ 
        error: 'Material inválido. Forneça um nome de material válido.' 
      }, 400);
    }

    console.log(`📦 Removendo material: "${material}"`);

    // Remover o material
    const { data, error } = await supabase
      .from('materiais_reparo_pos_obra')
      .delete()
      .eq('material', material.trim())
      .select();

    if (error) {
      console.error('❌ Erro ao remover material:', error);
      return c.json({ error: error.message }, 500);
    }

    if (!data || data.length === 0) {
      return c.json({ 
        error: `Material "${material}" não encontrado no catálogo` 
      }, 404);
    }

    console.log(`✅ Material removido com sucesso`);
    return c.json({
      success: true,
      message: 'Material removido com sucesso',
      data
    });
  } catch (error) {
    console.error('❌ Erro ao remover material:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// POST /materiais/limpar-duplicatas - Limpar duplicatas de materiais
app.post("/make-server-a8708d5d/materiais/limpar-duplicatas", async (c) => {
  try {
    console.log('🧹 Iniciando limpeza de duplicatas...');

    // Buscar todos os materiais
    const { data: todosOsMateriais, error: selectError } = await supabase
      .from('materiais_reparo_pos_obra')
      .select('id, material, created_at')
      .order('created_at', { ascending: true });

    if (selectError) {
      console.error('❌ Erro ao buscar materiais:', selectError);
      return c.json({ error: selectError.message }, 500);
    }

    if (!todosOsMateriais || todosOsMateriais.length === 0) {
      return c.json({ message: 'Nenhum material encontrado' });
    }

    // Agrupar por nome de material
    const materiaisMap = new Map<string, any[]>();
    
    for (const material of todosOsMateriais) {
      const nomeMaterial = material.material.trim();
      if (!materiaisMap.has(nomeMaterial)) {
        materiaisMap.set(nomeMaterial, []);
      }
      materiaisMap.get(nomeMaterial)!.push(material);
    }

    // Encontrar duplicatas e manter apenas a primeira ocorrência
    const idsParaExcluir: number[] = [];
    let totalDuplicatas = 0;

    for (const [nome, registros] of materiaisMap.entries()) {
      if (registros.length > 1) {
        console.log(`🔍 Material "${nome}" tem ${registros.length} duplicatas`);
        totalDuplicatas += registros.length - 1;
        
        // Manter o primeiro (mais antigo), excluir o resto
        const duplicatasParaExcluir = registros.slice(1);
        idsParaExcluir.push(...duplicatasParaExcluir.map(r => r.id));
      }
    }

    if (idsParaExcluir.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada');
      return c.json({ 
        message: 'Nenhuma duplicata encontrada',
        total_materiais: todosOsMateriais.length
      });
    }

    console.log(`🗑️ Excluindo ${idsParaExcluir.length} duplicatas...`);

    // Excluir duplicatas
    const { error: deleteError } = await supabase
      .from('materiais_reparo_pos_obra')
      .delete()
      .in('id', idsParaExcluir);

    if (deleteError) {
      console.error('❌ Erro ao excluir duplicatas:', deleteError);
      return c.json({ error: deleteError.message }, 500);
    }

    console.log(`✅ ${idsParaExcluir.length} duplicatas removidas com sucesso`);
    
    return c.json({
      success: true,
      message: `${idsParaExcluir.length} duplicatas removidas`,
      duplicatas_removidas: idsParaExcluir.length,
      materiais_unicos: materiaisMap.size,
      total_antes: todosOsMateriais.length,
      total_depois: todosOsMateriais.length - idsParaExcluir.length
    });
  } catch (error) {
    console.error('❌ Erro ao limpar duplicatas:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📦 ROTA PARA INSUMOS UTILIZADOS (DASHBOARD)
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/itens-utilizados-posobra", async (c) => {
  try {
    // 🔧 FIX v5: Selecionar apenas campos necessários em vez de select('*')
    // 🔧 FIX v4: Removido .order('id'), reduzido limit 10000→500
    const { data, error } = await supabase
      .from('itens_utilizados_posobra')
      .select('material_utilizado, medida, quantidade, Empreendimento, id_finalizacao, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    
    if (error) {
      console.error('❌ Erro ao buscar insumos:', JSON.stringify(error));
      return c.json({ error: `Erro ao buscar insumos: ${error.message || error.code}`, data: [] }, 500);
    }

    return c.json({
      data: data || [],
      pagination: {
        total: data?.length || 0,
        returned: data?.length || 0,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro geral em itens-utilizados-posobra:', error);
    return c.json({ error: String(error), data: [] }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🏢 ROTAS DE AUTENTICAÇÃO E CADASTRO
// ═══════════════════════════════════════════════════════════════════

// Rota para listar empresas (para o dropdown de cadastro)
app.get("/make-server-a8708d5d/empresas", async (c) => {
  try {
    console.log('🏢 Buscando lista de empresas...');
    
    const { data, error } = await supabase
      .from('Empresa')
      .select('id, nome')
      .order('nome', { ascending: true })
      .limit(100);

    if (error) {
      console.error('❌ Erro ao buscar empresas:', error);
      return c.json({ 
        success: false, 
        error: error.message, 
        code: error.code 
      }, 500);
    }

    console.log(`✅ ${data?.length || 0} empresas retornadas`);
    return c.json({
      success: true,
      empresas: data || []
    });
  } catch (error) {
    console.error('❌ Erro geral ao buscar empresas:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

// Rota para criar novo usuário (signup)
app.post("/make-server-a8708d5d/signup", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('👤 Criando novo usuário:', body.email);
    
    // Validar campos obrigatórios
    if (!body.email || !body.password || !body.nome || !body.idempresa) {
      return c.json({ 
        error: 'Campos obrigatórios: email, password, nome, idempresa' 
      }, 400);
    }

    // 1. Criar usuário via fluxo público de signUp (dispara email de confirmação via SMTP do Supabase).
    // admin.createUser NÃO envia email — por isso usamos o client anon aqui.
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    const { data: authData, error: authError } = await anonClient.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { name: body.nome }
      }
    });

    if (authError) {
      console.error('❌ Erro ao criar usuário no Auth:', authError);
      
      // Mensagens de erro mais amigáveis
      if (authError.message.includes('already registered')) {
        return c.json({ 
          error: 'Este email já está cadastrado' 
        }, 400);
      }
      
      return c.json({ 
        error: authError.message 
      }, 500);
    }

    if (!authData.user) {
      return c.json({ 
        error: 'Erro ao criar usuário' 
      }, 500);
    }

    console.log('✅ Usuário criado no Auth:', authData.user.id);

    // 2. Criar registro na tabela User
    const { data: userData, error: userError } = await supabase
      .from('User')
      .insert([{
        auth_user_id: authData.user.id,
        nome: body.nome,
        email: body.email,
        cpf: body.cpf || null,
        telefone: body.telefone || null,
        idempresa: parseInt(body.idempresa),
        menu_assistencia: false,
        menu_gerenciamento: false,
        menu_planejamento: false,
        permissions: {
          assistencia: { view: false, gerenciar: false, whatsapp: false, termos: false },
          cadastros: { view: false, cadastros: false, clientes: false },
          notificacoes: { view: false, pedidos: false, historico_fornecedores: false, historico_grupos: false, grupos: false },
          gerenciamento: { view: false },
          planejamento: { view: false },
          entregas: { view: false, santorini: { view: false, pendencias: false, agendamentos: false } },
        },
        ativo: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userError) {
      console.error('❌ Erro ao criar registro na tabela User:', userError);
      
      // Se der erro ao criar na tabela User, deletar do Auth
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
        console.log('🔄 Usuário deletado do Auth devido a erro na tabela User');
      } catch (deleteError) {
        console.error('❌ Erro ao deletar usuário do Auth:', deleteError);
      }
      
      return c.json({ 
        error: 'Erro ao criar registro do usuário: ' + userError.message 
      }, 500);
    }

    console.log('✅ Registro criado na tabela User:', userData.id);

    return c.json({
      success: true,
      message: 'Usuário criado com sucesso! Aguarde aprovação das permissões.',
      user: {
        id: userData.id,
        nome: userData.nome,
        email: userData.email
      }
    });
  } catch (error) {
    console.error('❌ Erro geral ao criar usuário:', error);
    return c.json({ 
      error: String(error) 
    }, 500);
  }
});

// Rota para confirmar email manualmente (desenvolvimento)
app.post("/make-server-a8708d5d/confirm-email", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;
    
    console.log('📧 Confirmando email manualmente:', email);
    
    if (!email) {
      return c.json({ 
        error: 'Email é obrigatório' 
      }, 400);
    }

    // 🔧 FIX v5: Buscar user por lookup direto em vez de listUsers() que carrega TODOS na memória
    let user: any = null;
    
    // Tentativa 1: Buscar auth_user_id na tabela User e depois getUserById (mais eficiente)
    try {
      const { data: userData } = await supabase
        .from('User')
        .select('auth_user_id')
        .eq('email', email)
        .maybeSingle();
      
      if (userData?.auth_user_id) {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userData.auth_user_id);
        user = authUser;
      }
    } catch (lookupErr) {
      console.warn('⚠️ Lookup direto falhou, tentando listUsers paginado');
    }
    
    // Tentativa 2: listUsers paginado (lotes de 50, máx 1000 users)
    if (!user) {
      let page = 1;
      const perPage = 50;
      while (page <= 20) {
        const { data: { users: batch }, error: batchError } = await supabase.auth.admin.listUsers({ page, perPage });
        if (batchError || !batch || batch.length === 0) break;
        const match = batch.find((u: any) => u.email === email);
        if (match) { user = match; break; }
        if (batch.length < perPage) break;
        page++;
      }
    }
    
    if (!user) {
      return c.json({ 
        error: 'Usuário não encontrado' 
      }, 404);
    }

    // Verificar se já está confirmado
    if (user.email_confirmed_at) {
      console.log('✅ Email já estava confirmado:', user.email_confirmed_at);
      return c.json({
        success: true,
        message: 'Email já estava confirmado',
        confirmed_at: user.email_confirmed_at
      });
    }

    // Confirmar email
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error('❌ Erro ao confirmar email:', updateError);
      return c.json({ 
        error: 'Erro ao confirmar email: ' + updateError.message 
      }, 500);
    }

    console.log('✅ Email confirmado com sucesso:', email);

    return c.json({
      success: true,
      message: 'Email confirmado com sucesso',
      user: {
        id: updateData.user.id,
        email: updateData.user.email,
        confirmed_at: updateData.user.email_confirmed_at
      }
    });
  } catch (error) {
    console.error('❌ Erro geral ao confirmar email:', error);
    return c.json({ 
      error: String(error) 
    }, 500);
  }
});

// 🔥 OTIMIZAÇÃO v7: Monitoring routes (invocations + database-ping) movidas para ./analytics.tsx (lazy-loaded)
// 🔥 OTIMIZAÇÃO v7: AI Insights route movida para ./analytics.tsx (lazy-loaded)

// ═══════════════════════════════════════════════════════════════════
// 🚀 INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════

console.log('🚀 EON Connect Server - Starting (memory-optimized v7)...');
console.log('📦 Módulos eager: cadastros (leve, KV-only)');
console.log('📦 Módulos lazy: whatsapp, chat, scheduler, openai, sienge, analytics (com cache)');
console.log('🔥 Otimizações v7: +860 linhas movidas para lazy-load (sienge, monitoring, ai-insights), select específico, confirm-email sem listUsers(), limits reduzidos');

// ═══════════════════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE DE TRATAMENTO DE ERROS GLOBAL
// Sanitiza erros antes de enviar ao cliente para proteger informações sensíveis
// ═══════════════════════════════════════════════════════════════════

app.onError((err, c) => {
  console.error('🔴 Erro capturado pelo middleware global:', err);
  
  // Gerar ID único para o erro
  const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log detalhado apenas no servidor (não expor ao cliente)
  console.group(`🔴 Detalhes do erro [${errorId}]`);
  console.error('Tipo:', err.name);
  console.error('Mensagem:', err.message);
  console.error('Stack:', err.stack);
  console.groupEnd();
  
  // Determinar status code apropriado
  let statusCode = 500;
  let userMessage = 'Ocorreu um erro no servidor. Nossa equipe foi notificada e estamos trabalhando para resolver.';
  
  // Verificar tipos específicos de erro
  const errorMessage = (err.message || '').toLowerCase();
  
  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    statusCode = 401;
    userMessage = 'Sua sessão expirou. Por favor, faça login novamente.';
  } else if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
    statusCode = 403;
    userMessage = 'Você não tem permissão para realizar esta ação.';
  } else if (errorMessage.includes('not found')) {
    statusCode = 404;
    userMessage = 'O recurso solicitado não foi encontrado.';
  } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    statusCode = 400;
    userMessage = 'Os dados fornecidos são inválidos. Por favor, verifique e tente novamente.';
  } else if (errorMessage.includes('timeout')) {
    statusCode = 504;
    userMessage = 'A operação demorou muito tempo. Por favor, tente novamente.';
  }
  
  // Resposta sanitizada (SEM detalhes técnicos)
  return c.json({
    error: userMessage,
    errorId: errorId,
    timestamp: new Date().toISOString(),
  }, statusCode);
});

// ═══════════════════════════════════════════════════════════════════
// 📄 ROTA PARA LISTAR TERMOS DE ASSISTÊNCIA TÉCNICA
// Retorna termos com dados da assistência e cliente para a página de gestão
// ═══════════════════════════════════════════════════════════════════

app.get("/make-server-a8708d5d/termos-assistencia", async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const tipo = url.searchParams.get('tipo') || ''; // 'assinado', 'vencida', 'pendente' ou '' (todos)
    const siengeStatus = url.searchParams.get('sienge') || ''; // 'ok', 'erro', ou '' (todos)
    const empreendimento = url.searchParams.get('empreendimento') || '';
    const offset = (page - 1) * limit;

    console.log(`📄 Listando termos: page=${page}, limit=${limit}, search="${search}", tipo="${tipo}", sienge="${siengeStatus}", empreendimento="${empreendimento}"`);

    // Query base com JOIN na finalização
    let query = supabase
      .from('termos_assistencia')
      .select(`
        id,
        id_solicitacao,
        id_finalizacao,
        pdf_storage_path,
        pdf_storage_path_assinado,
        pdf_storage_path_vencida,
        pdf_bucket,
        tipo_finalizacao,
        finalizado_em,
        enviado_sienge,
        data_envio_sienge,
        sienge_error,
        created_at,
        updated_at,
        assistencia_finalizada!id_finalizacao (
          id,
          id_assistencia,
          status,
          responsaveis,
          nps,
          assinatura_vencida,
          created_at
        )
      `, { count: 'exact' });

    // Filtro por tipo de finalização
    if (tipo === 'assinado') {
      query = query.eq('tipo_finalizacao', 'assinado');
    } else if (tipo === 'vencida') {
      query = query.eq('tipo_finalizacao', 'vencida');
    } else if (tipo === 'pendente') {
      query = query.is('tipo_finalizacao', null);
    }

    // Filtro por status do Sienge
    if (siengeStatus === 'ok') {
      query = query.eq('enviado_sienge', true);
    } else if (siengeStatus === 'erro') {
      query = query.eq('enviado_sienge', false).not('tipo_finalizacao', 'is', null);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.order('created_at', { ascending: false });

    // Paginação
    query = query.range(offset, offset + limit - 1);

    const { data: termos, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar termos:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // Para cada termo, buscar dados do cliente via assistência
    const termosComCliente = [];
    for (const termo of (termos || [])) {
      const fin = (termo as any).assistencia_finalizada;
      let clienteInfo: any = null;

      if (fin?.id_assistencia) {
        const { data: assRaw } = await supabase
          .from('Assistência Técnica')
          .select('id, id_cliente, categoria_reparo, clientes!id_cliente(proprietario, cpf, telefone, email, bloco, unidade, empreendimento)')
          .eq('id', fin.id_assistencia)
          .single();

        if (assRaw) {
          const cl = (assRaw as any).clientes || {};
          clienteInfo = {
            proprietario: cl.proprietario,
            cpf: cl.cpf,
            telefone: cl.telefone,
            email: cl.email,
            bloco: cl.bloco,
            unidade: cl.unidade,
            empreendimento: cl.empreendimento,
            categoria_reparo: assRaw.categoria_reparo,
          };
        }
      }

      // Aplicar filtros de search e empreendimento no JS (após busca)
      if (empreendimento && clienteInfo?.empreendimento !== empreendimento) continue;
      if (search) {
        const s = search.toLowerCase();
        const match =
          clienteInfo?.proprietario?.toLowerCase().includes(s) ||
          clienteInfo?.cpf?.includes(s) ||
          clienteInfo?.empreendimento?.toLowerCase().includes(s) ||
          String(termo.id_solicitacao).includes(s) ||
          String(termo.id_finalizacao).includes(s);
        if (!match) continue;
      }

      termosComCliente.push({
        ...termo,
        assistencia_finalizada: undefined,
        finalizacao: fin ? {
          id: fin.id,
          id_assistencia: fin.id_assistencia,
          status: fin.status,
          responsaveis: fin.responsaveis,
          nps: fin.nps,
          assinatura_vencida: fin.assinatura_vencida,
          created_at: fin.created_at,
        } : null,
        cliente: clienteInfo,
      });
    }

    const totalPages = count ? Math.ceil(count / limit) : 1;

    return c.json({
      success: true,
      data: termosComCliente,
      total: count || 0,
      page,
      limit,
      totalPages,
    });

  } catch (error) {
    console.error('❌ Erro geral ao listar termos:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🚫 HANDLER PADRÃO PARA ROTAS NÃO ENCONTRADAS (404)
// ═══════════════════════════════════════════════════════════════════

app.notFound((c) => {
  console.warn(`⚠️ Rota não encontrada: ${c.req.method} ${c.req.url}`);
  return c.json({
    success: false,
    error: 'Rota não encontrada',
    path: new URL(c.req.url).pathname,
    timestamp: new Date().toISOString()
  }, 404);
});

Deno.serve(app.fetch);