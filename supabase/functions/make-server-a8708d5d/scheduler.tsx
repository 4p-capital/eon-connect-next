import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

export const schedulerRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// 📅 SISTEMA DE AGENDAMENTO - DISPAROS AUTOMÁTICOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Interface do Evento de Solicitação
 */
interface EventoSolicitacao {
  id: string;
  insumo_id: string;
  insumo_nome: string;
  servico_id: string;
  servico_nome: string;
  obra_id: string;
  obra_nome: string;
  etapa_id: string;
  etapa_nome: string;
  data_solicitacao: string;
  tempo_producao_dias: number;
  gap_dias: number;
  quantidade: number;
  unidade_medida: string;
  data_disparo: string;
  tipo_evento: 'solicitacao_insumo';
  status_processamento: 'pendente' | 'processado' | 'erro';
  tentativas: number;
  erro_mensagem?: string;
  created_at: string;
}

/**
 * Configuração do scheduler
 */
interface SchedulerConfig {
  enabled: boolean;
  last_run: string;
  next_run: string;
  timezone: string;
  run_hour: number; // Hora do dia para rodar (0-23)
}

// ═══════════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se duas datas são do mesmo dia (ignora hora/minuto)
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Formata data para YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Busca configuração do scheduler
 */
async function getSchedulerConfig(): Promise<SchedulerConfig> {
  const config = await kv.get('scheduler_config');
  
  if (!config) {
    // Configuração padrão
    const defaultConfig: SchedulerConfig = {
      enabled: true,
      last_run: new Date(0).toISOString(),
      next_run: new Date().toISOString(),
      timezone: 'America/Sao_Paulo',
      run_hour: 6, // 6h da manhã por padrão
    };
    
    await kv.set('scheduler_config', defaultConfig);
    return defaultConfig;
  }
  
  return config as SchedulerConfig;
}

/**
 * Atualiza configuração do scheduler
 */
async function updateSchedulerConfig(config: Partial<SchedulerConfig>): Promise<void> {
  const currentConfig = await getSchedulerConfig();
  const newConfig = { ...currentConfig, ...config };
  await kv.set('scheduler_config', newConfig);
}

/**
 * Busca todos os insumos vinculados dos planejamentos
 */
async function buscarInsumosVinculados() {
  try {
    // Buscar todos os insumos vinculados
    const insumosVinculados = await kv.getByPrefix('insumo_vinculado_');
    
    // Buscar serviços vinculados para obter contexto
    const servicosVinculados = await kv.getByPrefix('servico_vinculado_');
    const servicosMap = new Map(
      servicosVinculados.map((s: any) => [s.value.id, s.value])
    );
    
    // Buscar etapas para obter obras
    const etapas = await kv.getByPrefix('etapa_');
    const etapasMap = new Map(
      etapas.map((e: any) => [e.value.id, e.value])
    );
    
    // Buscar obras
    const obras = await kv.getByPrefix('obra_');
    const obrasMap = new Map(
      obras.map((o: any) => [o.value.id, o.value])
    );
    
    // Processar e enriquecer dados dos insumos
    const insumosEnriquecidos = [];
    
    for (const item of insumosVinculados) {
      const insumo = item.value;
      
      // Extrair servico_vinculado_id do insumo_id
      // Formato: insumo_vinculado_servicoVinculadoId_timestamp_random
      const parts = insumo.id.split('_');
      let servicoVinculadoId = '';
      
      // Buscar o servico_vinculado correspondente
      for (let i = 2; i < parts.length - 2; i++) {
        const testId = parts.slice(0, i + 1).join('_');
        if (servicosMap.has(testId)) {
          servicoVinculadoId = testId;
          break;
        }
      }
      
      const servicoVinculado = servicosMap.get(servicoVinculadoId);
      if (!servicoVinculado) continue;
      
      // Extrair etapa_id do servico_vinculado_id
      // Formato: servico_vinculado_etapaId_timestamp_random
      const servicoParts = servicoVinculado.id.split('_');
      let etapaId = '';
      
      for (let i = 2; i < servicoParts.length - 2; i++) {
        const testId = servicoParts.slice(0, i + 1).join('_');
        if (etapasMap.has(testId)) {
          etapaId = testId;
          break;
        }
      }
      
      const etapa = etapasMap.get(etapaId);
      if (!etapa) continue;
      
      const obra = obrasMap.get(etapa.obra_id);
      if (!obra) continue;
      
      insumosEnriquecidos.push({
        ...insumo,
        servico_id: servicoVinculado.id,
        servico_nome: servicoVinculado.servico_nome,
        servico_data_inicio: servicoVinculado.data_inicio,
        servico_gap_dias: servicoVinculado.gap_dias || 0,
        etapa_id: etapa.id,
        etapa_nome: etapa.nome,
        obra_id: obra.id,
        obra_nome: obra.nome,
      });
    }
    
    return insumosEnriquecidos;
  } catch (error) {
    console.error('❌ Erro ao buscar insumos vinculados:', error);
    return [];
  }
}

/**
 * Cria evento de solicitação
 */
async function criarEventoSolicitacao(insumo: any): Promise<EventoSolicitacao> {
  const eventoId = `evento_solicitacao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const evento: EventoSolicitacao = {
    id: eventoId,
    insumo_id: insumo.id,
    insumo_nome: insumo.nome,
    servico_id: insumo.servico_id,
    servico_nome: insumo.servico_nome,
    obra_id: insumo.obra_id,
    obra_nome: insumo.obra_nome,
    etapa_id: insumo.etapa_id,
    etapa_nome: insumo.etapa_nome,
    data_solicitacao: insumo.data_solicitacao,
    tempo_producao_dias: insumo.tempo_producao_dias,
    gap_dias: insumo.servico_gap_dias,
    quantidade: insumo.quantidade || 0,
    unidade_medida: insumo.unidade_medida || '',
    data_disparo: new Date().toISOString(),
    tipo_evento: 'solicitacao_insumo',
    status_processamento: 'pendente',
    tentativas: 0,
    created_at: new Date().toISOString(),
  };
  
  await kv.set(eventoId, evento);
  
  console.log(`📅 Evento criado: ${eventoId} - ${insumo.nome} (${insumo.obra_nome})`);
  
  return evento;
}

/**
 * Processa evento de solicitação
 */
async function processarEvento(evento: EventoSolicitacao): Promise<boolean> {
  try {
    console.log(`⚙️ Processando evento ${evento.id}...`);
    
    // Aqui você pode adicionar lógica personalizada:
    // - Enviar notificação por email
    // - Enviar mensagem WhatsApp
    // - Criar tarefa no sistema
    // - Integrar com sistema externo
    // - Atualizar status do insumo
    
    // Por enquanto, vamos criar uma notificação no sistema
    const notificacaoId = `notificacao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notificacao = {
      id: notificacaoId,
      tipo: 'solicitacao_insumo',
      titulo: `⏰ Solicitação de Insumo - ${evento.insumo_nome}`,
      mensagem: `É hora de solicitar o insumo "${evento.insumo_nome}" para o serviço "${evento.servico_nome}" da obra "${evento.obra_nome}". Tempo de produção: ${evento.tempo_producao_dias} dias.`,
      prioridade: 'alta',
      lida: false,
      evento_id: evento.id,
      insumo_id: evento.insumo_id,
      servico_id: evento.servico_id,
      obra_id: evento.obra_id,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(notificacaoId, notificacao);
    
    // Atualizar status do evento
    evento.status_processamento = 'processado';
    evento.tentativas += 1;
    await kv.set(evento.id, evento);
    
    console.log(`✅ Evento processado com sucesso: ${evento.id}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Erro ao processar evento ${evento.id}:`, error);
    
    // Atualizar evento com erro
    evento.status_processamento = 'erro';
    evento.tentativas += 1;
    evento.erro_mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    await kv.set(evento.id, evento);
    
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🔄 FUNÇÃO PRINCIPAL DE VERIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica e dispara eventos para insumos com data de solicitação = hoje
 * 
 * @param dataReferencia - Data de referência para comparação (para testes). Se não informada, usa data atual
 * @returns Estatísticas da execução
 */
async function verificarEDisparar(dataReferencia?: Date) {
  const inicio = Date.now();
  const dataVerificacao = dataReferencia || new Date();
  const dataVerificacaoStr = formatDate(dataVerificacao);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 VERIFICAÇÃO DE SOLICITAÇÕES - ${dataVerificacaoStr}`);
  console.log(`${'='.repeat(70)}\n`);
  console.log(`📅 Data de referência: ${dataReferencia ? 'TESTE/EMULAÇÃO' : 'HOJE (PRODUÇÃO)'}`);
  console.log(`📅 Data formatada para comparação: ${dataVerificacaoStr}`);
  console.log(`⏰ Timestamp UTC: ${dataVerificacao.toISOString()}\n`);
  
  try {
    // Buscar todos os insumos vinculados
    const insumos = await buscarInsumosVinculados();
    
    console.log(`📦 Total de insumos vinculados: ${insumos.length}`);
    
    if (insumos.length === 0) {
      console.log(`⚠️ ATENÇÃO: Nenhum insumo vinculado encontrado!`);
    }
    
    // Filtrar insumos que precisam ser solicitados hoje
    const insumosParaSolicitar = insumos.filter(insumo => {
      // Verificar se tem data de solicitação válida
      if (!insumo.data_solicitacao) {
        console.log(`⚠️ Insumo "${insumo.nome}" sem data_solicitacao - IGNORADO`);
        return false;
      }
      
      // Verificar se ainda está pendente
      if (insumo.status !== 'pendente') {
        console.log(`⚠️ Insumo "${insumo.nome}" com status "${insumo.status}" (não pendente) - IGNORADO`);
        return false;
      }
      
      // Comparar data de solicitação com data de verificação
      const dataSolicitacao = new Date(insumo.data_solicitacao);
      const isSame = isSameDay(dataSolicitacao, dataVerificacao);
      
      // DEBUG: Log detalhado para TODOS os insumos
      console.log(`\n🔍 Verificando insumo: ${insumo.nome}`);
      console.log(`   • ID: ${insumo.id}`);
      console.log(`   • Serviço: ${insumo.servico_nome}`);
      console.log(`   • Obra: ${insumo.obra_nome}`);
      console.log(`   • data_solicitacao (DB): ${insumo.data_solicitacao}`);
      console.log(`   • data_solicitacao (Date): ${dataSolicitacao.toISOString()}`);
      console.log(`   • data_verificacao: ${dataVerificacao.toISOString()}`);
      console.log(`   • status: ${insumo.status}`);
      console.log(`   • tempo_producao_dias: ${insumo.tempo_producao_dias}`);
      console.log(`   • gap_dias: ${insumo.gap_dias}`);
      console.log(`   • ✅ isSameDay: ${isSame ? 'SIM - SERÁ DISPARADO!' : 'NÃO - ignorado'}`);
      
      return isSame;
    });
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`⏰ Insumos com data de solicitação = ${dataVerificacaoStr}: ${insumosParaSolicitar.length}`);
    console.log(`${'─'.repeat(70)}\n`);
    
    if (insumosParaSolicitar.length > 0) {
      console.log(`📋 LISTA DE INSUMOS QUE SERÃO DISPARADOS:`);
      insumosParaSolicitar.forEach((insumo, idx) => {
        console.log(`   ${idx + 1}. ${insumo.nome} (Serviço: ${insumo.servico_nome}, Obra: ${insumo.obra_nome})`);
      });
      console.log('');
    } else {
      console.log(`ℹ️ Nenhum insumo encontrado para disparar na data ${dataVerificacaoStr}\n`);
    }
    
    // Verificar se já existem eventos criados para esses insumos hoje
    const eventosExistentes = await kv.getByPrefix('evento_solicitacao_');
    const insumosComEventoHoje = new Set(
      eventosExistentes
        .filter((e: any) => {
          const dataDisparo = new Date(e.value.data_disparo);
          return isSameDay(dataDisparo, dataVerificacao);
        })
        .map((e: any) => e.value.insumo_id)
    );
    
    // Filtrar insumos que ainda não têm evento criado hoje
    const insumosNovos = insumosParaSolicitar.filter(
      i => !insumosComEventoHoje.has(i.id)
    );
    
    console.log(`🆕 Insumos sem evento criado hoje: ${insumosNovos.length}`);
    
    // Criar eventos para os novos insumos
    const eventosNovos: EventoSolicitacao[] = [];
    for (const insumo of insumosNovos) {
      const evento = await criarEventoSolicitacao(insumo);
      eventosNovos.push(evento);
    }
    
    // Processar eventos pendentes
    const eventosPendentes = await kv.getByPrefix('evento_solicitacao_');
    const eventosParaProcessar = eventosPendentes.filter((e: any) => {
      return e.value.status_processamento === 'pendente' || 
             (e.value.status_processamento === 'erro' && e.value.tentativas < 3);
    });
    
    console.log(`📋 Eventos pendentes para processar: ${eventosParaProcessar.length}`);
    
    let processadosComSucesso = 0;
    let processadosComErro = 0;
    
    for (const item of eventosParaProcessar) {
      const sucesso = await processarEvento(item.value);
      if (sucesso) {
        processadosComSucesso++;
      } else {
        processadosComErro++;
      }
    }
    
    // Atualizar configuração do scheduler
    await updateSchedulerConfig({
      last_run: new Date().toISOString(),
    });
    
    const duracao = Date.now() - inicio;
    
    const estatisticas = {
      data_verificacao: dataVerificacaoStr,
      total_insumos: insumos.length,
      insumos_para_solicitar: insumosParaSolicitar.length,
      eventos_novos: eventosNovos.length,
      eventos_processados_sucesso: processadosComSucesso,
      eventos_processados_erro: processadosComErro,
      duracao_ms: duracao,
      timestamp: new Date().toISOString(),
    };
    
    // Salvar log da execução
    const logId = `scheduler_log_${Date.now()}`;
    await kv.set(logId, estatisticas);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ VERIFICAÇÃO CONCLUÍDA`);
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 Estatísticas:`);
    console.log(`   • Eventos novos criados: ${eventosNovos.length}`);
    console.log(`   • Eventos processados com sucesso: ${processadosComSucesso}`);
    console.log(`   • Eventos com erro: ${processadosComErro}`);
    console.log(`   • Duração: ${duracao}ms`);
    console.log(`${'='.repeat(70)}\n`);
    
    return estatisticas;
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🛣️ ROTAS DO SCHEDULER
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /scheduler/run - Executa verificação manual
 * Body (opcional): { data_referencia: "2025-12-16" }
 */
schedulerRoutes.post('/run', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    
    let dataReferencia: Date | undefined;
    if (body.data_referencia) {
      dataReferencia = new Date(body.data_referencia);
      if (isNaN(dataReferencia.getTime())) {
        return c.json({ error: 'Data de referência inválida' }, 400);
      }
    }
    
    const estatisticas = await verificarEDisparar(dataReferencia);
    
    return c.json({
      success: true,
      message: 'Verificação executada com sucesso',
      estatisticas,
    });
  } catch (error) {
    console.error('❌ Erro ao executar scheduler:', error);
    return c.json({ 
      error: 'Erro ao executar verificação de solicitações',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

/**
 * GET /scheduler/config - Obter configuração
 */
schedulerRoutes.get('/config', async (c) => {
  try {
    const config = await getSchedulerConfig();
    return c.json(config);
  } catch (error) {
    console.error('❌ Erro ao obter configuração:', error);
    return c.json({ error: 'Erro ao obter configuração do scheduler' }, 500);
  }
});

/**
 * PUT /scheduler/config - Atualizar configuração
 */
schedulerRoutes.put('/config', async (c) => {
  try {
    const body = await c.req.json();
    await updateSchedulerConfig(body);
    
    const config = await getSchedulerConfig();
    return c.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      config,
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar configuração:', error);
    return c.json({ error: 'Erro ao atualizar configuração' }, 500);
  }
});

/**
 * GET /scheduler/eventos - Listar eventos
 */
schedulerRoutes.get('/eventos', async (c) => {
  try {
    const eventos = await kv.getByPrefix('evento_solicitacao_');
    const eventosArray = eventos
      .map((e: any) => e.value)
      .sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    
    return c.json(eventosArray);
  } catch (error) {
    console.error('❌ Erro ao listar eventos:', error);
    return c.json({ error: 'Erro ao listar eventos' }, 500);
  }
});

/**
 * GET /scheduler/notificacoes - Listar notificações
 */
schedulerRoutes.get('/notificacoes', async (c) => {
  try {
    const notificacoes = await kv.getByPrefix('notificacao_');
    const notificacoesArray = notificacoes
      .map((n: any) => n.value)
      .sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    
    return c.json(notificacoesArray);
  } catch (error) {
    console.error('❌ Erro ao listar notificações:', error);
    return c.json({ error: 'Erro ao listar notificações' }, 500);
  }
});

/**
 * POST /scheduler/notificacoes/:id/marcar-lida - Marcar notificação como lida
 */
schedulerRoutes.post('/notificacoes/:id/marcar-lida', async (c) => {
  try {
    const notificacaoId = c.req.param('id');
    const notificacao = await kv.get(notificacaoId);
    
    if (!notificacao) {
      return c.json({ error: 'Notificação não encontrada' }, 404);
    }
    
    const notificacaoAtualizada = {
      ...notificacao,
      lida: true,
      lida_em: new Date().toISOString(),
    };
    
    await kv.set(notificacaoId, notificacaoAtualizada);
    
    return c.json({
      success: true,
      message: 'Notificação marcada como lida',
      notificacao: notificacaoAtualizada,
    });
  } catch (error) {
    console.error('❌ Erro ao marcar notificação:', error);
    return c.json({ error: 'Erro ao marcar notificação como lida' }, 500);
  }
});

/**
 * GET /scheduler/logs - Obter logs de execução
 */
schedulerRoutes.get('/logs', async (c) => {
  try {
    const logs = await kv.getByPrefix('scheduler_log_');
    const logsArray = logs
      .map((l: any) => l.value)
      .sort((a: any, b: any) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, 50); // Últimos 50 logs
    
    return c.json(logsArray);
  } catch (error) {
    console.error('❌ Erro ao obter logs:', error);
    return c.json({ error: 'Erro ao obter logs de execução' }, 500);
  }
});

/**
 * GET /scheduler/status - Status geral do scheduler
 */
schedulerRoutes.get('/status', async (c) => {
  try {
    const config = await getSchedulerConfig();
    const eventos = await kv.getByPrefix('evento_solicitacao_');
    const notificacoes = await kv.getByPrefix('notificacao_');
    
    const eventosPorStatus = {
      pendente: eventos.filter((e: any) => e.value.status_processamento === 'pendente').length,
      processado: eventos.filter((e: any) => e.value.status_processamento === 'processado').length,
      erro: eventos.filter((e: any) => e.value.status_processamento === 'erro').length,
    };
    
    const notificacoesNaoLidas = notificacoes.filter((n: any) => !n.value.lida).length;
    
    return c.json({
      config,
      estatisticas: {
        total_eventos: eventos.length,
        eventos_por_status: eventosPorStatus,
        total_notificacoes: notificacoes.length,
        notificacoes_nao_lidas: notificacoesNaoLidas,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao obter status:', error);
    return c.json({ error: 'Erro ao obter status do scheduler' }, 500);
  }
});

/**
 * POST /scheduler/test-emular-data - Emular execução em uma data específica (para testes)
 * Body: { data: "2025-12-16" }
 */
schedulerRoutes.post('/test-emular-data', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.data) {
      return c.json({ error: 'Data é obrigatória. Use formato: YYYY-MM-DD' }, 400);
    }
    
    const dataEmulada = new Date(body.data);
    
    if (isNaN(dataEmulada.getTime())) {
      return c.json({ error: 'Data inválida. Use formato: YYYY-MM-DD' }, 400);
    }
    
    console.log(`🧪 MODO TESTE - Emulando verificação na data: ${formatDate(dataEmulada)}`);
    
    const estatisticas = await verificarEDisparar(dataEmulada);
    
    return c.json({
      success: true,
      message: `Teste executado com sucesso para a data ${formatDate(dataEmulada)}`,
      modo: 'emulacao',
      data_emulada: formatDate(dataEmulada),
      estatisticas,
    });
  } catch (error) {
    console.error('❌ Erro ao emular data:', error);
    return c.json({ 
      error: 'Erro ao executar emulação',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, 500);
  }
});

/**
 * GET /scheduler/proximas-solicitacoes - Listar próximas solicitações (próximos 30 dias)
 */
schedulerRoutes.get('/proximas-solicitacoes', async (c) => {
  try {
    const insumos = await buscarInsumosVinculados();
    const hoje = new Date();
    const daquiA30Dias = new Date(hoje);
    daquiA30Dias.setDate(daquiA30Dias.getDate() + 30);
    
    const proximasSolicitacoes = insumos
      .filter(i => {
        if (!i.data_solicitacao || i.status !== 'pendente') return false;
        const dataSolicitacao = new Date(i.data_solicitacao);
        return dataSolicitacao >= hoje && dataSolicitacao <= daquiA30Dias;
      })
      .map(i => ({
        insumo_id: i.id,
        insumo_nome: i.nome,
        servico_nome: i.servico_nome,
        obra_nome: i.obra_nome,
        data_solicitacao: i.data_solicitacao,
        tempo_producao_dias: i.tempo_producao_dias,
        gap_dias: i.servico_gap_dias,
        dias_faltam: Math.ceil((new Date(i.data_solicitacao).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime());
    
    return c.json({
      total: proximasSolicitacoes.length,
      periodo: {
        inicio: formatDate(hoje),
        fim: formatDate(daquiA30Dias),
      },
      solicitacoes: proximasSolicitacoes,
    });
  } catch (error) {
    console.error('❌ Erro ao listar próximas solicitações:', error);
    return c.json({ error: 'Erro ao listar próximas solicitações' }, 500);
  }
});

/**
 * DELETE /scheduler/limpar-dados-teste - Limpar eventos e notificações de teste
 */
schedulerRoutes.delete('/limpar-dados-teste', async (c) => {
  try {
    const eventos = await kv.getByPrefix('evento_solicitacao_');
    const notificacoes = await kv.getByPrefix('notificacao_');
    const logs = await kv.getByPrefix('scheduler_log_');
    
    const keysToDelete = [
      ...eventos.map((e: any) => e.value.id),
      ...notificacoes.map((n: any) => n.value.id),
      ...logs.map((l: any) => Object.keys(l)[0]), // pegar a key do log
    ];
    
    if (keysToDelete.length > 0) {
      await kv.mdel(keysToDelete);
    }
    
    return c.json({
      success: true,
      message: 'Dados de teste limpos com sucesso',
      removidos: {
        eventos: eventos.length,
        notificacoes: notificacoes.length,
        logs: logs.length,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
    return c.json({ error: 'Erro ao limpar dados de teste' }, 500);
  }
});

/**
 * GET /scheduler/debug-insumos - Debug: listar todos os insumos com suas datas
 */
schedulerRoutes.get('/debug-insumos', async (c) => {
  try {
    const insumos = await buscarInsumosVinculados();
    
    const insumosDebug = insumos.map(i => ({
      id: i.id,
      nome: i.nome,
      obra_nome: i.obra_nome,
      servico_nome: i.servico_nome,
      data_solicitacao: i.data_solicitacao,
      status: i.status,
      tempo_producao_dias: i.tempo_producao_dias,
    }));
    
    return c.json({
      total: insumosDebug.length,
      insumos: insumosDebug,
    });
  } catch (error) {
    console.error('❌ Erro ao debug insumos:', error);
    return c.json({ error: 'Erro ao listar insumos para debug' }, 500);
  }
});