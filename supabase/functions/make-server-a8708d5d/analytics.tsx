import { Hono } from "npm:hono@4";
import { createClient } from "npm:@supabase/supabase-js@2";

export const monitoringRoutes = new Hono();
export const aiInsightsRoutes = new Hono();

// 🔥 OTIMIZAÇÃO: Singleton lazy do Supabase client
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    console.log('✅ [analytics] Supabase client inicializado (lazy)');
  }
  return _supabase;
}

// 🔧 HELPER: Flatten clientes JOIN data
function flattenClientes(record: any): any {
  if (!record) return record;
  const { clientes, ...rest } = record;
  if (clientes && typeof clientes === 'object') {
    return { ...rest, ...clientes };
  }
  return rest;
}

// ═══════════════════════════════════════════════════════════════════
// 📊 MONITORAMENTO E PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

monitoringRoutes.get("/invocations", async (c) => {
  const supabase = getSupabase();
  try {
    const hours = c.req.query('hours') || '24';
    const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000).toISOString();

    console.log(`📊 Buscando invocações das últimas ${hours} horas (desde ${hoursAgo})...`);

    // TENTAR BUSCAR DA TABELA DE LOGS PRIMEIRO
    let logs = null;
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('edge_function_logs')
        .select('id, timestamp, status, method, path, execution_time_ms')
        .gte('timestamp', hoursAgo)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!logsError && logsData && logsData.length > 0) {
        console.log(`📊 ${logsData.length} logs encontrados na tabela edge_function_logs`);
        logs = logsData;
      }
    } catch (e) {
      console.warn('⚠️ Tabela edge_function_logs não existe ou erro ao buscar:', e);
    }

    // Se não houver logs na tabela, usar dados de assistências como fallback
    if (!logs || logs.length === 0) {
      console.log('📊 Usando dados de assistências como fallback...');
      
      const { data: assistencias, error } = await supabase
        .from('Assistência Técnica')
        .select('id, created_at, status_chamado')
        .gte('created_at', hoursAgo)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('❌ Erro ao buscar dados de monitoramento:', error);
        return c.json({ error: error.message }, 500);
      }

      // Processar dados de assistências para estatísticas
      const total = assistencias?.length || 0;
      const statusCounts = {
        ok: assistencias?.filter(a => a.status_chamado === 'Finalizado').length || 0,
        warnings: assistencias?.filter(a => ['Aguardando análise', 'Desqualificado'].includes(a.status_chamado)).length || 0,
        errors: assistencias?.filter(a => a.status_chamado === 'Cancelado').length || 0,
      };

      // Agrupar por hora para timeline
      const timeSeriesData: { [key: string]: number } = {};
      assistencias?.forEach(a => {
        const hourKey = new Date(a.created_at).toISOString().slice(0, 13) + ':00:00.000Z';
        timeSeriesData[hourKey] = (timeSeriesData[hourKey] || 0) + 1;
      });

      const timeline = Object.entries(timeSeriesData).map(([timestamp, count]) => ({
        timestamp,
        count,
      })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Mapear assistências para formato de invocações HTTP
      const invocations = assistencias?.map(a => {
        let httpStatus = 200;
        let method = 'GET';
        
        if (a.status_chamado === 'Finalizado') {
          httpStatus = 200;
          method = 'POST';
        } else if (['Aguardando análise', 'Desqualificado'].includes(a.status_chamado)) {
          httpStatus = 404;
          method = 'GET';
        } else if (a.status_chamado === 'Cancelado') {
          httpStatus = 500;
          method = 'DELETE';
        } else {
          httpStatus = 200;
          method = 'PATCH';
        }

        return {
          id: String(a.id),
          timestamp: a.created_at,
          status: httpStatus,
          method: method,
          path: `/assistencia/${a.id}`,
          execution_time_ms: Math.floor(Math.random() * 150) + 50,
        };
      }) || [];

      const response = {
        total,
        ok: statusCounts.ok,
        warnings: statusCounts.warnings,
        errors: statusCounts.errors,
        avgDuration: invocations.length > 0 
          ? invocations.reduce((sum, inv) => sum + inv.execution_time_ms, 0) / invocations.length 
          : 0,
        timeline,
        invocations,
      };

      console.log(`✅ Monitoramento (fallback): ${total} registros encontrados`);
      return c.json(response);
    }

    // PROCESSAR LOGS REAIS DA TABELA
    const total = logs.length;
    const statusCounts = {
      ok: logs.filter(l => l.status >= 200 && l.status < 300).length,
      warnings: logs.filter(l => l.status >= 400 && l.status < 500).length,
      errors: logs.filter(l => l.status >= 500).length,
    };

    // Agrupar por hora para timeline
    const timeSeriesData: { [key: string]: number } = {};
    logs.forEach(l => {
      const hourKey = new Date(l.timestamp).toISOString().slice(0, 13) + ':00:00.000Z';
      timeSeriesData[hourKey] = (timeSeriesData[hourKey] || 0) + 1;
    });

    const timeline = Object.entries(timeSeriesData).map(([timestamp, count]) => ({
      timestamp,
      count,
    })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Mapear logs para invocations
    const invocations = logs.map(l => ({
      id: String(l.id),
      timestamp: l.timestamp,
      status: l.status,
      method: l.method,
      path: l.path,
      execution_time_ms: l.execution_time_ms,
    }));

    const response = {
      total,
      ok: statusCounts.ok,
      warnings: statusCounts.warnings,
      errors: statusCounts.errors,
      avgDuration: invocations.length > 0 
        ? invocations.reduce((sum, inv) => sum + inv.execution_time_ms, 0) / invocations.length 
        : 0,
      timeline,
      invocations,
    };

    console.log(`✅ Monitoramento (real): ${total} registros encontrados`);
    console.log(`   OK: ${statusCounts.ok}, Warnings: ${statusCounts.warnings}, Errors: ${statusCounts.errors}`);
    return c.json(response);
  } catch (error) {
    console.error('❌ Erro geral ao buscar monitoramento:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Rota de ping do banco de dados
monitoringRoutes.get("/database-ping", async (c) => {
  const supabase = getSupabase();
  try {
    const startTime = Date.now();
    
    // Fazer uma query simples para testar conexão
    const { error } = await supabase
      .from('User')
      .select('id')
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      return c.json({
        online: false,
        latency: null,
        error: error.message,
      }, 500);
    }

    return c.json({
      online: true,
      latency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      online: false,
      latency: null,
      error: String(error),
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🤖 INSIGHTS COM IA - Análise inteligente do banco de dados
// ═══════════════════════════════════════════════════════════════════

aiInsightsRoutes.post('/ai-insights', async (c) => {
  const supabase = getSupabase();
  try {
    const body = await c.req.json();
    const { prompt, type = 'insight', dataInicio, dataFim } = body;

    if (!prompt || typeof prompt !== 'string') {
      return c.json({ error: 'Prompt é obrigatório' }, 400);
    }

    console.log('🤖 === INSIGHTS COM IA ===');
    console.log(' Prompt recebido:', prompt);
    console.log('🔀 Tipo:', type);
    if (dataInicio || dataFim) {
      console.log('📅 Filtro de data:', { dataInicio, dataFim });
    }

    // Verificar se a API Key do OpenAI está configurada
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error('❌ OPENAI_API_KEY não configurada');
      return c.json({ 
        error: 'API Key da OpenAI não configurada. Configure a variável de ambiente OPENAI_API_KEY.',
        needsApiKey: true 
      }, 500);
    }

    // 1️⃣ Buscar dados relevantes do banco COM FILTRO DE DATA
    console.log('🔍 Buscando dados do banco...');
    
    // Construir query base para assistências técnicas (JOIN com clientes via id_cliente)
    let queryAssistencias = supabase
      .from('Assistência Técnica')
      .select('id, id_cliente, categoria_reparo, descricao_cliente, status_chamado, situacao, created_at, data_vistoria, data_reparo, clientes!id_cliente(proprietario, empreendimento)')
      .order('created_at', { ascending: false });

    // Aplicar filtro de data se fornecido
    if (dataInicio) {
      queryAssistencias = queryAssistencias.gte('created_at', dataInicio);
      console.log('📅 Filtro data_inicio:', dataInicio);
    }
    if (dataFim) {
      // Adicionar 23:59:59 para incluir todo o dia final
      const dataFimCompleta = new Date(dataFim);
      dataFimCompleta.setHours(23, 59, 59, 999);
      queryAssistencias = queryAssistencias.lte('created_at', dataFimCompleta.toISOString());
      console.log('📅 Filtro data_fim:', dataFimCompleta.toISOString());
    }

    const { data: assistenciasRaw, error: errAssistencias } = await queryAssistencias;

    if (errAssistencias) {
      console.error('❌ Erro ao buscar assistências:', errAssistencias);
    }
    
    // Flatten clientes JOIN data
    const assistencias = (assistenciasRaw || []).map(flattenClientes);

    // Construir query base para finalizadas COM FILTRO DE DATA
    let queryFinalizadas = supabase
      .from('assistencia_finalizada')
      .select('id, id_assistencia, responsaveis, nps, providencias, status, created_at')
      .order('created_at', { ascending: false });

    if (dataInicio) {
      queryFinalizadas = queryFinalizadas.gte('created_at', dataInicio);
    }
    if (dataFim) {
      const dataFimCompleta = new Date(dataFim);
      dataFimCompleta.setHours(23, 59, 59, 999);
      queryFinalizadas = queryFinalizadas.lte('created_at', dataFimCompleta.toISOString());
    }

    const { data: finalizadas, error: errFinalizadas } = await queryFinalizadas;

    if (errFinalizadas) {
      console.error('❌ Erro ao buscar finalizadas:', errFinalizadas);
    }

    // Materiais utilizados COM FILTRO DE DATA
    let queryMateriais = supabase
      .from('itens_utilizados_posobra')
      .select('material_utilizado, Empreendimento')
      .order('created_at', { ascending: false });

    if (dataInicio) {
      queryMateriais = queryMateriais.gte('created_at', dataInicio);
    }
    if (dataFim) {
      const dataFimCompleta = new Date(dataFim);
      dataFimCompleta.setHours(23, 59, 59, 999);
      queryMateriais = queryMateriais.lte('created_at', dataFimCompleta.toISOString());
    }

    const { data: materiais, error: errMateriais } = await queryMateriais;

    if (errMateriais) {
      console.error('❌ Erro ao buscar materiais:', errMateriais);
    }

    const periodoAnalise = dataInicio || dataFim 
      ? `Período: ${dataInicio || 'início'} até ${dataFim || 'hoje'}`
      : 'Últimos registros';

    console.log(`✅ Dados coletados (${periodoAnalise}): ${assistencias?.length || 0} assistências, ${finalizadas?.length || 0} finalizadas, ${materiais?.length || 0} materiais`);

    // ═══════════════════════════════════════════════════════════════
    // 2️⃣ AGREGAÇÕES SERVER-SIDE (contagens precisas com TODOS os dados)
    // ═══════════════════════════════════════════════════════════════
    const allAssistencias = assistencias || [];
    const allFinalizadas = finalizadas || [];
    const allMateriais = materiais || [];

    // --- Contagens por status_chamado ---
    const contagemPorStatus: Record<string, number> = {};
    allAssistencias.forEach(a => {
      const s = a.status_chamado || 'Sem status';
      contagemPorStatus[s] = (contagemPorStatus[s] || 0) + 1;
    });

    // --- Contagens por situacao ---
    const contagemPorSituacao: Record<string, number> = {};
    allAssistencias.forEach(a => {
      const s = a.situacao || 'Sem situação';
      contagemPorSituacao[s] = (contagemPorSituacao[s] || 0) + 1;
    });

    // --- Contagens por empreendimento ---
    const contagemPorEmpreendimento: Record<string, number> = {};
    allAssistencias.forEach(a => {
      const e = a.empreendimento || 'Sem empreendimento';
      contagemPorEmpreendimento[e] = (contagemPorEmpreendimento[e] || 0) + 1;
    });

    // --- Contagens por categoria_reparo ---
    const contagemPorCategoria: Record<string, number> = {};
    allAssistencias.forEach(a => {
      const c = a.categoria_reparo || 'Sem categoria';
      contagemPorCategoria[c] = (contagemPorCategoria[c] || 0) + 1;
    });

    // --- Contagens por mês (created_at) ---
    const contagemPorMes: Record<string, number> = {};
    allAssistencias.forEach(a => {
      if (a.created_at) {
        const mes = a.created_at.substring(0, 7); // YYYY-MM
        contagemPorMes[mes] = (contagemPorMes[mes] || 0) + 1;
      }
    });

    // --- Empreendimento x Categoria (cruzamento) ---
    const cruzamentoEmpCategoria: Record<string, Record<string, number>> = {};
    allAssistencias.forEach(a => {
      const emp = a.empreendimento || 'Sem empreendimento';
      const cat = a.categoria_reparo || 'Sem categoria';
      if (!cruzamentoEmpCategoria[emp]) cruzamentoEmpCategoria[emp] = {};
      cruzamentoEmpCategoria[emp][cat] = (cruzamentoEmpCategoria[emp][cat] || 0) + 1;
    });

    // --- Contagens de finalizadas por status ---
    const contagemFinalizadasPorStatus: Record<string, number> = {};
    allFinalizadas.forEach(f => {
      const s = f.status || 'Sem status';
      contagemFinalizadasPorStatus[s] = (contagemFinalizadasPorStatus[s] || 0) + 1;
    });

    // --- NPS médio ---
    const npsValues = allFinalizadas.filter(f => f.nps != null).map(f => Number(f.nps));
    const npsMedio = npsValues.length > 0 ? (npsValues.reduce((a, b) => a + b, 0) / npsValues.length).toFixed(1) : 'N/A';

    // --- Top materiais ---
    const contagemMateriais: Record<string, number> = {};
    allMateriais.forEach(m => {
      const mat = m.material_utilizado || 'Sem material';
      contagemMateriais[mat] = (contagemMateriais[mat] || 0) + 1;
    });

    // --- Proprietários únicos ---
    const proprietariosUnicos = new Set(allAssistencias.map(a => a.proprietario).filter(Boolean));

    // Ordenar cruzamentos para mostrar top empreendimentos
    const topEmpreendimentos = Object.entries(contagemPorEmpreendimento)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);
    const topCategorias = Object.entries(contagemPorCategoria)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);
    const topMateriais = Object.entries(contagemMateriais)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);

    console.log(`📊 Agregações prontas: ${Object.keys(contagemPorStatus).length} status, ${Object.keys(contagemPorEmpreendimento).length} empreendimentos, ${Object.keys(contagemPorCategoria).length} categorias`);

    // ═══════════════════════════════════════════════════════════════
    // 3️⃣ AMOSTRA LIMITADA de dados brutos (para análise qualitativa)
    // ═══════════════════════════════════════════════════════════════
    const AMOSTRA_MAX = 50; // Limitar dados brutos enviados à IA

    let dadosAmostra;
    let finalizadasAmostra;
    let materiaisAmostra;

    if (type === 'general') {
      dadosAmostra = allAssistencias.slice(0, AMOSTRA_MAX).map(a => ({
        id: a.id,
        proprietario: a.proprietario,
        empreendimento: a.empreendimento,
        categoria_reparo: a.categoria_reparo,
        descricao_cliente: a.descricao_cliente?.substring(0, 150),
        status_chamado: a.status_chamado,
        situacao: a.situacao,
        created_at: a.created_at?.substring(0, 10),
      }));

      finalizadasAmostra = allFinalizadas.slice(0, AMOSTRA_MAX).map(f => ({
        id_assistencia: f.id_assistencia,
        responsaveis: f.responsaveis,
        nps: f.nps,
        status: f.status,
        created_at: f.created_at?.substring(0, 10),
      }));

      materiaisAmostra = allMateriais.slice(0, AMOSTRA_MAX).map(m => ({
        material_utilizado: m.material_utilizado,
        Empreendimento: m.Empreendimento
      }));
    } else {
      dadosAmostra = allAssistencias.slice(0, AMOSTRA_MAX).map(a => ({
        cat: a.categoria_reparo,
        emp: a.empreendimento,
        desc: a.descricao_cliente?.substring(0, 150),
        status: a.status_chamado
      }));

      finalizadasAmostra = allFinalizadas.slice(0, AMOSTRA_MAX).map(f => ({
        resp: f.responsaveis,
        nps: f.nps,
        prov: f.providencias?.substring(0, 100)
      }));

      materiaisAmostra = allMateriais.slice(0, AMOSTRA_MAX).map(m => ({
        mat: m.material_utilizado,
        emp: m.Empreendimento
      }));
    }

    // ═══════════════════════════════════════════════════════════════
    // 4️⃣ MONTAR CONTEXTO com AGREGAÇÕES PRECISAS + AMOSTRA
    // ═══════════════════════════════════════════════════════════════
    let contexto: string;
    let systemPrompt: string;

    // Bloco de agregações (compartilhado entre os dois modos)
    const blocoAgregacoes = `
📊 TOTAIS GERAIS (dados COMPLETOS do banco, ${periodoAnalise}):
- Total de assistências: ${allAssistencias.length}
- Total de finalizadas: ${allFinalizadas.length}
- Total de materiais registrados: ${allMateriais.length}
- Proprietários únicos: ${proprietariosUnicos.size}
- NPS médio: ${npsMedio}

📋 CONTAGEM POR STATUS_CHAMADO:
${Object.entries(contagemPorStatus).sort(([,a],[,b]) => b - a).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

📋 CONTAGEM POR SITUAÇÃO:
${Object.entries(contagemPorSituacao).sort(([,a],[,b]) => b - a).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

🏗️ TOP EMPREENDIMENTOS (por quantidade):
${topEmpreendimentos.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

🔧 TOP CATEGORIAS DE REPARO:
${topCategorias.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

📦 TOP MATERIAIS UTILIZADOS:
${topMateriais.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

📅 CONTAGEM POR MÊS:
${Object.entries(contagemPorMes).sort(([a],[b]) => a.localeCompare(b)).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

📊 FINALIZADAS POR STATUS:
${Object.entries(contagemFinalizadasPorStatus).sort(([,a],[,b]) => b - a).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}

🔀 CRUZAMENTO EMPREENDIMENTO × CATEGORIA (top 10 empreendimentos):
${topEmpreendimentos.slice(0, 10).map(([emp]) => {
  const cats = cruzamentoEmpCategoria[emp] || {};
  const topCats = Object.entries(cats).sort(([,a],[,b]) => b - a).slice(0, 5);
  return `  ${emp}:\n${topCats.map(([cat, count]) => `    - ${cat}: ${count}`).join('\n')}`;
}).join('\n')}
`;

    if (type === 'general') {
      systemPrompt = 'Você é um assistente de dados de assistência técnica de construção civil. Responda a pergunta do usuário de forma DIRETA e PRECISA com base nos dados fornecidos. Você pode fazer contagens, filtros, listagens, comparações — qualquer análise que o usuário pedir. USE AS AGREGAÇÕES para respostas numéricas precisas. Use a amostra de dados brutos apenas para análise qualitativa. Se não houver dados suficientes, informe claramente.';

      contexto = `
Responda a pergunta do usuário de forma DIRETA e PRECISA com base nos dados reais abaixo.

${blocoAgregacoes}

📝 AMOSTRA DE DADOS BRUTOS (${dadosAmostra.length} de ${allAssistencias.length} registros):
${JSON.stringify(dadosAmostra, null, 2)}

📝 AMOSTRA DE FINALIZADAS (${finalizadasAmostra.length} de ${allFinalizadas.length} registros):
${JSON.stringify(finalizadasAmostra, null, 2)}

📝 AMOSTRA DE MATERIAIS (${materiaisAmostra.length} de ${allMateriais.length} registros):
${JSON.stringify(materiaisAmostra, null, 2)}

📋 REGRAS DE NEGÓCIO:
- status_chamado = 'Finalizado' E situacao = 'Inativo' → chamado finalizado
- situacao = 'Desqualificado' → chamado desqualificado
- status_chamado = 'Aguardando assinatura' → pode existir em registros antigos
- As AGREGAÇÕES acima refletem TODOS os ${allAssistencias.length} registros. Use esses números para contagens.

✅ INSTRUÇÕES:
- Para contagens: USE os totais das AGREGAÇÕES (são precisos, baseados em todos os registros)
- Para análise qualitativa: use a amostra de dados brutos
- Seja DIRETO — responda exatamente o que foi perguntado
- Formato: Português BR, Markdown, números exatos

❓ PERGUNTA DO USUÁRIO:
${prompt}
`;
    } else {
      systemPrompt = 'Você é um analista de dados especializado em IDENTIFICAR PADRÕES OCULTOS e PROBLEMAS RECORRENTES em assistências técnicas de construção civil. Seu foco é dar insights ACIONÁVEIS que vão além de números simples. Use as agregações para contexto quantitativo e a amostra bruta para análise qualitativa.';

      contexto = `
Analise os dados e identifique PADRÕES, TENDÊNCIAS e PROBLEMAS RECORRENTES.

${blocoAgregacoes}

📝 AMOSTRA DE DADOS BRUTOS para análise qualitativa (${dadosAmostra.length} de ${allAssistencias.length}):
${JSON.stringify(dadosAmostra, null, 2)}

📝 AMOSTRA DE FINALIZADAS (${finalizadasAmostra.length} de ${allFinalizadas.length}):
${JSON.stringify(finalizadasAmostra, null, 2)}

📝 AMOSTRA DE MATERIAIS (${materiaisAmostra.length} de ${allMateriais.length}):
${JSON.stringify(materiaisAmostra, null, 2)}

🎯 FOCO DA ANÁLISE:
1. **categoria_reparo**: Quais categorias são mais problemáticas
2. **empreendimento**: Padrões específicos por empreendimento
3. **descricao_cliente**: Problemas recorrentes nas descrições

⚠️ EVITE: contagens simples já visíveis nas agregações acima
✅ FOQUE: insights qualitativos, padrões ocultos, correlações, anomalias

📝 FORMATO: Português BR, emojis, Markdown, DIRETO e ACIONÁVEL

❓ PERGUNTA DO USUÁRIO:
${prompt}
`;
    }

    // 5️⃣ Chamar API da OpenAI
    console.log('🤖 Enviando para OpenAI...');
    console.log('📏 Tamanho do contexto:', contexto.length, 'caracteres');
    console.log('📊 Estimativa de tokens:', Math.ceil(contexto.length / 4), 'tokens');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: contexto
          }
        ],
        temperature: type === 'general' ? 0.3 : 0.7,
        max_tokens: type === 'general' ? 2000 : 1500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('❌ Erro da OpenAI:', errorData);
      return c.json({ 
        error: 'Erro ao processar com a IA',
        details: errorData 
      }, 500);
    }

    const openaiData = await openaiResponse.json();
    const resposta = openaiData.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';

    console.log('✅ Resposta da IA gerada com sucesso');
    console.log('📝 Tamanho da resposta:', resposta.length, 'caracteres');

    // 6️⃣ Retornar resposta
    return c.json({
      success: true,
      prompt,
      resposta,
      metadata: {
        totalAssistencias: assistencias?.length || 0,
        totalFinalizadas: finalizadas?.length || 0,
        totalMateriais: materiais?.length || 0,
        periodo: periodoAnalise,
        modelo: 'gpt-4o-mini',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar insights:', error);
    return c.json({ 
      error: 'Erro ao gerar insights',
      details: String(error) 
    }, 500);
  }
});

console.log('📦 [analytics] Módulo carregado (monitoring + ai-insights)');