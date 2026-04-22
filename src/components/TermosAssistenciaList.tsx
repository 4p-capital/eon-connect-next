"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, FileText, Building2, ChevronLeft, ChevronRight, Loader2,
  Filter, X, Download, RefreshCw, CheckCircle2, XCircle, Clock,
  PenLine, TimerOff, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────────

interface TermoCliente {
  proprietario: string;
  cpf: string;
  telefone: string;
  email: string;
  bloco: string;
  unidade: string;
  empreendimento: string;
  categoria_reparo: string;
}

interface TermoFinalizacao {
  id: number;
  id_assistencia: number;
  status: string;
  responsaveis: string[];
  nps: number;
  assinatura_vencida: boolean;
  created_at: string;
}

interface Termo {
  id: number;
  id_solicitacao: number;
  id_finalizacao: number;
  pdf_storage_path: string | null;
  pdf_storage_path_assinado: string | null;
  pdf_storage_path_vencida: string | null;
  pdf_bucket: string;
  tipo_finalizacao: 'assinado' | 'vencida' | null;
  finalizado_em: string | null;
  enviado_sienge: boolean;
  data_envio_sienge: string | null;
  sienge_error: string | null;
  created_at: string;
  updated_at: string;
  finalizacao: TermoFinalizacao | null;
  cliente: TermoCliente | null;
}

interface ApiResponse {
  success: boolean;
  data: Termo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type FiltroTipo = '' | 'assinado' | 'vencida' | 'pendente';
type FiltroSienge = '' | 'ok' | 'erro';

const LIMIT_OPTIONS = [50, 100, 200] as const;

// ── Helpers de status ──────────────────────────────────────────────

/** Status do chamado: azul = aguardando, verde = finalizado */
function getStatusChamado(termo: Termo): 'aguardando' | 'finalizado' {
  const status = termo.finalizacao?.status;
  if (status === 'Finalizado') return 'finalizado';
  return 'aguardando';
}

/** Se o Sienge falhou de verdade (já finalizou mas não enviou) */
function isSiengeFalhou(termo: Termo): boolean {
  return !termo.enviado_sienge && termo.tipo_finalizacao !== null;
}

// ── Componente ─────────────────────────────────────────────────────

interface MetricasTotais {
  aguardando: number;
  assinados: number;
  vencidos: number;
  siengeErro: number;
}

export function TermosAssistenciaList() {
  const [termos, setTermos] = useState<Termo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState<number>(50);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('');
  const [filtroSienge, setFiltroSienge] = useState<FiltroSienge>('');
  const [showFilters, setShowFilters] = useState(false);
  const [reenviando, setReenviando] = useState<number | null>(null);
  const [metricas, setMetricas] = useState<MetricasTotais | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch termos
  const fetchTermos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroSienge) params.set('sienge', filtroSienge);

      const response = await fetch(
        `${apiBaseUrl}/termos-assistencia?${params}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result: ApiResponse = await response.json();

      if (!response.ok) throw new Error((result as any).error || 'Erro ao buscar termos');

      setTermos(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Erro ao buscar termos:', error);
      toast.error('Erro ao carregar termos');
      setTermos([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filtroTipo, filtroSienge, limit]);

  useEffect(() => { fetchTermos(); }, [fetchTermos]);

  // ── Métricas globais (independente da página) ──
  const fetchMetricas = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/termos-assistencia?page=1&limit=9999`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result: ApiResponse = await response.json();
      if (!response.ok) return;

      const todos = result.data || [];
      setMetricas({
        aguardando: todos.filter(t => !t.tipo_finalizacao).length,
        assinados: todos.filter(t => t.tipo_finalizacao === 'assinado').length,
        vencidos: todos.filter(t => t.tipo_finalizacao === 'vencida').length,
        siengeErro: todos.filter(t => isSiengeFalhou(t)).length,
      });
    } catch (err) {
      console.error('Erro ao buscar métricas:', err);
    }
  }, []);

  useEffect(() => { fetchMetricas(); }, [fetchMetricas]);

  const totalAguardando = metricas?.aguardando ?? 0;
  const totalAssinados = metricas?.assinados ?? 0;
  const totalVencidos = metricas?.vencidos ?? 0;
  const totalSiengeErro = metricas?.siengeErro ?? 0;

  // Reenviar ao Sienge
  const reenviarSienge = async (termo: Termo) => {
    setReenviando(termo.id);
    try {
      const response = await fetch(
        `${apiBaseUrl}/assistencia-finalizada/${termo.id_finalizacao}/enviar-sienge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      const result = await response.json();

      if (result.success) {
        toast.success('Termo enviado ao Sienge com sucesso!');
        fetchTermos();
        fetchMetricas();
      } else {
        toast.error(result.error || 'Erro ao enviar ao Sienge');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o Sienge');
    } finally {
      setReenviando(null);
    }
  };

  // Download PDF
  const downloadPdf = async (termo: Termo) => {
    if (!termo.pdf_storage_path) {
      toast.error('PDF nao disponivel');
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/assistencia-finalizada/${termo.id_finalizacao}/termo-pdf`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result = await response.json();

      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      } else {
        toast.error('URL do PDF nao disponivel');
      }
    } catch {
      toast.error('Erro ao obter PDF');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFiltroTipo('');
    setFiltroSienge('');
    setPage(1);
  };

  const hasActiveFilters = debouncedSearch || filtroTipo || filtroSienge;

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Badges ───────────────────────────────────────────────────────

  /** Badge de status do chamado: Azul (aguardando) ou Verde (finalizado) */
  const getStatusBadge = (termo: Termo) => {
    const status = getStatusChamado(termo);
    if (status === 'finalizado') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Finalizado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Clock className="w-3 h-3" />
        Aguardando assinatura
      </span>
    );
  };

  /** Badge do tipo de finalização: como foi encerrado */
  const getTipoBadge = (tipo: string | null) => {
    switch (tipo) {
      case 'assinado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <PenLine className="w-3 h-3" />
            Assinado
          </span>
        );
      case 'vencida':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <TimerOff className="w-3 h-3" />
            Aceite Tacito
          </span>
        );
      default:
        return null; // Não mostra badge de tipo quando ainda está aguardando
    }
  };

  /** Badge do Sienge: só mostra quando já finalizou */
  const getSiengeBadge = (termo: Termo) => {
    // Se ainda está aguardando assinatura, não mostra badge de Sienge (irrelevante)
    if (!termo.tipo_finalizacao) return null;

    if (termo.enviado_sienge) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Sienge
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" />
        Sienge
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">Termos de Assistencia</h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {loading ? 'Carregando...' : `${total} termo${total !== 1 ? 's' : ''} gerado${total !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-black text-white'
                  : 'bg-[var(--background-secondary)] text-[var(--foreground)] hover:bg-[var(--border)]'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--error)] rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      {metricas && (totalAguardando + totalAssinados + totalVencidos + totalSiengeErro) > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Aguardando assinatura = azul */}
            <button
              onClick={() => { setFiltroTipo('pendente'); setFiltroSienge(''); setShowFilters(false); }}
              className={`p-3 rounded-xl border transition-all text-left ${
                filtroTipo === 'pendente' ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-[var(--border)] hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Aguardando</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{totalAguardando}</p>
            </button>
            {/* Assinados pelo cliente = verde */}
            <button
              onClick={() => { setFiltroTipo('assinado'); setFiltroSienge(''); setShowFilters(false); }}
              className={`p-3 rounded-xl border transition-all text-left ${
                filtroTipo === 'assinado' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' : 'bg-white border-[var(--border)] hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <PenLine className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Assinados</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{totalAssinados}</p>
            </button>
            {/* Vencidos = amber */}
            <button
              onClick={() => { setFiltroTipo('vencida'); setFiltroSienge(''); setShowFilters(false); }}
              className={`p-3 rounded-xl border transition-all text-left ${
                filtroTipo === 'vencida' ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-[var(--border)] hover:border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <TimerOff className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Aceite Tacito</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{totalVencidos}</p>
            </button>
            {/* Sienge falhou = vermelho (só os que já finalizaram) */}
            <button
              onClick={() => { setFiltroSienge('erro'); setFiltroTipo(''); setShowFilters(false); }}
              className={`p-3 rounded-xl border transition-all text-left ${
                filtroSienge === 'erro' ? 'bg-red-50 border-red-300 ring-1 ring-red-200' : 'bg-white border-[var(--border)] hover:border-red-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-red-600">Sienge Falhou</span>
              </div>
              <p className="text-xl font-bold text-red-600">{totalSiengeErro}</p>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, empreendimento ou n. da solicitacao..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 pt-3">
                <select
                  value={filtroTipo}
                  onChange={(e) => { setFiltroTipo(e.target.value as FiltroTipo); setPage(1); }}
                  className="px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="">Todos os tipos</option>
                  <option value="assinado">Assinados pelo cliente</option>
                  <option value="vencida">Aceite tacito (vencidos)</option>
                  <option value="pendente">Aguardando assinatura</option>
                </select>
                <select
                  value={filtroSienge}
                  onChange={(e) => { setFiltroSienge(e.target.value as FiltroSienge); setPage(1); }}
                  className="px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="">Sienge: Todos</option>
                  <option value="ok">Enviado ao Sienge</option>
                  <option value="erro">Falhou no Sienge</option>
                </select>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--error)] hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar filtros
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Carregando termos...</p>
          </div>
        ) : termos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-12 h-12 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {hasActiveFilters ? 'Nenhum termo encontrado com os filtros aplicados' : 'Nenhum termo gerado ainda'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-black underline hover:no-underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">#</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Cliente</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Empreend.</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Encerramento</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Sienge</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Data</th>
                    <th className="text-right text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {termos.map((termo, idx) => (
                    <tr
                      key={termo.id}
                      className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-[var(--background-alt)]/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">
                          {termo.id_solicitacao}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {termo.cliente?.proprietario || '—'}
                          </p>
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            {termo.cliente?.categoria_reparo || ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
                          <div>
                            <p className="text-xs text-[var(--foreground)]">{termo.cliente?.empreendimento || '—'}</p>
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              Bl. {termo.cliente?.bloco} - Ap. {termo.cliente?.unidade}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Status do chamado: Azul ou Verde */}
                      <td className="px-4 py-3">{getStatusBadge(termo)}</td>
                      {/* Tipo de encerramento: Assinado, Aceite Tácito ou vazio */}
                      <td className="px-4 py-3">{getTipoBadge(termo.tipo_finalizacao) || <span className="text-[11px] text-[var(--muted-foreground)]">—</span>}</td>
                      {/* Sienge: só mostra quando relevante */}
                      <td className="px-4 py-3">{getSiengeBadge(termo) || <span className="text-[11px] text-[var(--muted-foreground)]">—</span>}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs text-[var(--foreground)]">{formatDate(termo.finalizado_em || termo.created_at)}</p>
                          {termo.data_envio_sienge && (
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              Sienge: {formatDate(termo.data_envio_sienge)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {termo.pdf_storage_path && (
                            <button
                              onClick={() => downloadPdf(termo)}
                              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors"
                              title="Baixar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {termos.map((termo) => (
                <div
                  key={termo.id}
                  className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {termo.cliente?.proprietario || '—'}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        #{termo.id_solicitacao} - {termo.cliente?.categoria_reparo || ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {formatDate(termo.finalizado_em || termo.created_at)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                    <Building2 className="w-3.5 h-3.5" />
                    {termo.cliente?.empreendimento} - Bl. {termo.cliente?.bloco} Ap. {termo.cliente?.unidade}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(termo)}
                    {getTipoBadge(termo.tipo_finalizacao)}
                    {getSiengeBadge(termo)}
                  </div>

                  {/* Sienge error detail */}
                  {termo.sienge_error && isSiengeFalhou(termo) && (
                    <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-100">
                      {termo.sienge_error.length > 120 ? termo.sienge_error.slice(0, 120) + '...' : termo.sienge_error}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
                    {termo.pdf_storage_path && (
                      <button
                        onClick={() => downloadPdf(termo)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--foreground)] bg-[var(--background-secondary)] hover:bg-[var(--border)] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <span>Exibir</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 bg-white border border-[var(--border)] rounded-lg text-sm focus:outline-none"
                >
                  {LIMIT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span>por pagina</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg bg-white border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg bg-white border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
