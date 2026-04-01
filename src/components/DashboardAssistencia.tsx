"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Building2, Package, Users, Star, AlertCircle, Calendar, Filter, X, ClipboardList, CheckCircle2, ShieldCheck } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { AIInsights } from '@/components/AIInsights';

const CORES_GRAFICO = [
  '#3B82F6', '#111111', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#F97316',
];

interface DadosAgrupados {
  nome: string;
  total: number;
}

interface DadosInsumo {
  nome: string;
  quantidade: number;
  medida: string;
}

interface InsumoUtilizado {
  id: number;
  material_utilizado?: string;
  medida?: string;
  quantidade?: number;
  Empreendimento?: string;
  id_finalizacao?: number;
  created_at?: string;
}

interface DashboardStats {
  counts: {
    total: number;
    procedentes: number;
    desqualificados: number;
    abertos: number;
    vistoriaAgendada: number;
    reparoAgendado: number;
    aguardandoAssinatura: number;
    finalizado: number;
    totalFinalizacoes: number;
  };
  charts: {
    porEmpreendimento: DadosAgrupados[];
    porCategoria: DadosAgrupados[];
    porEmpresa: DadosAgrupados[];
    porResponsavel: DadosAgrupados[];
    topInsumos: DadosInsumo[];
  };
  nps: {
    media: number | null;
    totalAvaliacoes: number;
  };
}

export function DashboardAssistencia() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insumosUtilizados, setInsumosUtilizados] = useState<InsumoUtilizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [paginaInsumos, setPaginaInsumos] = useState(1);
  const ITENS_POR_PAGINA_INSUMOS = 50;

  // Abort controller para cancelar requests em voo
  const abortRef = useRef<AbortController | null>(null);

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

    const formatarData = (d: Date) => {
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    };

    setDataInicio(formatarData(inicio));
    setDataFim(formatarData(fim));
    setFiltroAtivo(true);
    setPaginaInsumos(1);
  };

  // Fetch com timeout + retry
  const fetchWithRetry = async (url: string, options: RequestInit = {}, timeoutMs = 15000, maxRetries = 2): Promise<Response> => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Combinar signal externo com timeout
      const externalSignal = options.signal;
      if (externalSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort);

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', onExternalAbort);
        if ((res.status === 546 || res.status === 503) && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return res;
      } catch (err: any) {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', onExternalAbort);
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  };

  // Carregar dados do dashboard
  const carregarDados = useCallback(async (inicio?: string, fim?: string) => {
    // Cancelar request anterior
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setErro(null);

      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;

      // Montar URL com filtros de data
      const params = new URLSearchParams();
      if (inicio) params.set('dataInicio', inicio);
      if (fim) params.set('dataFim', fim);
      const qs = params.toString() ? `?${params}` : '';

      // 2 chamadas em paralelo: stats (agregações) + insumos (tabela detalhada)
      const [resultStats, resultInsumos] = await Promise.allSettled([
        fetchWithRetry(`${baseUrl}/dashboard-stats${qs}`, { headers, signal: controller.signal }),
        fetchWithRetry(`${baseUrl}/itens-utilizados-posobra`, { headers, signal: controller.signal }),
      ]);

      // Processar stats
      if (resultStats.status === 'fulfilled' && resultStats.value.ok) {
        const data = await resultStats.value.json();
        setStats(data);
      } else {
        const reason = resultStats.status === 'rejected' ? resultStats.reason : 'HTTP error';
        console.error('Erro ao carregar stats:', reason);
        throw new Error('Erro ao carregar dados do dashboard');
      }

      // Processar insumos (para tabela detalhada)
      if (resultInsumos.status === 'fulfilled' && resultInsumos.value.ok) {
        const data = await resultInsumos.value.json();
        setInsumosUtilizados(data.data || data || []);
      } else {
        setInsumosUtilizados([]);
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // Cancelado, ignorar
      console.error('Erro ao carregar dashboard:', error);
      setErro('Erro ao carregar dados da dashboard. Tente novamente.');
      setStats(null);
      setInsumosUtilizados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial (sem filtro)
  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Reagir a mudanças de filtro
  useEffect(() => {
    if (filtroAtivo && dataInicio && dataFim) {
      carregarDados(dataInicio, dataFim);
    } else if (!filtroAtivo) {
      carregarDados();
    }
  }, [filtroAtivo, dataInicio, dataFim, carregarDados]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Filtrar insumos por data (para tabela detalhada)
  const insumosFiltrados = useMemo(() => {
    if (!Array.isArray(insumosUtilizados)) return [];
    if (!filtroAtivo || !dataInicio || !dataFim) return insumosUtilizados;

    const [anoInicio, mesInicio, diaInicio] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);
    const dataInicioNum = anoInicio * 10000 + mesInicio * 100 + diaInicio;
    const dataFimNum = anoFim * 10000 + mesFim * 100 + diaFim;

    return insumosUtilizados.filter(insumo => {
      try {
        const dataUTC = new Date(insumo.created_at || '');
        const data = new Date(dataUTC.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const dataRegistro = data.getFullYear() * 10000 + (data.getMonth() + 1) * 100 + data.getDate();
        return dataRegistro >= dataInicioNum && dataRegistro <= dataFimNum;
      } catch { return true; }
    });
  }, [insumosUtilizados, filtroAtivo, dataInicio, dataFim]);

  // Atalhos para os dados
  const counts = stats?.counts;
  const charts = stats?.charts;
  const nps = stats?.nps;

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
                      onClick={() => carregarDados(filtroAtivo ? dataInicio : undefined, filtroAtivo ? dataFim : undefined)}
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 sm:p-3 rounded-xl">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl text-gray-900">Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-600">Analise das solicitacoes</p>
          </div>
        </div>

        {/* Filtro de Data */}
        <Card className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            {/* Atalhos Rápidos */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Atalhos Rapidos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: 'Hoje', value: 'hoje' },
                  { label: 'Ultimos 7 dias', value: '7dias' },
                  { label: 'Ultimos 30 dias', value: '30dias' },
                  { label: 'Este mes', value: 'este_mes' },
                  { label: 'Mes passado', value: 'mes_passado' },
                  { label: 'Este ano', value: 'este_ano' },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => aplicarFiltroRapido(value)}
                    className="px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-gradient-to-br from-white to-gray-50 text-gray-500 font-medium">ou selecione periodo personalizado</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex items-center gap-2 flex-1 w-full">
                <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Inicio</label>
                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => { if (dataInicio && dataFim) setFiltroAtivo(true); }}
                  disabled={!dataInicio || !dataFim}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-md"
                >
                  <Filter className="h-4 w-4" />
                  Aplicar Filtro
                </button>
                {filtroAtivo && (
                  <button
                    onClick={() => { setFiltroAtivo(false); setDataInicio(''); setDataFim(''); }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
                  >
                    <X className="h-4 w-4" />
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {filtroAtivo && (() => {
              const formatarDataLocal = (dataStr: string) => {
                const [ano, mes, dia] = dataStr.split('-').map(Number);
                return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR');
              };
              return (
                <div className="mt-4 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-r-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                        <Filter className="h-3 w-3 text-white" />
                      </div>
                      <p className="text-sm font-medium text-blue-900">
                        Filtro ativo: <span className="font-semibold">{formatarDataLocal(dataInicio)}</span> ate <span className="font-semibold">{formatarDataLocal(dataFim)}</span>
                      </p>
                    </div>
                    <button onClick={() => { setFiltroAtivo(false); setDataInicio(''); setDataFim(''); }} className="text-blue-700 hover:text-blue-900">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* SECAO: DADOS DE SOLICITACOES */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b-2 border-blue-200">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dados de Solicitacoes</h2>
              <p className="text-xs text-gray-600">Assistencias abertas e em andamento</p>
            </div>
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-blue-100">{filtroAtivo ? 'Total Solicitacoes no Periodo' : 'Total Solicitacoes'}</p>
                  <div className="bg-white/20 p-1.5 rounded-lg"><ClipboardList className="h-4 w-4 text-white" /></div>
                </div>
                <p className="text-2xl sm:text-3xl">{counts?.total || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 border-0 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-emerald-100">Procedentes</p>
                  <div className="bg-white/20 p-1.5 rounded-lg"><ShieldCheck className="h-4 w-4 text-white" /></div>
                </div>
                <p className="text-2xl sm:text-3xl">{counts?.procedentes || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">1. Abertos</p>
                  <div className="bg-sky-100 p-1.5 rounded-lg"><TrendingUp className="h-4 w-4 text-sky-600" /></div>
                </div>
                <p className="text-2xl sm:text-3xl text-sky-600">{counts?.abertos || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">2. Vistoria</p>
                  <div className="bg-orange-100 p-1.5 rounded-lg"><BarChart3 className="h-4 w-4 text-orange-600" /></div>
                </div>
                <p className="text-2xl sm:text-3xl text-orange-600">{counts?.vistoriaAgendada || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">3. Reparo</p>
                  <div className="bg-gray-100 p-1.5 rounded-lg"><PieChartIcon className="h-4 w-4 text-gray-900" /></div>
                </div>
                <p className="text-2xl sm:text-3xl text-gray-900">{counts?.reparoAgendado || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Desqualificado</p>
                  <div className="bg-red-100 p-1.5 rounded-lg"><AlertCircle className="h-4 w-4 text-red-600" /></div>
                </div>
                <p className="text-2xl sm:text-3xl text-red-600">{counts?.desqualificados || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos - Solicitações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Por Empresa */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Por Empresa</CardTitle>
                <CardDescription className="text-xs">Distribuicao por empresa</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {(charts?.porEmpresa?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={charts!.porEmpresa} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', padding: '6px 10px' }} />
                      <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-[200px] text-xs text-gray-500">Nenhum dado disponivel</div>}
              </CardContent>
            </Card>

            {/* Por Categoria */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Por Categoria</CardTitle>
                <CardDescription className="text-xs">Tipos de reparo</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {(charts?.porCategoria?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={charts!.porCategoria} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', padding: '6px 10px' }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Total">
                        {charts!.porCategoria.map((_, i) => <Cell key={`cell-${i}`} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-[200px] text-xs text-gray-500">Nenhum dado disponivel</div>}
              </CardContent>
            </Card>

            {/* Por Condomínio */}
            <Card className="bg-white border border-gray-200 lg:col-span-2">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Por Condominio</CardTitle>
                <CardDescription className="text-xs">Distribuicao por empreendimento</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {(charts?.porEmpreendimento?.length || 0) > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <div style={{ minWidth: `${Math.max(300, (charts?.porEmpreendimento?.length || 0) * 80)}px` }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={charts!.porEmpreendimento} margin={{ top: 10, right: 10, left: -10, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="nome" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#e2e8f0' }} angle={-45} textAnchor="end" height={80} interval={0} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', padding: '6px 10px' }} />
                          <Bar dataKey="total" fill="#111111" radius={[4, 4, 0, 0]} name="Total" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : <div className="flex items-center justify-center h-[220px] text-xs text-gray-500">Nenhum dado disponivel</div>}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* SECAO: DADOS DE FINALIZACOES */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b-2 border-green-200">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dados de Finalizacoes</h2>
              <p className="text-xs text-gray-600">Pos-obra, avaliacoes e insumos</p>
            </div>
          </div>

          {/* Cards - Finalizações */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-green-100">{filtroAtivo ? 'Total Finalizacoes no Periodo' : 'Total Finalizacoes'}</p>
                  <div className="bg-white/20 p-1.5 rounded-lg"><CheckCircle2 className="h-4 w-4 text-white" /></div>
                </div>
                <p className="text-2xl sm:text-3xl">{counts?.totalFinalizacoes || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Aguardando Assinatura</p>
                  <div className="bg-green-100 p-1.5 rounded-lg"><Building2 className="h-4 w-4 text-green-600" /></div>
                </div>
                <p className="text-2xl sm:text-3xl text-green-600">{counts?.aguardandoAssinatura || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600">Finalizado</p>
                  <div className="bg-blue-100 p-1.5 rounded-lg"><CheckCircle2 className="h-4 w-4 text-blue-600" /></div>
                </div>
                <p className="text-2xl sm:text-3xl text-blue-600">{counts?.finalizado || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos - Finalizações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Por Responsável */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-600" />
                  <div>
                    <CardTitle className="text-sm sm:text-base text-gray-900">Por Responsavel</CardTitle>
                    <CardDescription className="text-xs">Distribuicao por responsavel</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {(charts?.porResponsavel?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={charts!.porResponsavel} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', padding: '6px 10px' }} />
                      <Bar dataKey="total" fill="#14B8A6" radius={[4, 4, 0, 0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-[200px] text-xs text-gray-500">Nenhum dado disponivel</div>}
              </CardContent>
            </Card>

            {/* NPS */}
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <div>
                    <CardTitle className="text-sm sm:text-base text-gray-900">Avaliacao NPS</CardTitle>
                    <CardDescription className="text-xs">Media geral de satisfacao</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {nps?.media !== null && nps?.media !== undefined && (nps?.totalAvaliacoes || 0) > 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <div className="flex items-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-8 w-8 ${star <= Math.round(nps!.media!) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900 mb-1">{nps!.media!.toFixed(1)}</p>
                      <p className="text-sm text-gray-600">
                        Baseado em {nps!.totalAvaliacoes} {nps!.totalAvaliacoes === 1 ? 'avaliacao' : 'avaliacoes'}
                      </p>
                    </div>
                  </div>
                ) : <div className="flex items-center justify-center h-[200px] text-xs text-gray-500">Nenhuma avaliacao disponivel</div>}
              </CardContent>
            </Card>
          </div>

          {/* Insumos por Empreendimento */}
          {insumosFiltrados.length > 0 && (() => {
            const porEmpreendimento = insumosFiltrados.reduce((acc, insumo) => {
              const emp = insumo.Empreendimento || 'Nao informado';
              acc[emp] = (acc[emp] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const empreendimentos = Object.entries(porEmpreendimento).sort((a, b) => b[1] - a[1]);

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
          {insumosFiltrados.length > 0 && (() => {
            const insumosOrdenados = [...insumosFiltrados].sort((a, b) => {
              const mA = (a.material_utilizado || 'Zzz').toLowerCase();
              const mB = (b.material_utilizado || 'Zzz').toLowerCase();
              if (mA !== mB) return mA.localeCompare(mB);
              return (a.Empreendimento || 'Zzz').toLowerCase().localeCompare((b.Empreendimento || 'Zzz').toLowerCase());
            });
            const totalPaginas = Math.ceil(insumosOrdenados.length / ITENS_POR_PAGINA_INSUMOS);
            const paginaAtual = Math.min(paginaInsumos, totalPaginas || 1);
            const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA_INSUMOS;
            const insumosPaginados = insumosOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA_INSUMOS);

            return (
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
                          <tr key={insumo.id || (inicio + index)} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 text-gray-500 font-medium">{inicio + index + 1}</td>
                            <td className="p-3 text-gray-900 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                {insumo.material_utilizado || 'Material nao informado'}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium border border-blue-200">
                                {insumo.medida || 'Un'}
                              </span>
                            </td>
                            <td className="p-3 text-right text-gray-900 font-semibold">
                              {(() => { const q = parseFloat(insumo.quantidade?.toString() || '0'); return q % 1 === 0 ? q.toFixed(0) : q.toFixed(3).replace(/\.?0+$/, ''); })()}
                            </td>
                            <td className="p-3 text-gray-700">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-xs">{insumo.Empreendimento || 'Nao informado'}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPaginas > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">Exibindo {inicio + 1}-{Math.min(inicio + ITENS_POR_PAGINA_INSUMOS, insumosOrdenados.length)} de {insumosOrdenados.length}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPaginaInsumos(1)} disabled={paginaAtual === 1} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">Primeira</button>
                        <button onClick={() => setPaginaInsumos(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">Anterior</button>
                        {(() => {
                          const paginas: number[] = [];
                          const maxBotoes = 5;
                          let inicioP = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2));
                          const fimP = Math.min(totalPaginas, inicioP + maxBotoes - 1);
                          if (fimP - inicioP + 1 < maxBotoes) inicioP = Math.max(1, fimP - maxBotoes + 1);
                          for (let i = inicioP; i <= fimP; i++) paginas.push(i);
                          return paginas.map(p => (
                            <button key={p} onClick={() => setPaginaInsumos(p)} className={`px-2.5 py-1 text-xs rounded border ${p === paginaAtual ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{p}</button>
                          ));
                        })()}
                        <button onClick={() => setPaginaInsumos(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">Proxima</button>
                        <button onClick={() => setPaginaInsumos(totalPaginas)} disabled={paginaAtual === totalPaginas} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">Ultima</button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Top 10 Insumos (soma de quantidade, do servidor) */}
          {(charts?.topInsumos?.length || 0) > 0 && (
            <Card className="bg-white border border-gray-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base text-gray-900">Top 10 Insumos Mais Utilizados</CardTitle>
                <CardDescription className="text-xs">Materiais com maior quantidade total consumida</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={charts!.topInsumos} margin={{ top: 10, right: 10, left: -10, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#e2e8f0' }} angle={-45} textAnchor="end" height={100} interval={0} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} allowDecimals={false} label={{ value: 'Quantidade', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', padding: '8px 12px' }}
                      formatter={(value: any, _name: any, props: any) => {
                        const medida = props?.payload?.medida || 'Un';
                        return [`${value} ${medida}`, 'Quantidade'];
                      }}
                    />
                    <Bar dataKey="quantidade" radius={[4, 4, 0, 0]} name="Quantidade">
                      {charts!.topInsumos.map((_, i) => <Cell key={`cell-${i}`} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Insights de IA */}
        <AIInsights />
      </div>
    </div>
  );
}
