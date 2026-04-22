"use client";

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  User, 
  Building2, 
  Phone, 
  Calendar,
  Wrench,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Package,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Hash,
  Star,
} from 'lucide-react';
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";

interface AssistenciaHistorico {
  id: number | string;
  id_assistencia?: number | string;
  status: string;
  tipo?: string;
  created_at?: string;
  responsaveis?: string[] | string;
  providencias?: string;
  foto_reparo?: string;
  itens_reparo?: any[];
  nps?: number;
  assistencia?: {
    id: number | string;
    proprietario: string;
    telefone: string;
    email: string;
    bloco: string;
    unidade: string;
    categoria_reparo: string;
    subcategoria?: string;
    descricao_problema?: string;
    created_at: string;
    empreendimento: string;
    idempresa: number;
    status_chamado?: string;
  };
  [key: string]: any;
}

interface HistoricoAssistenciasProps {
  onRecarregarKanban?: () => void;
}

export function HistoricoAssistencias({ onRecarregarKanban }: HistoricoAssistenciasProps) {
  const [historico, setHistorico] = useState<AssistenciaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tipoHistorico, setTipoHistorico] = useState<'Finalizado' | 'Desqualificado'>('Finalizado');
  const [busca, setBusca] = useState('');
  const [reativandoId, setReativandoId] = useState<number | string | null>(null);
  const [baixandoPdfId, setBaixandoPdfId] = useState<number | string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | string | null>(null);

  const fetchWithRetry = async (url: string, options: RequestInit = {}, timeoutMs = 15000, maxRetries = 2): Promise<Response> => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        if ((res.status === 546 || res.status === 503) && attempt < maxRetries) {
          console.warn(`⚠️ Servidor retornou ${res.status}, retry ${attempt + 1}/${maxRetries}...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
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
    carregarHistorico();
  }, [tipoHistorico]);

  const carregarHistorico = async () => {
    try {
      setLoading(true);
      setErro(null);
      
      const endpoint = tipoHistorico === 'Finalizado' 
        ? '/assistencias-finalizadas'
        : '/assistencias-desqualificadas';
      
      const url = `${apiBaseUrl}${endpoint}`;
      
      console.log(`📋 Carregando histórico de assistências ${tipoHistorico.toLowerCase()}...`);
      
      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      }, 15000, 2);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('❌ Erro na resposta:', response.status, errorData);
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      
      console.log('✅ Histórico carregado:', data.meta || `${data.historico?.length || 0} registros`);
      
      setHistorico(data.historico || []);
      setErro(null);
      
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
      
      let mensagemErro = 'Erro ao carregar histórico. ';
      
      if (error instanceof Error || error instanceof DOMException) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
          mensagemErro += 'Tempo de resposta excedido. Tente novamente.';
        } else if (error.message?.includes('Failed to fetch')) {
          mensagemErro += 'Verifique sua conexão com a internet.';
        } else if (error.message?.includes('546') || error.message?.includes('WORKER_LIMIT')) {
          mensagemErro += 'Servidor temporariamente sobrecarregado. Aguarde e tente novamente.';
        } else {
          mensagemErro += error.message;
        }
      } else {
        mensagemErro += 'Erro desconhecido.';
      }
      
      setErro(mensagemErro);
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  };

  const reativarAssistencia = async (id: number | string) => {
    try {
      setReativandoId(id);
      console.log(`✅ Reativando assistência ${id}...`);
      
      const response = await fetchWithRetry(
        `${apiBaseUrl}/assistencia/${id}/reativar`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        },
        15000,
        1
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Erro ao reativar assistência');
      }

      const result = await response.json();
      console.log('✅ Assistência reativada:', result);
      await carregarHistorico();
      alert('Assistência reativada com sucesso! O chamado voltará para o Kanban.');
      if (onRecarregarKanban) {
        await onRecarregarKanban();
      }
    } catch (error) {
      console.error('Erro ao reativar assistência:', error);
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      alert(isTimeout 
        ? 'Tempo de resposta excedido ao reativar assistência. Verifique se foi reativada e tente novamente.' 
        : 'Erro ao reativar assistência. Tente novamente.');
    } finally {
      setReativandoId(null);
    }
  };

  const formatarData = (data: string) => {
    try {
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  const formatarDataCurta = (data: string) => {
    try {
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const baixarTermoPDF = async (item: AssistenciaHistorico) => {
    try {
      const idStr = String(item.id);
      const idNumerico = idStr.replace('finalizado-', '');
      setBaixandoPdfId(item.id);
      console.log(`📄 Buscando PDF do termo para finalização #${idNumerico}...`);
      const url = `${apiBaseUrl}/assistencia-finalizada/${idNumerico}/termo-pdf`;
      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      }, 15000, 1);
      const data = await response.json();
      if (!response.ok || !data.pdf_url) {
        throw new Error(data.error || 'PDF não encontrado');
      }
      window.open(data.pdf_url, '_blank');
    } catch (error) {
      console.error('❌ Erro ao baixar PDF:', error);
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      alert(isTimeout
        ? 'Tempo de resposta excedido ao buscar PDF. Tente novamente.'
        : 'Erro ao baixar PDF: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setBaixandoPdfId(null);
    }
  };

  const historicoFiltrado = historico.filter(item => {
    if (busca) {
      const buscaLower = busca.toLowerCase();
      return (
        item.id_assistencia?.toString().includes(buscaLower) ||
        item.assistencia?.proprietario?.toLowerCase().includes(buscaLower) ||
        item.assistencia?.bloco?.toLowerCase().includes(buscaLower) ||
        item.assistencia?.unidade?.toLowerCase().includes(buscaLower) ||
        item.assistencia?.categoria_reparo?.toLowerCase().includes(buscaLower) ||
        item.assistencia?.empreendimento?.toLowerCase().includes(buscaLower)
      );
    }
    return true;
  });

  const toggleExpandido = (id: number | string) => {
    setExpandidoId(prev => prev === id ? null : id);
  };

  // ─── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-[var(--primary)] mx-auto" />
          <p className="text-sm text-[var(--text-tertiary)]">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────
  if (erro) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 px-4">
        <div className="card-minimal p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--error-light)] flex items-center justify-center mx-auto">
            <AlertCircle className="h-5 w-5 text-[var(--error)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">Erro ao carregar</h3>
            <p className="text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">{erro}</p>
          </div>
          <button onClick={carregarHistorico} className="btn-primary text-sm">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <div className="max-w-5xl mx-auto">
        
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Histórico</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Assistências finalizadas e desqualificadas
          </p>
        </div>

        {/* ─── Tabs + Search ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Tabs */}
          <div className="inline-flex rounded-[var(--radius-md)] bg-[var(--background-secondary)] p-1 gap-0.5">
            <button
              onClick={() => setTipoHistorico('Finalizado')}
              className={`px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all flex items-center gap-1.5 ${
                tipoHistorico === 'Finalizado'
                  ? 'bg-white text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finalizados
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                tipoHistorico === 'Finalizado' 
                  ? 'bg-[var(--background-secondary)] text-[var(--text-secondary)]' 
                  : 'bg-transparent text-[var(--text-muted)]'
              }`}>
                {tipoHistorico === 'Finalizado' ? historico.length : ''}
              </span>
            </button>
            <button
              onClick={() => setTipoHistorico('Desqualificado')}
              className={`px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all flex items-center gap-1.5 ${
                tipoHistorico === 'Desqualificado'
                  ? 'bg-white text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              Desqualificados
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                tipoHistorico === 'Desqualificado' 
                  ? 'bg-[var(--background-secondary)] text-[var(--text-secondary)]' 
                  : 'bg-transparent text-[var(--text-muted)]'
              }`}>
                {tipoHistorico === 'Desqualificado' ? historico.length : ''}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por nome, bloco, unidade, empreendimento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input-minimal w-full pl-9 py-2.5 text-sm"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={carregarHistorico}
            className="btn-secondary py-2.5 px-3 flex items-center gap-1.5 text-sm shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {/* ─── Summary bar ────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-4 px-1">
          <p className="text-xs text-[var(--text-muted)]">
            {historicoFiltrado.length} {historicoFiltrado.length === 1 ? 'registro' : 'registros'}
            {busca && ` para "${busca}"`}
          </p>
        </div>

        {/* ─── Empty State ────────────────────────────────────────── */}
        {historicoFiltrado.length === 0 ? (
          <div className="card-minimal p-12 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--background-secondary)] flex items-center justify-center mx-auto mb-3">
              <Filter className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              {busca
                ? 'Nenhum resultado encontrado para a busca'
                : `Nenhuma assistência ${tipoHistorico === 'Finalizado' ? 'finalizada' : 'desqualificada'} encontrada`}
            </p>
          </div>
        ) : (
          /* ─── Lista ───────────────────────────────────────────── */
          <div className="space-y-2">
            {historicoFiltrado.map((item, index) => {
              const isExpanded = expandidoId === item.id;
              const isFinalizado = item.status === 'Finalizado';
              const itensComMaterial = item.itens_reparo?.filter((i: any) => i.material && i.material !== 'Nenhum material') || [];

              return (
                <div 
                  key={`${item.id}-${index}`} 
                  className="card-minimal border border-[var(--border)] overflow-hidden"
                >
                  {/* ── Row principal (sempre visível) ─────────────── */}
                  <button
                    onClick={() => toggleExpandido(item.id)}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-[var(--background-alt)] transition-colors"
                  >
                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      isFinalizado ? 'bg-[var(--success)]' : 'bg-[var(--error)]'
                    }`} />

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          #{item.id_assistencia}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)] truncate">
                          {item.assistencia?.proprietario || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-[var(--text-muted)]">
                          {item.assistencia?.categoria_reparo || 'Sem categoria'}
                        </span>
                        {item.assistencia?.empreendimento && (
                          <>
                            <span className="text-xs text-[var(--text-muted)]">·</span>
                            <span className="text-xs text-[var(--text-muted)] truncate">
                              {item.assistencia.empreendimento}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Meta right */}
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      {item.assistencia?.bloco && (
                        <span className="text-xs text-[var(--text-muted)]">
                          Bl. {item.assistencia.bloco} · Apt. {item.assistencia.unidade}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isFinalizado 
                          ? 'badge-success' 
                          : 'badge-error'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <span className="text-xs text-[var(--text-muted)] shrink-0 hidden sm:block w-20 text-right">
                      {formatarDataCurta(item.created_at || item.assistencia?.created_at || '')}
                    </span>

                    {/* Chevron */}
                    <div className="shrink-0 text-[var(--text-muted)]">
                      {isExpanded 
                        ? <ChevronUp className="h-4 w-4" /> 
                        : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Mobile meta (visible only on mobile, below the row) */}
                  <div className="sm:hidden px-4 pb-2 flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      isFinalizado ? 'badge-success' : 'badge-error'
                    }`}>
                      {item.status}
                    </span>
                    {item.assistencia?.bloco && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Bl. {item.assistencia.bloco} · Apt. {item.assistencia.unidade}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                      {formatarDataCurta(item.created_at || item.assistencia?.created_at || '')}
                    </span>
                  </div>

                  {/* ── Conteúdo expandido ─────────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)] px-4 py-4 space-y-4 bg-[var(--background-alt)] animate-fade-in">
                      
                      {/* Grid de informações */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InfoRow icon={User} label="Proprietário" value={item.assistencia?.proprietario} />
                        <InfoRow icon={Phone} label="Telefone" value={item.assistencia?.telefone} />
                        <InfoRow icon={MapPin} label="Unidade" value={
                          item.assistencia?.bloco 
                            ? `Bloco ${item.assistencia.bloco} — Apto ${item.assistencia.unidade}`
                            : null
                        } />
                        <InfoRow icon={Building2} label="Empreendimento" value={item.assistencia?.empreendimento} />
                        <InfoRow icon={Wrench} label="Categoria" value={item.assistencia?.categoria_reparo} />
                        <InfoRow icon={Calendar} label="Abertura" value={
                          item.assistencia?.created_at ? formatarData(item.assistencia.created_at) : null
                        } />
                        {item.created_at && (
                          <InfoRow icon={Clock} label={isFinalizado ? 'Finalizado em' : 'Desqualificado em'} value={formatarData(item.created_at)} />
                        )}
                        {item.nps !== undefined && item.nps !== null && (
                          <InfoRow icon={Star} label="NPS" value={`${item.nps} estrela${item.nps !== 1 ? 's' : ''}`} />
                        )}
                      </div>

                      {/* Descrição do problema */}
                      {item.assistencia?.descricao_problema && (
                        <DetailSection title="Descrição do problema">
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {item.assistencia.descricao_problema}
                          </p>
                        </DetailSection>
                      )}

                      {/* ── Seções específicas de Finalizado ────────── */}
                      {isFinalizado && (
                        <>
                          {/* Responsáveis */}
                          {item.responsaveis && (Array.isArray(item.responsaveis) ? item.responsaveis.length > 0 : item.responsaveis) && (
                            <DetailSection title="Responsáveis">
                              <div className="flex flex-wrap gap-1.5">
                                {(Array.isArray(item.responsaveis) ? item.responsaveis : [item.responsaveis]).map((resp, idx) => (
                                  <span key={idx} className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--background-secondary)] text-[var(--text-secondary)]">
                                    {resp}
                                  </span>
                                ))}
                              </div>
                            </DetailSection>
                          )}

                          {/* Providências */}
                          {item.providencias && (
                            <DetailSection title="Providências tomadas">
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                {item.providencias}
                              </p>
                            </DetailSection>
                          )}

                          {/* Materiais */}
                          {itensComMaterial.length > 0 ? (
                            <DetailSection title={`Materiais utilizados (${itensComMaterial.length})`}>
                              <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-[var(--background-secondary)]">
                                      <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Material</th>
                                      <th className="text-center py-2 px-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Unid.</th>
                                      <th className="text-right py-2 px-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Qtd.</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--border-subtle)]">
                                    {itensComMaterial.map((itemReparo: any, idx: number) => (
                                      <tr key={idx} className="bg-white hover:bg-[var(--background-alt)] transition-colors">
                                        <td className="py-2 px-3 text-[var(--text-primary)]">
                                          {itemReparo.material}
                                        </td>
                                        <td className="py-2 px-3 text-center text-[var(--text-tertiary)]">
                                          {itemReparo.medida}
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)] tabular-nums">
                                          {parseFloat(itemReparo.quantidade) % 1 === 0 
                                            ? parseFloat(itemReparo.quantidade).toFixed(0)
                                            : parseFloat(itemReparo.quantidade).toFixed(3).replace(/\.?0+$/, '')}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </DetailSection>
                          ) : (
                            <DetailSection title="Materiais">
                              <p className="text-xs text-[var(--text-muted)]">
                                Nenhum material registrado para esta assistência.
                              </p>
                            </DetailSection>
                          )}

                          {/* Nenhum material usado */}
                          {item.itens_reparo?.some((i: any) => i.material === 'Nenhum material') && itensComMaterial.length === 0 && (
                            <DetailSection title="Materiais">
                              <p className="text-xs text-[var(--text-muted)]">
                                Reparo realizado sem necessidade de materiais.
                              </p>
                            </DetailSection>
                          )}

                          {/* Termo PDF */}
                          {item.termo_pdf_path && (
                            <div className="flex items-center justify-between bg-white rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <FileText className="h-4 w-4 text-[var(--text-tertiary)]" />
                                <div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">Termo de Assistência</p>
                                  <p className="text-[11px] text-[var(--text-muted)]">
                                    {item.assinatura_vencida ? 'Finalizado sem assinatura' : 'Documento disponível'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); baixarTermoPDF(item); }}
                                disabled={baixandoPdfId === item.id}
                                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                              >
                                {baixandoPdfId === item.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-[var(--border)] border-t-[var(--primary)]" />
                                    Abrindo...
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink className="h-3 w-3" />
                                    Ver PDF
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {/* ── Seções específicas de Desqualificado ────── */}
                      {!isFinalizado && (
                        <>
                          {/* Motivo */}
                          {item.motivo_desqualificado && (
                            <DetailSection title="Motivo da desqualificação">
                              <div className="bg-[var(--error-light)] rounded-[var(--radius-md)] px-3 py-2.5">
                                <p className="text-sm text-[var(--error-dark)] font-medium">
                                  {item.motivo_desqualificado}
                                </p>
                              </div>
                            </DetailSection>
                          )}

                          {/* Justificativa (exibida para Improcedentes) */}
                          {item.justificativa && (
                            <DetailSection title="Justificativa">
                              <div className="bg-[var(--background-secondary)] rounded-[var(--radius-md)] px-3 py-2.5">
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                  {item.justificativa}
                                </p>
                              </div>
                            </DetailSection>
                          )}

                          {/* Reativar */}
                          <div className="flex items-center justify-between bg-white rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-3">
                            <div>
                              <p className="text-sm text-[var(--text-secondary)]">
                                Etapa anterior: <span className="font-medium text-[var(--text-primary)]">{item.assistencia?.status_chamado || '—'}</span>
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                Ao reativar, o chamado voltará para esta etapa
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); reativarAssistencia(item.id_assistencia!); }}
                              disabled={reativandoId === item.id_assistencia}
                              className="btn-primary py-2 px-4 text-sm flex items-center gap-2 shrink-0"
                            >
                              {reativandoId === item.id_assistencia ? (
                                <>
                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                                  Reativando...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Reativar
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-muted)] leading-none mb-0.5">{label}</p>
        <p className="text-sm text-[var(--text-primary)] truncate">{value}</p>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}