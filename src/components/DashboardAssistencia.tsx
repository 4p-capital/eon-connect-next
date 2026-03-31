"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Building2, Package, Users, Star, AlertCircle, Calendar, Filter, X, ClipboardList, CheckCircle2, ShieldCheck } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import type { Solicitacao } from '@/components/GerenciamentoAssistencia';
import { AIInsights } from '@/components/AIInsights';

const CORES_GRAFICO = [
  '#3B82F6', // Azul
  '#111111', // Preto
  '#10B981', // Verde
  '#F59E0B', // Amarelo
  '#EF4444', // Vermelho
  '#06B6D4', // Cyan
  '#EC4899', // Rosa
  '#F97316', // Laranja
];

interface DadosAgrupados {
  nome: string;
  total: number;
}

interface InsumoUtilizado {
  id: number;
  material_utilizado?: string; // ✅ CORRIGIDO: Nome correto do campo no banco
  medida?: string; // ✅ CORRIGIDO: Nome correto do campo no banco
  quantidade?: number;
  Empreendimento?: string; // ✅ Campo adicionado
  id_finalizacao?: number; // ✅ Campo adicionado
  created_at?: string;
  [key: string]: any; // Permite outros campos que possam existir
}

interface AssistenciaFinalizada {
  id: number;
  status: string;
  responsaveis?: string[] | string; // Pode ser array ou string
  nps?: number;
}

export function DashboardAssistencia() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [assistenciasFinalizadas, setAssistenciasFinalizadas] = useState<AssistenciaFinalizada[]>([]);
  const [insumosUtilizados, setInsumosUtilizados] = useState<InsumoUtilizado[]>([]);
  const [desqualificados, setDesqualificados] = useState<any[]>([]);
  const [totalDesqualificadosBackend, setTotalDesqualificadosBackend] = useState<number>(0);
  const [totalGeralTabelaBackend, setTotalGeralTabelaBackend] = useState<number>(0);
  const [totalGeralPeriodoBackend, setTotalGeralPeriodoBackend] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  
  // Estados para filtro de data
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [paginaInsumos, setPaginaInsumos] = useState(1);
  const ITENS_POR_PAGINA_INSUMOS = 50;

  // Função para aplicar filtros rápidos
  const aplicarFiltroRapido = (periodo: string) => {
    const hoje = new Date();
    let inicio = new Date();
    let fim = new Date();

    switch (periodo) {
      case 'hoje':
        inicio = new Date(hoje);
        fim = new Date(hoje);
        break;
      case '7dias':
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - 7);
        fim = new Date(hoje);
        break;
      case '30dias':
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - 30);
        fim = new Date(hoje);
        break;
      case 'este_mes':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje);
        break;
      case 'mes_passado':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case 'este_ano':
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = new Date(hoje);
        break;
    }

    const formatarData = (data: Date) => {
      return data.toISOString().split('T')[0];
    };

    setDataInicio(formatarData(inicio));
    setDataFim(formatarData(fim));
    setFiltroAtivo(true);
    setPaginaInsumos(1);
  };

  // 🔧 FIX v5: Fetch com timeout + retry automático (cold-start resilience)
  const fetchWithRetry = async (url: string, options: RequestInit = {}, timeoutMs = 15000, maxRetries = 2): Promise<Response> => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        // Se o servidor retornou 546 (WORKER_LIMIT) ou 503, retry
        if ((res.status === 546 || res.status === 503) && attempt < maxRetries) {
          console.warn(`⚠️ Servidor retornou ${res.status}, retry ${attempt + 1}/${maxRetries}...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); // Backoff: 2s, 4s
          continue;
        }
        return res;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (attempt < maxRetries) {
          console.warn(`⚠️ Fetch ${isAbort ? 'timeout' : 'erro'} (tentativa ${attempt + 1}/${maxRetries + 1}), retrying...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;

      // 🚀 OTIMIZAÇÃO: 4 chamadas em PARALELO (era sequencial, travava a UI)
      const [resultAssistencia, resultFinalizadas, resultInsumos, resultDesqualificados] = await Promise.allSettled([
        fetchWithRetry(`${baseUrl}/assistencia`, { headers }),
        fetchWithRetry(`${baseUrl}/assistencia-finalizada`, { headers }),
        fetchWithRetry(`${baseUrl}/itens-utilizados-posobra`, { headers }),
        fetchWithRetry(`${baseUrl}/assistencias-desqualificadas`, { headers }),
      ]);

      // 1) Processar assistências
      if (resultAssistencia.status === 'fulfilled' && resultAssistencia.value.ok) {
        const dataAssistencia = await resultAssistencia.value.json();
        let assistenciasList: Solicitacao[] = [];
        
        if (dataAssistencia.data && Array.isArray(dataAssistencia.data)) {
          // 🔧 FIX: Mapear Empresa?.nome para empresa_nome (backend retorna Empresa: { nome: '...' })
          assistenciasList = dataAssistencia.data.map((item: any) => ({
            ...item,
            empresa_nome: item.Empresa?.nome || item.empresa_nome || null,
          }));
          // 🔧 Extrair contagem de desqualificados do pagination (já vem do /assistencia)
          const desqCount = dataAssistencia.pagination?.totalDesqualificados || 0;
          setTotalDesqualificadosBackend(desqCount);
          // 🔥 Extrair contagem TOTAL da tabela (sem nenhum filtro de situacao/status)
          const totalTabela = dataAssistencia.pagination?.totalGeralTabela || 0;
          setTotalGeralTabelaBackend(totalTabela);
          console.log(`✅ Dashboard: ${assistenciasList.length} solicitações ativas, ${desqCount} desqualificados, ${totalTabela} total tabela (backend count)`);
        } else if (Array.isArray(dataAssistencia)) {
          assistenciasList = dataAssistencia;
        } else {
          console.error('Dashboard: Formato inesperado de assistência:', typeof dataAssistencia);
        }
        setSolicitacoes(assistenciasList);
      } else {
        const reason = resultAssistencia.status === 'rejected' ? resultAssistencia.reason : 'HTTP error';
        console.error('❌ Erro ao carregar assistências:', reason);
        throw new Error('Erro ao carregar dados de assistência');
      }

      // 2) Processar finalizadas
      if (resultFinalizadas.status === 'fulfilled' && resultFinalizadas.value.ok) {
        const dataFinalizadas = await resultFinalizadas.value.json();
        
        if (dataFinalizadas.data && Array.isArray(dataFinalizadas.data)) {
          setAssistenciasFinalizadas(dataFinalizadas.data);
          const aguardando = dataFinalizadas.data.filter((af: any) => af.status === 'Aguardando assinatura').length;
          const finalizado = dataFinalizadas.data.filter((af: any) => af.status === 'Finalizado').length;
          console.log(`✅ Finalizadas: ${dataFinalizadas.data.length} (Aguardando=${aguardando}, Finalizado=${finalizado})`);
          if (dataFinalizadas.pagination) {
            console.log(`📊 Backend: Finalizados=${dataFinalizadas.pagination.totalFinalizados}, Aguardando=${dataFinalizadas.pagination.totalAguardando}`);
          }
        } else if (Array.isArray(dataFinalizadas)) {
          setAssistenciasFinalizadas(dataFinalizadas);
        } else {
          console.warn('⚠️ Formato inesperado de assistência-finalizada');
          setAssistenciasFinalizadas([]);
        }
      } else {
        console.error('⚠️ Erro ao carregar finalizadas:', resultFinalizadas.status === 'rejected' ? resultFinalizadas.reason : 'HTTP error');
        setAssistenciasFinalizadas([]);
      }

      // 3) Processar insumos
      if (resultInsumos.status === 'fulfilled' && resultInsumos.value.ok) {
        const dataInsumos = await resultInsumos.value.json();
        
        if (dataInsumos.data && Array.isArray(dataInsumos.data)) {
          setInsumosUtilizados(dataInsumos.data);
          console.log(`✅ Insumos: ${dataInsumos.data.length} registros`);
        } else if (Array.isArray(dataInsumos)) {
          setInsumosUtilizados(dataInsumos);
        } else {
          setInsumosUtilizados([]);
        }
      } else {
        console.warn('⚠️ Erro ao carregar insumos');
        setInsumosUtilizados([]);
      }

      // 4) Processar desqualificados
      if (resultDesqualificados.status === 'fulfilled' && resultDesqualificados.value.ok) {
        const dataDesqualificados = await resultDesqualificados.value.json();
        
        if (dataDesqualificados.historico && Array.isArray(dataDesqualificados.historico)) {
          setDesqualificados(dataDesqualificados.historico);
          console.log(`✅ Desqualificados: ${dataDesqualificados.historico.length} registros`);
        } else {
          setDesqualificados([]);
        }
      } else {
        console.warn('⚠️ Erro ao carregar desqualificados');
        setDesqualificados([]);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dados da dashboard:', error);
      
      let mensagemErro = 'Erro ao carregar dados da dashboard. ';
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        mensagemErro += 'O servidor demorou para responder (pode estar iniciando). Tente novamente em alguns segundos.';
      } else if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          mensagemErro += 'Verifique sua conexão com a internet e tente novamente.';
        } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
          mensagemErro += 'O servidor demorou muito para responder. Tente novamente.';
        } else {
          mensagemErro += 'Por favor, tente novamente.';
        }
      } else {
        mensagemErro += 'Erro desconhecido. Por favor, tente novamente.';
      }
      
      setErro(mensagemErro);
      setSolicitacoes([]);
      setAssistenciasFinalizadas([]);
      setInsumosUtilizados([]);
      setDesqualificados([]);
      setTotalDesqualificadosBackend(0);
      setTotalGeralTabelaBackend(0);
      setTotalGeralPeriodoBackend(null);
    } finally {
      setLoading(false);
    }
  };

  // 📊 Buscar contagem total da tabela Assistência Técnica por período (endpoint leve, sem dados)
  const fetchContagemPeriodo = useCallback(async (inicio: string, fim: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;
      const res = await fetchWithRetry(
        `${baseUrl}/assistencia-count?dataInicio=${encodeURIComponent(inicio)}&dataFim=${encodeURIComponent(fim)}`,
        { headers },
        10000, 1
      );
      if (res.ok) {
        const data = await res.json();
        setTotalGeralPeriodoBackend(data.total || 0);
        console.log(`📊 Contagem período ${inicio} a ${fim}: ${data.total} registros na tabela Assistência Técnica`);
      } else {
        console.error('❌ Erro ao buscar contagem do período:', res.status);
        setTotalGeralPeriodoBackend(null);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar contagem do período:', err);
      setTotalGeralPeriodoBackend(null);
    }
  }, []);

  // Reagir a mudanças de filtro de data: buscar contagem server-side
  useEffect(() => {
    if (filtroAtivo && dataInicio && dataFim) {
      fetchContagemPeriodo(dataInicio, dataFim);
    } else {
      setTotalGeralPeriodoBackend(null);
    }
  }, [filtroAtivo, dataInicio, dataFim, fetchContagemPeriodo]);

  // Função para filtrar por data
  const filtrarPorData = (dados: Solicitacao[]): Solicitacao[] => {
    if (!filtroAtivo || !dataInicio || !dataFim) return dados;
    
    // 🔥 CORRIGIDO: Criar datas locais sem conversão de timezone
    const [anoInicio, mesInicio, diaInicio] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);
    
    return dados.filter(sol => {
      try {
        // 🌎 Converter para horário de São Paulo (UTC-3)
        const dataUTC = new Date(sol.created_at || '');
        const data = new Date(dataUTC.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        const dia = data.getDate();
        
        // Comparar apenas dia/mês/ano, ignorando horário
        const dataRegistro = ano * 10000 + mes * 100 + dia;
        const dataInicioNum = anoInicio * 10000 + mesInicio * 100 + diaInicio;
        const dataFimNum = anoFim * 10000 + mesFim * 100 + diaFim;
        
        return dataRegistro >= dataInicioNum && dataRegistro <= dataFimNum;
      } catch (error) {
        console.error('Erro ao filtrar data:', error);
        return true; // Em caso de erro, incluir o registro
      }
    });
  };

  // Função para filtrar assistências finalizadas por data
  const filtrarFinalizadasPorData = (dados: AssistenciaFinalizada[]): AssistenciaFinalizada[] => {
    if (!filtroAtivo || !dataInicio || !dataFim) return dados;
    
    // 🔥 CORRIGIDO: Criar datas locais sem conversão de timezone
    const [anoInicio, mesInicio, diaInicio] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);
    
    const filtrados = dados.filter((af: any) => {
      try {
        // ✅ CORRIGIDO: Usar created_at da assistencia_finalizada (data de finalização)
        const dataParaFiltrar = af.created_at;
        if (!dataParaFiltrar) {
          console.warn('⚠️ Registro de finalização sem created_at:', af.id);
          return false;
        }
        // 🌎 Converter para horário de São Paulo (UTC-3)
        const dataUTC = new Date(dataParaFiltrar);
        const data = new Date(dataUTC.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        const dia = data.getDate();
        
        // Comparar apenas dia/mês/ano, ignorando horário
        const dataRegistro = ano * 10000 + mes * 100 + dia;
        const dataInicioNum = anoInicio * 10000 + mesInicio * 100 + diaInicio;
        const dataFimNum = anoFim * 10000 + mesFim * 100 + diaFim;
        
        return dataRegistro >= dataInicioNum && dataRegistro <= dataFimNum;
      } catch (error) {
        console.error('Erro ao filtrar data finalizada:', error);
        return true; // Em caso de erro, incluir o registro
      }
    });
    
    return filtrados;
  };

  // Função para filtrar insumos por data
  const filtrarInsumosPorData = (dados: InsumoUtilizado[]): InsumoUtilizado[] => {
    if (!filtroAtivo || !dataInicio || !dataFim) return dados;
    
    // 🔥 CORRIGIDO: Criar datas locais sem conversão de timezone
    const [anoInicio, mesInicio, diaInicio] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);
    
    return dados.filter(insumo => {
      try {
        // 🌎 Converter para horário de São Paulo (UTC-3)
        const dataUTC = new Date(insumo.created_at || '');
        const data = new Date(dataUTC.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        const dia = data.getDate();
        
        // Comparar apenas dia/mês/ano, ignorando horário
        const dataRegistro = ano * 10000 + mes * 100 + dia;
        const dataInicioNum = anoInicio * 10000 + mesInicio * 100 + diaInicio;
        const dataFimNum = anoFim * 10000 + mesFim * 100 + diaFim;
        
        return dataRegistro >= dataInicioNum && dataRegistro <= dataFimNum;
      } catch (error) {
        console.error('Erro ao filtrar data de insumo:', error);
        return true; // Em caso de erro, incluir o registro
      }
    });
  };

  // 🚀 OTIMIZAÇÃO: Pré-filtrar dados uma vez com useMemo (evita recalcular em cada render)
  const solicitacoesFiltradas = useMemo(() => {
    if (!Array.isArray(solicitacoes)) return [];
    return filtroAtivo ? filtrarPorData(solicitacoes) : solicitacoes;
  }, [solicitacoes, filtroAtivo, dataInicio, dataFim]);

  const finalizadasFiltradas = useMemo(() => {
    if (!Array.isArray(assistenciasFinalizadas)) return [];
    return filtroAtivo ? filtrarFinalizadasPorData(assistenciasFinalizadas) : assistenciasFinalizadas;
  }, [assistenciasFinalizadas, filtroAtivo, dataInicio, dataFim]);

  // 🚀 OTIMIZAÇÃO: Todos os agrupamentos/contadores memoizados
  const dadosEmpreendimento = useMemo((): DadosAgrupados[] => {
    const agrupado = solicitacoesFiltradas.reduce((acc, sol) => {
      const key = sol.empreendimento || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(agrupado).map(([nome, total]) => ({ nome, total }));
  }, [solicitacoesFiltradas]);

  const dadosCategoria = useMemo((): DadosAgrupados[] => {
    const agrupado = solicitacoesFiltradas.reduce((acc, sol) => {
      const key = sol.categoria_reparo || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(agrupado).map(([nome, total]) => ({ nome, total }));
  }, [solicitacoesFiltradas]);

  const dadosEmpresa = useMemo((): DadosAgrupados[] => {
    if (!Array.isArray(solicitacoesFiltradas)) return [];
    const agrupado = solicitacoesFiltradas.reduce((acc, sol: any) => {
      // 🔧 FIX: Tentar empresa_nome (já mapeado) ou extrair de Empresa?.nome (fallback)
      const key = sol.empresa_nome || sol.Empresa?.nome || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(agrupado).map(([nome, total]) => ({ nome, total }));
  }, [solicitacoesFiltradas]);

  const dadosResponsavel = useMemo((): DadosAgrupados[] => {
    const agrupado = finalizadasFiltradas.reduce((acc, af) => {
      if (af.responsaveis) {
        const responsaveis = Array.isArray(af.responsaveis) 
          ? af.responsaveis 
          : [af.responsaveis];
        responsaveis.forEach(resp => {
          const key = resp || 'Não informado';
          acc[key] = (acc[key] || 0) + 1;
        });
      } else {
        acc['Não informado'] = (acc['Não informado'] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(agrupado).map(([nome, total]) => ({ nome, total }));
  }, [finalizadasFiltradas]);

  // Contadores memoizados
  const totalAbertos = useMemo(() => solicitacoesFiltradas.filter(sol => sol.status_chamado === 'Abertos' && sol.situacao === 'Ativo').length, [solicitacoesFiltradas]);
  const totalVistoriaAgendada = useMemo(() => solicitacoesFiltradas.filter(sol => sol.status_chamado === 'Vistoria agendada' && sol.situacao === 'Ativo').length, [solicitacoesFiltradas]);
  const totalReparoAgendado = useMemo(() => solicitacoesFiltradas.filter(sol => sol.status_chamado === 'Reparo agendado' && sol.situacao === 'Ativo').length, [solicitacoesFiltradas]);
  const totalAguardandoAssinatura = useMemo(() => finalizadasFiltradas.filter(af => af.status === 'Aguardando assinatura').length, [finalizadasFiltradas]);
  const totalFinalizado = useMemo(() => finalizadasFiltradas.filter(af => af.status === 'Finalizado').length, [finalizadasFiltradas]);
  // 🔧 CORRIGIDO: Desqualificados — duas fontes:
  //   1) pagination.totalDesqualificados (do /assistencia) → contagem rápida sem API extra
  //   2) /assistencias-desqualificadas → dados completos para filtro de data
  const desqualificadosFiltrados = useMemo(() => {
    if (!Array.isArray(desqualificados) || desqualificados.length === 0) return [];
    if (!filtroAtivo || !dataInicio || !dataFim) return desqualificados;
    
    const [anoInicio, mesInicio, diaInicio] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);
    
    return desqualificados.filter((d: any) => {
      try {
        const dataUTC = new Date(d.created_at || '');
        const data = new Date(dataUTC.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const ano = data.getFullYear();
        const mes = data.getMonth() + 1;
        const dia = data.getDate();
        const dataRegistro = ano * 10000 + mes * 100 + dia;
        const dataInicioNum = anoInicio * 10000 + mesInicio * 100 + diaInicio;
        const dataFimNum = anoFim * 10000 + mesFim * 100 + diaFim;
        return dataRegistro >= dataInicioNum && dataRegistro <= dataFimNum;
      } catch { return true; }
    });
  }, [desqualificados, filtroAtivo, dataInicio, dataFim]);
  
  // Sem filtro de data: usar contagem do backend (mais confiável, sem API extra)
  // Com filtro de data: usar dados filtrados do endpoint dedicado
  // Fallback: se o endpoint dedicado falhou, usar contagem do backend
  const totalDesqualificado = useMemo(() => {
    if (!filtroAtivo) {
      // Sem filtro: usar contagem do backend (vem grátis do /assistencia)
      // Se temos dados do endpoint dedicado, usar como fallback mais preciso
      return desqualificados.length > 0 ? desqualificados.length : totalDesqualificadosBackend;
    }
    // Com filtro: usar dados filtrados por data
    return desqualificadosFiltrados.length;
  }, [filtroAtivo, desqualificados, desqualificadosFiltrados, totalDesqualificadosBackend]);

  // NPS memoizado (sem logs excessivos por registro)
  const { media: mediaNPS, total: totalAvaliacoesNPS } = useMemo(() => {
    let soma = 0;
    let totalAvaliacoes = 0;
    
    finalizadasFiltradas.forEach(af => {
      if (af.nps !== undefined && af.nps !== null && (af.nps as any) !== '') {
        const npsNum = typeof af.nps === 'string' ? parseFloat(af.nps as string) : Number(af.nps);
        if (!isNaN(npsNum) && npsNum >= 1 && npsNum <= 10) {
          soma += npsNum;
          totalAvaliacoes++;
        }
      }
    });
    
    if (totalAvaliacoes === 0) return { media: null, total: 0 };
    const media = soma / totalAvaliacoes;
    console.log(`📊 NPS: média=${media.toFixed(1)}, avaliações=${totalAvaliacoes}`);
    return { media, total: totalAvaliacoes };
  }, [finalizadasFiltradas]);
  
  // 📊 Total de Solicitações = contagem real de TODOS os registros da tabela Assistência Técnica
  // Source of truth ÚNICA: count(*) direto da tabela, sem filtro de situacao/status
  // Sem filtro de data: totalGeralTabelaBackend (count sem filtro algum)
  // Com filtro de data: totalGeralPeriodoBackend (count com filtro de created_at, server-side)
  const totalSolicitacoes = useMemo(() => {
    if (!filtroAtivo) {
      return totalGeralTabelaBackend;
    }
    // Com filtro: usar contagem server-side do período (sem filtro de situacao/status)
    if (totalGeralPeriodoBackend !== null) {
      return totalGeralPeriodoBackend;
    }
    // Fallback enquanto a contagem do período está carregando
    return solicitacoesFiltradas.length + totalDesqualificado;
  }, [filtroAtivo, totalGeralTabelaBackend, totalGeralPeriodoBackend, solicitacoesFiltradas, totalDesqualificado]);

  // 📊 Total de Procedentes = Ativo + Inativo (tudo que NÃO é Desqualificado)
  // Cálculo: Total da tabela Assistência Técnica - Desqualificados
  const totalProcedentes = useMemo(() => {
    return Math.max(0, totalSolicitacoes - totalDesqualificado);
  }, [totalSolicitacoes, totalDesqualificado]);

  // 📊 Total de Finalizações = Aguardando assinatura + Finalizado
  // Baseado na data de FINALIZAÇÃO (created_at da assistencia_finalizada)
  const totalFinalizacoes = useMemo(() => {
    return finalizadasFiltradas.length;
  }, [finalizadasFiltradas]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-gray-600">Carregando...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🛡️ Exibir erro amigável se houver
  if (erro) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-40">
            <Card className="max-w-md">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
                    <p className="text-sm text-gray-600 mb-4">{erro}</p>
                    <button
                      onClick={() => {
                        setErro(null);
                        carregarDados();
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header compacto */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 sm:p-3 rounded-xl">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl text-gray-900">Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-600">Análise das solicitações</p>
          </div>
        </div>

        {/* 📅 Filtro de Data */}
        <Card className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            {/* Atalhos Rápidos */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                🚀 Atalhos Rápidos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <button
                  onClick={() => aplicarFiltroRapido('hoje')}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                >
                  Hoje
                </button>
                <button
                  onClick={() => aplicarFiltroRapido('7dias')}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                >
                  Últimos 7 dias
                </button>
                <button
                  onClick={() => aplicarFiltroRapido('30dias')}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                >
                  Últimos 30 dias
                </button>
                <button
                  onClick={() => aplicarFiltroRapido('este_mes')}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                >
                  Este mês
                </button>
                <button
                  onClick={() => aplicarFiltroRapido('mes_passado')}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                >
                  Mês passado
                </button>
                <button
                  onClick={() => aplicarFiltroRapido('este_ano')}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                >
                  Este ano
                </button>
              </div>
            </div>

            {/* Divisor */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-gradient-to-br from-white to-gray-50 text-gray-500 font-medium">
                  ou selecione período personalizado
                </span>
              </div>
            </div>

            {/* Filtro Personalizado */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex items-center gap-2 flex-1 w-full">
                <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Data Início
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (!dataInicio || !dataFim) {
                      alert('Selecione as duas datas');
                      return;
                    }
                    setFiltroAtivo(true);
                  }}
                  disabled={!dataInicio || !dataFim}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg disabled:shadow-none"
                >
                  <Filter className="h-4 w-4" />
                  Aplicar Filtro
                </button>
                {filtroAtivo && (
                  <button
                    onClick={() => {
                      setFiltroAtivo(false);
                      setDataInicio('');
                      setDataFim('');
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
                  >
                    <X className="h-4 w-4" />
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Indicador de Filtro Ativo */}
            {filtroAtivo && (() => {
              // 🔥 CORRIGIDO: Formatar data sem conversão de timezone
              const formatarDataLocal = (dataStr: string) => {
                const [ano, mes, dia] = dataStr.split('-').map(Number);
                const data = new Date(ano, mes - 1, dia); // Construtor local, sem timezone UTC
                return data.toLocaleDateString('pt-BR');
              };
              
              return (
                <div className="mt-4 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-r-lg shadow-sm animate-in slide-in-from-top">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                        <Filter className="h-3 w-3 text-white" />
                      </div>
                      <p className="text-sm font-medium text-blue-900">
                        Filtro ativo: <span className="font-semibold">{formatarDataLocal(dataInicio)}</span> até <span className="font-semibold">{formatarDataLocal(dataFim)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFiltroAtivo(false);
                        setDataInicio('');
                        setDataFim('');
                      }}
                      className="text-blue-700 hover:text-blue-900 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* 📋 SEÇÃO: DADOS DE SOLICITAÇÕES */}
        <div className="space-y-4">
          {/* Título da Seção */}
          <div className="flex items-center gap-3 pb-2 border-b-2 border-blue-200">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dados de Solicitações</h2>
              <p className="text-xs text-gray-600">Assistências abertas e em andamento</p>
            </div>
          </div>

          {/* Cards de métricas - Solicitações */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Total Solicitações */}
            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-blue-100">
                    {filtroAtivo ? 'Total Solicitações no Período' : 'Total Solicitações'}
                  </p>
                  <div className="bg-white/20 p-1.5 rounded-lg">
                    <ClipboardList className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl">{totalSolicitacoes}</p>
              </CardContent>
            </Card>

            {/* Procedentes (Ativo + Inativo) */}
            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 border-0 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-emerald-100">Procedentes</p>
                  <div className="bg-white/20 p-1.5 rounded-lg">
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl">{totalProcedentes}</p>
              </CardContent>
            </Card>

            {/* 1. Abertos */}
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">1. Abertos</p>
                  <div className="bg-sky-100 p-1.5 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-sky-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl text-sky-600">{totalAbertos}</p>
              </CardContent>
            </Card>

            {/* 2. Vistoria */}
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">2. Vistoria</p>
                  <div className="bg-orange-100 p-1.5 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl text-orange-600">{totalVistoriaAgendada}</p>
              </CardContent>
            </Card>

            {/* 3. Reparo */}
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">3. Reparo</p>
                  <div className="bg-gray-100 p-1.5 rounded-lg">
                    <PieChartIcon className="h-4 w-4 text-gray-900" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl text-gray-900">{totalReparoAgendado}</p>
              </CardContent>
            </Card>

            {/* 6. Desqualificado */}
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Desqualificado</p>
                  <div className="bg-red-100 p-1.5 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl text-red-600">{totalDesqualificado}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos - Solicitações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Gráfico por Empresa */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Por Empresa</CardTitle>
                <CardDescription className="text-xs">Distribuição por empresa</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosEmpresa} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="nome" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        padding: '6px 10px'
                      }}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="#3B82F6" 
                      radius={[4, 4, 0, 0]}
                      name="Total"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico por Categoria */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Por Categoria</CardTitle>
                <CardDescription className="text-xs">Tipos de reparo</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosCategoria} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="nome" 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        padding: '6px 10px'
                      }}
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    />
                    <Bar 
                      dataKey="total" 
                      radius={[4, 4, 0, 0]}
                      name="Total"
                    >
                      {dadosCategoria.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico por Condomínio */}
            <Card className="bg-white border border-gray-200 lg:col-span-2">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Por Condomínio</CardTitle>
                <CardDescription className="text-xs">Distribuição por empreendimento</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {dadosEmpreendimento.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <div style={{ minWidth: `${Math.max(300, dadosEmpreendimento.length * 80)}px` }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart 
                          data={dadosEmpreendimento} 
                          margin={{ top: 10, right: 10, left: -10, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="nome" 
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            interval={0}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '12px',
                              padding: '6px 10px'
                            }}
                            cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }}
                          />
                          <Bar 
                            dataKey="total" 
                            fill="#111111" 
                            radius={[4, 4, 0, 0]}
                            name="Total"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-xs text-gray-500">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ✅ SEÇÃO: DADOS DE FINALIZAÇÕES */}
        <div className="space-y-4">
          {/* Título da Seção */}
          <div className="flex items-center gap-3 pb-2 border-b-2 border-green-200">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dados de Finalizações</h2>
              <p className="text-xs text-gray-600">Pós-obra, avaliações e insumos</p>
            </div>
          </div>

          {/* Cards de métricas - Finalizações */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Total Finalizações */}
            <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-green-100">
                    {filtroAtivo ? 'Total Finalizações no Período' : 'Total Finalizações'}
                  </p>
                  <div className="bg-white/20 p-1.5 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl">{totalFinalizacoes}</p>
              </CardContent>
            </Card>

            {/* 4. Assinatura */}
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Aguardando Assinatura</p>
                  <div className="bg-green-100 p-1.5 rounded-lg">
                    <Building2 className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl text-green-600">{totalAguardandoAssinatura}</p>
              </CardContent>
            </Card>

            {/* 5. Finalizado */}
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Finalizado</p>
                  <div className="bg-blue-100 p-1.5 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl text-blue-600">{totalFinalizado}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos - Finalizações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Gráfico por Responsável */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-600" />
                  <div>
                    <CardTitle className="text-sm sm:text-base text-gray-900">Por Responsável</CardTitle>
                    <CardDescription className="text-xs">Distribuição por responsável</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {dadosResponsavel.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dadosResponsavel} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="nome" 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12px',
                          padding: '6px 10px'
                        }}
                        cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="#14B8A6" 
                        radius={[4, 4, 0, 0]}
                        name="Total"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-xs text-gray-500">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de NPS */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <div>
                    <CardTitle className="text-sm sm:text-base text-gray-900">Avaliação NPS</CardTitle>
                    <CardDescription className="text-xs">Média geral de satisfação</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {mediaNPS !== null && totalAvaliacoesNPS > 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <div className="flex items-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-8 w-8 ${
                            star <= Math.round(mediaNPS)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900 mb-1">
                        {mediaNPS.toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Baseado em {totalAvaliacoesNPS} {totalAvaliacoesNPS === 1 ? 'avaliação' : 'avaliações'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-xs text-gray-500">
                    Nenhuma avaliação disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Insumos por Empreendimento */}
          {insumosUtilizados.length > 0 && (() => {
            // 🔥 CORRIGIDO: Aplicar filtro de data
            const insumosFiltrados = filtroAtivo ? filtrarInsumosPorData(insumosUtilizados) : insumosUtilizados;
            
            // Agrupar por empreendimento
            const porEmpreendimento = insumosFiltrados.reduce((acc, insumo) => {
              const empreendimento = insumo.Empreendimento || 'Não informado';
              if (!acc[empreendimento]) {
                acc[empreendimento] = 0;
              }
              acc[empreendimento]++;
              return acc;
            }, {} as Record<string, number>);
            
            const empreendimentos = Object.entries(porEmpreendimento)
              .sort((a, b) => b[1] - a[1]);
            
            return empreendimentos.length > 0 ? (
              <Card className="bg-white border border-gray-200">
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-sm sm:text-base text-gray-900">Insumos por Empreendimento</CardTitle>
                  <CardDescription className="text-xs">Quantidade de registros por empreendimento</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="space-y-3">
                    {empreendimentos.map(([nome, quantidade], index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm text-gray-900">{nome}</span>
                        </div>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                          {quantidade} {quantidade === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Lista Completa de Materiais */}
          {insumosUtilizados.length > 0 && (() => {
            const insumosFiltrados = filtroAtivo ? filtrarInsumosPorData(insumosUtilizados) : insumosUtilizados;
            
            const insumosOrdenados = [...insumosFiltrados].sort((a, b) => {
              const materialA = (a.material_utilizado || 'Zzz').toLowerCase();
              const materialB = (b.material_utilizado || 'Zzz').toLowerCase();
              if (materialA !== materialB) return materialA.localeCompare(materialB);
              const empA = (a.Empreendimento || 'Zzz').toLowerCase();
              const empB = (b.Empreendimento || 'Zzz').toLowerCase();
              return empA.localeCompare(empB);
            });

            const totalPaginas = Math.ceil(insumosOrdenados.length / ITENS_POR_PAGINA_INSUMOS);
            const paginaAtual = Math.min(paginaInsumos, totalPaginas || 1);
            const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA_INSUMOS;
            const insumosPaginados = insumosOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA_INSUMOS);

            return insumosFiltrados.length > 0 ? (
              <Card className="bg-white border border-gray-200">
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <div>
                        <CardTitle className="text-sm sm:text-base text-gray-900">Lista Completa de Materiais Utilizados</CardTitle>
                        <CardDescription className="text-xs">Todos os registros detalhados por empreendimento</CardDescription>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {insumosFiltrados.length} {insumosFiltrados.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                        <tr>
                          <th className="text-left p-3 text-gray-700 font-semibold">#</th>
                          <th className="text-left p-3 text-gray-700 font-semibold">Material</th>
                          <th className="text-center p-3 text-gray-700 font-semibold">Unidade</th>
                          <th className="text-right p-3 text-gray-700 font-semibold">Quantidade</th>
                          <th className="text-left p-3 text-gray-700 font-semibold">Empreendimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insumosPaginados.map((insumo, index) => (
                            <tr 
                              key={insumo.id || (inicio + index)} 
                              className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors"
                            >
                              <td className="p-3 text-gray-500 font-medium">
                                {inicio + index + 1}
                              </td>
                              <td className="p-3 text-gray-900 font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  {insumo.material_utilizado || 'Material não informado'}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium border border-blue-200">
                                  {insumo.medida || 'Un'}
                                </span>
                              </td>
                              <td className="p-3 text-right text-gray-900 font-semibold">
                                {(() => {
                                  const qtd = parseFloat(insumo.quantidade?.toString() || '0');
                                  return qtd % 1 === 0 
                                    ? qtd.toFixed(0) 
                                    : qtd.toFixed(3).replace(/\.?0+$/, '');
                                })()}
                              </td>
                              <td className="p-3 text-gray-700">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="text-xs">
                                    {insumo.Empreendimento || 'Não informado'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {totalPaginas > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Exibindo {inicio + 1}–{Math.min(inicio + ITENS_POR_PAGINA_INSUMOS, insumosOrdenados.length)} de {insumosOrdenados.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPaginaInsumos(1)}
                          disabled={paginaAtual === 1}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Primeira
                        </button>
                        <button
                          onClick={() => setPaginaInsumos(p => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        
                        {(() => {
                          const paginas: number[] = [];
                          const maxBotoes = 5;
                          let inicioP = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2));
                          const fimP = Math.min(totalPaginas, inicioP + maxBotoes - 1);
                          if (fimP - inicioP + 1 < maxBotoes) {
                            inicioP = Math.max(1, fimP - maxBotoes + 1);
                          }
                          for (let i = inicioP; i <= fimP; i++) paginas.push(i);
                          return paginas.map(p => (
                            <button
                              key={p}
                              onClick={() => setPaginaInsumos(p)}
                              className={`px-2.5 py-1 text-xs rounded border ${
                                p === paginaAtual
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {p}
                            </button>
                          ));
                        })()}
                        
                        <button
                          onClick={() => setPaginaInsumos(p => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Próxima
                        </button>
                        <button
                          onClick={() => setPaginaInsumos(totalPaginas)}
                          disabled={paginaAtual === totalPaginas}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Última
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Gráfico de Insumos Mais Utilizados */}
          {insumosUtilizados.length > 0 && (() => {
            const insumosFiltrados = filtroAtivo ? filtrarInsumosPorData(insumosUtilizados) : insumosUtilizados;
            
            const agrupado = insumosFiltrados.reduce((acc, insumo) => {
              const material = insumo.material_utilizado || 'Material não informado';
              
              if (!acc[material]) {
                acc[material] = {
                  nome: material,
                  count: 0
                };
              }
              
              acc[material].count += 1;
              return acc;
            }, {} as Record<string, { nome: string; count: number }>);
            
            const dadosGrafico = Object.values(agrupado)
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);
            
            return dadosGrafico.length > 0 ? (
              <Card className="bg-white border border-gray-200">
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-sm sm:text-base text-gray-900">Top 10 Insumos Mais Utilizados</CardTitle>
                  <CardDescription className="text-xs">Materiais mais frequentes</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="nome" 
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                        allowDecimals={false}
                        label={{ value: 'Frequência', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12px',
                          padding: '8px 12px'
                        }}
                        cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                        formatter={(value: any) => {
                          return [`${value} ${value === 1 ? 'vez' : 'vezes'}`, 'Frequência'];
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        radius={[4, 4, 0, 0]}
                        name="Frequência"
                      >
                        {dadosGrafico.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : null;
          })()}
        </div>

        {/* Insights de IA */}
        <AIInsights />
      </div>
    </div>
  );
}