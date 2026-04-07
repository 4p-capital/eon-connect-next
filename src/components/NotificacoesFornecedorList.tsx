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
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";

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
}

const LIMIT_OPTIONS = [50, 100, 200] as const;

export function NotificacoesFornecedorList() {
  const [eventos, setEventos] = useState<EventoPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState<number>(50);
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

      let query = supabase
        .from("eventos_pedidos_aprovados")
        .select("*", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(
          `id_pedido.ilike.%${debouncedSearch}%,nome_fornecedor.ilike.%${debouncedSearch}%,contato_fornecedor.ilike.%${debouncedSearch}%,centro_custo.ilike.%${debouncedSearch}%,nome_contato.ilike.%${debouncedSearch}%`
        );
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setEventos(data || []);
      setTotal(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / limit)));
    } catch (error) {
      console.error("Erro ao buscar eventos:", error);
      setEventos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, limit]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

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

  const totalFornecedorNotificado = eventos.filter((e) => e.fornecedor_notificado).length;
  const totalFornecedorPendente = eventos.filter((e) => !e.fornecedor_notificado).length;
  const totalGrupoNotificado = eventos.filter((e) => e.grupo_notificado).length;
  const totalGrupoPendente = eventos.filter((e) => !e.grupo_notificado).length;

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

      {/* Métricas */}
      {!loading && eventos.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border bg-white border-[var(--border)] text-left">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Fornecedor Notificado</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{totalFornecedorNotificado}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)] text-left">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Fornecedor Pendente</span>
              </div>
              <p className="text-xl font-bold text-gray-500">{totalFornecedorPendente}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)] text-left">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Grupo Notificado</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{totalGrupoNotificado}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)] text-left">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Grupo Pendente</span>
              </div>
              <p className="text-xl font-bold text-gray-500">{totalGrupoPendente}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
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
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Centro de Custo</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Contato</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">WhatsApp</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Data</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Fornecedor</th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">Grupo Obra</th>
                    <th className="text-right text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">PDF Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((evento, idx) => (
                    <tr
                      key={evento.id}
                      className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors ${
                        idx % 2 === 0 ? "" : "bg-[var(--background-alt)]/50"
                      }`}
                    >
                      {/* Fornecedor */}
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
                      {/* ID Pedido */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">
                          {evento.id_pedido || "—"}
                        </span>
                      </td>
                      {/* Centro de Custo */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--foreground)]">
                          {evento.centro_custo || "—"}
                        </span>
                      </td>
                      {/* Contato */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs text-[var(--foreground)]">
                            {evento.nome_contato || "—"}
                          </p>
                        </div>
                      </td>
                      {/* WhatsApp */}
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
                      {/* Data */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--foreground)]">
                          {formatDate(evento.created_at)}
                        </p>
                      </td>
                      {/* Fornecedor Notificado */}
                      <td className="px-4 py-3">
                        {evento.fornecedor_notificado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Notificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                            <XCircle className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>
                      {/* Grupo Notificado */}
                      <td className="px-4 py-3">
                        {evento.grupo_notificado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Notificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                            <XCircle className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>
                      {/* PDF Pedido */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {evento.storage_pdf_pedido ? (
                            <a
                              href={evento.storage_pdf_pedido}
                              target="_blank"
                              rel="noopener noreferrer"
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
                  className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {evento.nome_fornecedor || "—"}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        Pedido #{evento.id_pedido || "—"} · CC {evento.centro_custo || "—"}
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {formatDate(evento.created_at)}
                    </span>
                  </div>

                  {/* Info */}
                  {(evento.nome_contato || evento.contato_fornecedor) && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <Phone className="w-3.5 h-3.5" />
                      {evento.nome_contato && <span>{evento.nome_contato}</span>}
                      {evento.nome_contato && evento.contato_fornecedor && <span>·</span>}
                      {evento.contato_fornecedor && (
                        <span>{formatPhone(evento.contato_fornecedor)}</span>
                      )}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {evento.fornecedor_notificado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Fornecedor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                        <XCircle className="w-3 h-3" />
                        Fornecedor
                      </span>
                    )}
                    {evento.grupo_notificado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Grupo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                        <XCircle className="w-3 h-3" />
                        Grupo
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {evento.storage_pdf_pedido && (
                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
                      <a
                        href={evento.storage_pdf_pedido}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--foreground)] bg-[var(--background-secondary)] hover:bg-[var(--border)] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    </div>
                  )}
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
    </div>
  );
}
