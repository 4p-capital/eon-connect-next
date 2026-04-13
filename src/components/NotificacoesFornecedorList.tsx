"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Bell,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Download,
  TrendingUp,
  Clock,
  MousePointerClick,
  AlertCircle,
  AlertTriangle,
  PhoneOff,
  FileX,
  CheckCircle2,
  CircleSlash,
  Hourglass,
} from "lucide-react";
import { motion } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { WhatsAppStatusIcon, type WhatsAppStatus } from "./WhatsAppStatusIcon";
import { PedidoDetailsDrawer } from "./PedidoDetailsDrawer";

type NotificacaoStatus =
  | "pendente"
  | "na_fila"
  | "enviado"
  | "parcial"
  | "sem_contato"
  | "sem_pdf"
  | "erro"
  | "desabilitado";

interface EventoPedido {
  id: string;
  created_at: string;
  id_pedido: string | null;
  storage_pdf_pedido: string | null;
  id_fornecedor: string | null;
  nome_fornecedor: string | null;
  contato_fornecedor: string | null;
  centro_custo: string | null;
  fornecedor_notificado: boolean | null;
  grupo_notificado: boolean | null;
  nome_contato: string | null;
  notificacao_status: NotificacaoStatus | null;
  notificacao_motivo: string | null;
}

interface StatusByEvento {
  fornecedor?: { status: WhatsAppStatus; button_clicked: boolean };
  grupo?: { status: WhatsAppStatus; button_clicked: boolean };
}

interface Metrics {
  totalEnviadas: number;
  totalEntregues: number;
  totalLidas: number;
  totalCliques: number;
  totalFalhou: number;
  taxaEntrega: number;
  taxaLeitura: number;
  taxaCliques: number;
  tempoMedioLeitura: number; // em minutos
}

const LIMIT_OPTIONS = [50, 100, 200] as const;

export function NotificacoesFornecedorList() {
  usePermissionGuard("menu_notificacoes");
  const [eventos, setEventos] = useState<EventoPedido[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, StatusByEvento>>({});
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState<number>(50);
  const [selectedEvento, setSelectedEvento] = useState<EventoPedido | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "problemas" | NotificacaoStatus>("todos");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseComprasClient();
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = (supabase
        .from("eventos_pedidos_aprovados") as any)
        .select("*", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(
          `id_pedido.ilike.%${debouncedSearch}%,nome_fornecedor.ilike.%${debouncedSearch}%,contato_fornecedor.ilike.%${debouncedSearch}%,centro_custo.ilike.%${debouncedSearch}%,nome_contato.ilike.%${debouncedSearch}%`
        );
      }

      // Filtro por status
      if (filtroStatus === "problemas") {
        query = query.in("notificacao_status", ["sem_contato", "sem_pdf", "erro", "parcial"]);
      } else if (filtroStatus !== "todos") {
        query = query.eq("notificacao_status", filtroStatus);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const eventosData = data || [];
      setEventos(eventosData);
      setTotal(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / limit)));

      // Buscar status das mensagens dos eventos visíveis
      if (eventosData.length > 0) {
        const ids = eventosData.map((e: EventoPedido) => e.id);
        const { data: statusData } = await (supabase
          .from("whatsapp_message_status") as any)
          .select("evento_pedido_id, tipo_destinatario, status, button_clicked")
          .in("evento_pedido_id", ids);

        const map: Record<string, StatusByEvento> = {};
        (statusData || []).forEach((s: any) => {
          if (!map[s.evento_pedido_id]) map[s.evento_pedido_id] = {};
          map[s.evento_pedido_id][s.tipo_destinatario as "fornecedor" | "grupo"] = {
            status: s.status,
            button_clicked: s.button_clicked,
          };
        });
        setStatusMap(map);
      }
    } catch (error) {
      console.error("Erro ao buscar eventos:", error);
      setEventos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, limit, filtroStatus]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  // Buscar métricas globais
  const fetchMetrics = useCallback(async () => {
    try {
      const supabase = getSupabaseComprasClient();
      const { data } = await (supabase
        .from("whatsapp_message_status") as any)
        .select("status, button_clicked, created_at, status_timestamp");

      if (!data) return;

      const totalEnviadas = data.length;
      const totalEntregues = data.filter((s: any) =>
        ["RECEIVED", "READ", "PLAYED"].includes(s.status)
      ).length;
      const totalLidas = data.filter((s: any) =>
        ["READ", "PLAYED"].includes(s.status)
      ).length;
      const totalCliques = data.filter((s: any) => s.button_clicked).length;
      const totalFalhou = data.filter((s: any) => s.status === "FAILED").length;

      // Tempo médio até leitura (em minutos)
      const lidas = data.filter(
        (s: any) => ["READ", "PLAYED"].includes(s.status) && s.created_at && s.status_timestamp
      );
      const tempos = lidas.map((s: any) => {
        const sent = new Date(s.created_at).getTime();
        const read = new Date(s.status_timestamp).getTime();
        return (read - sent) / 1000 / 60;
      });
      const tempoMedio =
        tempos.length > 0 ? tempos.reduce((a: number, b: number) => a + b, 0) / tempos.length : 0;

      setMetrics({
        totalEnviadas,
        totalEntregues,
        totalLidas,
        totalCliques,
        totalFalhou,
        taxaEntrega: totalEnviadas > 0 ? (totalEntregues / totalEnviadas) * 100 : 0,
        taxaLeitura: totalEnviadas > 0 ? (totalLidas / totalEnviadas) * 100 : 0,
        taxaCliques: totalEnviadas > 0 ? (totalCliques / totalEnviadas) * 100 : 0,
        tempoMedioLeitura: tempoMedio,
      });
    } catch (err) {
      console.error("Erro ao buscar métricas:", err);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const formatTempo = (minutos: number) => {
    if (minutos < 1) return "< 1 min";
    if (minutos < 60) return `${Math.round(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    const min = Math.round(minutos % 60);
    return `${horas}h ${min}min`;
  };

  const getStatus = (eventoId: string, tipo: "fornecedor" | "grupo"): WhatsAppStatus => {
    const s = statusMap[eventoId]?.[tipo];
    if (!s) return "PENDING";
    return s.status;
  };

  const getButtonClicked = (eventoId: string, tipo: "fornecedor" | "grupo"): boolean => {
    return statusMap[eventoId]?.[tipo]?.button_clicked || false;
  };

  const renderStatusBadge = (status: NotificacaoStatus | null, motivo: string | null) => {
    const s = status || "pendente";
    const config: Record<NotificacaoStatus, { label: string; icon: any; className: string }> = {
      pendente: {
        label: "Pendente",
        icon: Clock,
        className: "bg-gray-50 text-gray-600 border-gray-200",
      },
      na_fila: {
        label: "Na fila",
        icon: Hourglass,
        className: "bg-blue-50 text-blue-700 border-blue-200",
      },
      enviado: {
        label: "Enviado",
        icon: CheckCircle2,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      parcial: {
        label: "Parcial",
        icon: AlertTriangle,
        className: "bg-amber-50 text-amber-700 border-amber-200",
      },
      sem_contato: {
        label: "Sem contato",
        icon: PhoneOff,
        className: "bg-red-50 text-red-700 border-red-200",
      },
      sem_pdf: {
        label: "Sem PDF",
        icon: FileX,
        className: "bg-red-50 text-red-700 border-red-200",
      },
      erro: {
        label: "Erro",
        icon: AlertCircle,
        className: "bg-red-50 text-red-700 border-red-200",
      },
      desabilitado: {
        label: "Desabilitado",
        icon: CircleSlash,
        className: "bg-gray-100 text-gray-500 border-gray-200",
      },
    };
    const c = config[s];
    const Icon = c.icon;
    return (
      <span
        title={motivo || c.label}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.className}`}
      >
        <Icon className="w-3 h-3" />
        {c.label}
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
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">
                  Notificações Fornecedor
                </h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {loading
                    ? "Carregando..."
                    : `${total} pedido${total !== 1 ? "s" : ""} aprovado${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard de Métricas */}
      {metrics && metrics.totalEnviadas > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard
              icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
              label="Taxa de Entrega"
              value={`${metrics.taxaEntrega.toFixed(0)}%`}
              detail={`${metrics.totalEntregues}/${metrics.totalEnviadas}`}
              color="blue"
            />
            <MetricCard
              icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
              label="Taxa de Leitura"
              value={`${metrics.taxaLeitura.toFixed(0)}%`}
              detail={`${metrics.totalLidas}/${metrics.totalEnviadas}`}
              color="emerald"
            />
            <MetricCard
              icon={<MousePointerClick className="w-4 h-4 text-purple-600" />}
              label="Cliques no Botão"
              value={`${metrics.taxaCliques.toFixed(0)}%`}
              detail={`${metrics.totalCliques}/${metrics.totalEnviadas}`}
              color="purple"
            />
            <MetricCard
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              label="Tempo Médio Leitura"
              value={formatTempo(metrics.tempoMedioLeitura)}
              detail="após envio"
              color="amber"
            />
            <MetricCard
              icon={<AlertCircle className="w-4 h-4 text-red-600" />}
              label="Falhas"
              value={`${metrics.totalFalhou}`}
              detail="mensagens"
              color="red"
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por pedido, fornecedor, contato ou centro de custo..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro por status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--muted-foreground)]">Status:</span>
          <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-0.5 flex-wrap">
            {[
              { key: "todos", label: "Todos" },
              { key: "na_fila", label: "Na fila" },
              { key: "enviado", label: "Enviado" },
              { key: "problemas", label: "Com problemas" },
              { key: "sem_contato", label: "Sem contato" },
              { key: "sem_pdf", label: "Sem PDF" },
              { key: "erro", label: "Erro" },
              { key: "pendente", label: "Pendente" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setFiltroStatus(opt.key as any);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filtroStatus === opt.key
                    ? "bg-black text-white"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--background-secondary)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Carregando registros...</p>
          </div>
        ) : eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bell className="w-12 h-12 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {debouncedSearch
                ? "Nenhum registro encontrado com a busca aplicada"
                : "Ainda não há pedidos aprovados"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Fornecedor</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">ID</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">CC</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Contato</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">WhatsApp</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Data</th>
                    <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Fornec.</th>
                    <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Grupo</th>
                    <th className="text-right text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((evento, idx) => (
                    <tr
                      key={evento.id}
                      onClick={() => setSelectedEvento(evento)}
                      className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors cursor-pointer ${
                        idx % 2 === 0 ? "" : "bg-[var(--background-alt)]/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {evento.nome_fornecedor || "—"}
                          </p>
                          {evento.id_fornecedor && (
                            <p className="text-[11px] text-[var(--muted-foreground)]">
                              #{evento.id_fornecedor}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">
                          {evento.id_pedido || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--foreground)]">
                          {evento.centro_custo || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--foreground)]">
                          {evento.nome_contato || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {evento.contato_fornecedor ? (
                            <>
                              <Phone className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
                              <span className="text-xs text-[var(--foreground)]">
                                {formatPhone(evento.contato_fornecedor)}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-[var(--muted-foreground)]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--foreground)]">
                          {formatDate(evento.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex justify-center">
                          {renderStatusBadge(evento.notificacao_status, evento.notificacao_motivo)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex justify-center">
                          <WhatsAppStatusIcon
                            status={getStatus(evento.id, "fornecedor")}
                            buttonClicked={getButtonClicked(evento.id, "fornecedor")}
                            size="md"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex justify-center">
                          <WhatsAppStatusIcon
                            status={getStatus(evento.id, "grupo")}
                            buttonClicked={getButtonClicked(evento.id, "grupo")}
                            size="md"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {evento.storage_pdf_pedido ? (
                            <a
                              href={evento.storage_pdf_pedido}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors"
                              title="Baixar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-[var(--muted-foreground)]">—</span>
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
              {eventos.map((evento) => (
                <div
                  key={evento.id}
                  onClick={() => setSelectedEvento(evento)}
                  className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-3 cursor-pointer active:bg-[var(--background-alt)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {evento.nome_fornecedor || "—"}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        Pedido #{evento.id_pedido || "—"} · CC {evento.centro_custo || "—"}
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)] flex-shrink-0 ml-2">
                      {formatDate(evento.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {renderStatusBadge(evento.notificacao_status, evento.notificacao_motivo)}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[var(--muted-foreground)]">Fornec:</span>
                      <WhatsAppStatusIcon
                        status={getStatus(evento.id, "fornecedor")}
                        buttonClicked={getButtonClicked(evento.id, "fornecedor")}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[var(--muted-foreground)]">Grupo:</span>
                      <WhatsAppStatusIcon
                        status={getStatus(evento.id, "grupo")}
                        buttonClicked={getButtonClicked(evento.id, "grupo")}
                      />
                    </div>
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
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-[var(--border)] rounded-lg text-sm focus:outline-none"
                >
                  {LIMIT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <span>por pagina</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg bg-white border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Drawer de detalhes */}
      <PedidoDetailsDrawer
        evento={selectedEvento}
        onClose={() => setSelectedEvento(null)}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  color: "blue" | "emerald" | "purple" | "amber" | "red";
}) {
  return (
    <div className="p-3 rounded-xl border bg-white border-[var(--border)] text-left">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{detail}</p>
    </div>
  );
}
