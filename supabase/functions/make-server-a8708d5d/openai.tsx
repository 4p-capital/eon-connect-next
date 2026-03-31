import { Hono } from "npm:hono@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const openaiRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// 🤖 OPENAI INTEGRATION - Análise de Risco de Chamados
// ═══════════════════════════════════════════════════════════════════

// 🔥 OTIMIZAÇÃO: Singleton do Supabase client (lazy)
let _openaiSupabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_openaiSupabase) {
    _openaiSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
  }
  return _openaiSupabase;
}

interface AnaliseGPT {
  classificacao: 'Moderado' | 'Médio' | 'Crítico';
  analise: string;
  data_analise: string;
  modelo?: string;
  tokens_utilizados?: number;
}

interface TicketData {
  id: number;
  descricao_cliente: string;
  categoria_reparo: string;
  empreendimento?: string;
  bloco?: string;
  unidade?: string;
  proprietario?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 CORE: Chamar OpenAI para análise do chamado
// ═══════════════════════════════════════════════════════════════════

async function analisarChamadoComGPT(ticket: TicketData): Promise<AnaliseGPT> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY não configurada');
    throw new Error('OPENAI_API_KEY não está configurada no servidor');
  }

  const systemPrompt = `Você é um analista técnico especializado em assistência técnica de obras e construção civil. 
Sua função é analisar chamados de assistência técnica e classificar o risco/urgência.

REGRAS DE CLASSIFICAÇÃO:
- **Crítico**: Problemas que envolvem segurança, riscos estruturais, infiltrações graves, problemas elétricos perigosos, vazamentos de gás, elevadores parados, incêndio, inundações ou qualquer situação que coloque moradores em risco imediato.
- **Médio**: Problemas que afetam o conforto e uso normal do imóvel mas sem risco imediato - vazamentos moderados, problemas em instalações hidráulicas, falhas em esquadrias, fissuras visíveis, problemas em áreas comuns, ar condicionado inoperante.
- **Moderado**: Problemas estéticos ou de acabamento, pequenos ajustes, pintura, rejunte, pequenas trincas superficiais, problemas cosméticos, itens de personalização.

RESPONDA APENAS em JSON válido com esta estrutura exata:
{
  "classificacao": "Moderado" | "Médio" | "Crítico",
  "analise": "breve análise técnica em 1-2 frases (máximo 150 caracteres)"
}`;

  const userPrompt = `Analise este chamado de assistência técnica:

**Categoria:** ${ticket.categoria_reparo}
**Descrição do cliente:** ${ticket.descricao_cliente}
${ticket.empreendimento ? `**Empreendimento:** ${ticket.empreendimento}` : ''}

Classifique o risco e forneça um breve insight técnico.`;

  console.log(`🤖 Enviando chamado #${ticket.id} para análise GPT...`);
  console.log(`   Categoria: ${ticket.categoria_reparo}`);
  console.log(`   Descrição: ${ticket.descricao_cliente?.substring(0, 80)}...`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ OpenAI API error (${response.status}):`, errorText.substring(0, 300));
    throw new Error(`OpenAI API retornou erro ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsados = data.usage?.total_tokens || null;

  if (!content) {
    console.error('❌ Resposta vazia da OpenAI');
    throw new Error('OpenAI retornou resposta vazia');
  }

  console.log(`📥 Resposta GPT: ${content}`);

  let parsed: { classificacao: string; analise: string };
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('❌ Erro ao parsear JSON da OpenAI:', content);
    throw new Error('Resposta da OpenAI não é JSON válido');
  }

  // Validar classificação
  const classificacoesValidas = ['Moderado', 'Médio', 'Crítico'];
  if (!classificacoesValidas.includes(parsed.classificacao)) {
    console.warn(`⚠️ Classificação inválida "${parsed.classificacao}", usando "Médio" como fallback`);
    parsed.classificacao = 'Médio';
  }

  const resultado: AnaliseGPT = {
    classificacao: parsed.classificacao as AnaliseGPT['classificacao'],
    analise: parsed.analise?.substring(0, 200) || 'Análise não disponível',
    data_analise: new Date().toISOString(),
    modelo: 'gpt-4o-mini',
    tokens_utilizados: tokensUsados,
  };

  console.log(`✅ Análise concluída: ${resultado.classificacao} - ${resultado.analise} (${tokensUsados} tokens)`);
  return resultado;
}

// ═══════════════════════════════════════════════════════════════════
// 💾 HELPERS: Salvar/Buscar na tabela gpt_analises (Supabase)
// ═══════════════════════════════════════════════════════════════════

async function salvarAnalise(id: number | string, analise: AnaliseGPT): Promise<void> {
  const idNum = typeof id === 'string' ? parseInt(id) : id;

  // UPSERT: Insere ou atualiza se já existir (ON CONFLICT id_assistencia)
  const { error } = await getSupabase()
    .from('gpt_analises')
    .upsert(
      {
        id_assistencia: idNum,
        classificacao: analise.classificacao,
        analise: analise.analise,
        modelo: analise.modelo || 'gpt-4o-mini',
        tokens_utilizados: analise.tokens_utilizados || null,
      },
      { onConflict: 'id_assistencia' }
    );

  if (error) {
    console.error(`❌ Erro ao salvar análise na tabela gpt_analises:`, error);
    throw new Error(`Erro ao persistir análise: ${error.message}`);
  }

  console.log(`💾 Análise salva na tabela gpt_analises para assistência #${idNum}`);
}

async function buscarAnalise(id: number | string): Promise<AnaliseGPT | null> {
  const idNum = typeof id === 'string' ? parseInt(id) : id;

  const { data, error } = await getSupabase()
    .from('gpt_analises')
    .select('classificacao, analise, modelo, tokens_utilizados, created_at, updated_at')
    .eq('id_assistencia', idNum)
    .maybeSingle();

  if (error) {
    console.error(`❌ Erro ao buscar análise na tabela gpt_analises:`, error);
    return null;
  }

  if (!data) return null;

  return {
    classificacao: data.classificacao,
    analise: data.analise,
    data_analise: data.updated_at || data.created_at,
    modelo: data.modelo,
    tokens_utilizados: data.tokens_utilizados,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 📡 ROTAS
// ═══════════════════════════════════════════════════════════════════

// POST /analyze/:id - Analisar um chamado individual
openaiRoutes.post('/analyze/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    if (isNaN(id)) {
      return c.json({ success: false, error: 'ID inválido' }, 400);
    }

    const { descricao_cliente, categoria_reparo, empreendimento, bloco, unidade, proprietario } = body;

    if (!descricao_cliente || !categoria_reparo) {
      return c.json({
        success: false,
        error: 'descricao_cliente e categoria_reparo são obrigatórios',
      }, 400);
    }

    console.log(`🤖 [POST /analyze/${id}] Iniciando análise GPT...`);

    const analise = await analisarChamadoComGPT({
      id,
      descricao_cliente,
      categoria_reparo,
      empreendimento,
      bloco,
      unidade,
      proprietario,
    });

    // Salvar na tabela gpt_analises
    await salvarAnalise(id, analise);

    return c.json({
      success: true,
      data: {
        id_assistencia: id,
        ...analise,
      },
    });
  } catch (error) {
    console.error(`❌ Erro ao analisar chamado:`, error);
    return c.json({
      success: false,
      error: `Erro ao analisar chamado: ${error instanceof Error ? error.message : String(error)}`,
    }, 500);
  }
});

// GET /analysis/:id - Buscar análise existente
openaiRoutes.get('/analysis/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ success: false, error: 'ID inválido' }, 400);
    }

    const analise = await buscarAnalise(id);

    if (!analise) {
      return c.json({
        success: false,
        error: 'Análise não encontrada para este chamado',
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        id_assistencia: id,
        ...analise,
      },
    });
  } catch (error) {
    console.error(`❌ Erro ao buscar análise:`, error);
    return c.json({
      success: false,
      error: `Erro ao buscar análise: ${String(error)}`,
    }, 500);
  }
});

// POST /analyze-batch - Analisar múltiplos chamados de uma vez
openaiRoutes.post('/analyze-batch', async (c) => {
  try {
    const body = await c.req.json();
    const { chamados } = body;

    if (!Array.isArray(chamados) || chamados.length === 0) {
      return c.json({
        success: false,
        error: 'Envie um array de chamados com id, descricao_cliente e categoria_reparo',
      }, 400);
    }

    // Limitar a 20 chamados por batch para evitar timeout
    const batch = chamados.slice(0, 20);
    console.log(`🤖 [POST /analyze-batch] Analisando ${batch.length} chamados...`);

    const resultados: Array<{ id: number; success: boolean; data?: any; error?: string }> = [];

    // Processar sequencialmente para não exceder rate limit da OpenAI
    for (const chamado of batch) {
      try {
        // Verificar se já existe análise
        const existente = await buscarAnalise(chamado.id);
        if (existente) {
          console.log(`⏭️ Chamado #${chamado.id} já tem análise, pulando...`);
          resultados.push({
            id: chamado.id,
            success: true,
            data: { id_assistencia: chamado.id, ...existente, cached: true },
          });
          continue;
        }

        const analise = await analisarChamadoComGPT({
          id: chamado.id,
          descricao_cliente: chamado.descricao_cliente,
          categoria_reparo: chamado.categoria_reparo,
          empreendimento: chamado.empreendimento,
          bloco: chamado.bloco,
          unidade: chamado.unidade,
          proprietario: chamado.proprietario,
        });

        await salvarAnalise(chamado.id, analise);

        resultados.push({
          id: chamado.id,
          success: true,
          data: { id_assistencia: chamado.id, ...analise },
        });

        // Pequeno delay entre chamadas para respeitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`❌ Erro ao analisar chamado #${chamado.id}:`, err);
        resultados.push({
          id: chamado.id,
          success: false,
          error: String(err),
        });
      }
    }

    const sucessos = resultados.filter(r => r.success).length;
    const falhas = resultados.filter(r => !r.success).length;

    console.log(`✅ Batch concluído: ${sucessos} sucesso(s), ${falhas} falha(s)`);

    return c.json({
      success: true,
      total: batch.length,
      analisados: sucessos,
      falhas,
      resultados,
    });
  } catch (error) {
    console.error(`❌ Erro no batch de análise:`, error);
    return c.json({
      success: false,
      error: `Erro no batch: ${String(error)}`,
    }, 500);
  }
});

// GET /analyses - Buscar múltiplas análises por IDs
openaiRoutes.get('/analyses', async (c) => {
  try {
    const idsParam = c.req.query('ids');

    if (!idsParam) {
      return c.json({ success: false, error: 'Parâmetro ids é obrigatório (comma-separated)' }, 400);
    }

    const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (ids.length === 0) {
      return c.json({ success: false, error: 'Nenhum ID válido fornecido' }, 400);
    }

    console.log(`📊 [GET /analyses] Buscando análises para ${ids.length} chamados na tabela gpt_analises...`);

    // Query direta na tabela relacional com IN clause
    const { data: rows, error } = await getSupabase()
      .from('gpt_analises')
      .select('id_assistencia, classificacao, analise, modelo, tokens_utilizados, created_at, updated_at')
      .in('id_assistencia', ids);

    if (error) {
      console.error('❌ Erro ao buscar análises na tabela gpt_analises:', error);
      return c.json({ success: false, error: `Erro ao buscar análises: ${error.message}` }, 500);
    }

    // Montar mapa id -> analise (mesmo formato que o frontend espera)
    const analyses: Record<number, any> = {};

    if (rows && Array.isArray(rows)) {
      rows.forEach((row: any) => {
        analyses[row.id_assistencia] = {
          id_assistencia: row.id_assistencia,
          classificacao: row.classificacao,
          analise: row.analise,
          data_analise: row.updated_at || row.created_at,
          modelo: row.modelo,
          tokens_utilizados: row.tokens_utilizados,
        };
      });
    }

    console.log(`✅ Encontradas ${Object.keys(analyses).length}/${ids.length} análises`);

    return c.json({
      success: true,
      data: analyses,
      total: Object.keys(analyses).length,
    });
  } catch (error) {
    console.error(`❌ Erro ao buscar análises:`, error);
    return c.json({
      success: false,
      error: `Erro ao buscar análises: ${String(error)}`,
    }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🔄 FUNÇÃO EXPORTADA: Auto-análise para ser chamada pelo fluxo de criação
// ═══════════════════════════════════════════════════════════════════

async function analisarChamadoAutomatico(ticket: TicketData): Promise<void> {
  try {
    console.log(`🤖 [AUTO] Iniciando análise automática do chamado #${ticket.id}...`);
    const analise = await analisarChamadoComGPT(ticket);
    await salvarAnalise(ticket.id, analise);
    console.log(`✅ [AUTO] Análise automática concluída: ${analise.classificacao}`);
  } catch (error) {
    // Não propagar erro - análise automática é fire-and-forget
    console.error(`❌ [AUTO] Erro na análise automática do chamado #${ticket.id}:`, error);
  }
}

export { openaiRoutes, analisarChamadoAutomatico };