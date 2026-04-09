"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Users,
  Loader2,
  X,
  TrendingUp,
  Clock,
  MousePointerClick,
  ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";

interface FornecedorStats {
  id_fornecedor: string;
  nome_fornecedor: string;
  contato_fornecedor: string | null;
  total_pedidos: number;
  total_enviadas: number;
  total_lidas: number;
  total_cliques: number;
  taxa_leitura: number;
  taxa_cliques: number;
  tempo_medio_leitura: number;
  ultimo_pedido: string | null;
}

export function FornecedoresHistoricoList() {
  const [fornecedores, setFornecedores] = useState<FornecedorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"pedidos" | "cliques" | "tempo">("pedidos");

  const fetchFornecedores = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseComprasClient();

      // Buscar todos os eventos
      const { data: eventos } = await (supabase
        .from("eventos_pedidos_aprovados") as any)
        .select("id, id_fornecedor, nome_fornecedor, contato_fornecedor, created_at")
        .not("id_fornecedor", "is", null);

      if (!eventos) {
        setFornecedores([]);
        return;
      }

      // Buscar todos os status de mensagem
      const { data: statuses } = await (supabase
        .from("whatsapp_message_status") as any)
        .select("evento_pedido_id, tipo_destinatario, status, button_clicked, created_at, status_timestamp")
        .eq("tipo_destinatario", "fornecedor");

      // Agrupar por fornecedor
      const map = new Map<string, FornecedorStats>();

      for (const evento of eventos) {
        const key = evento.id_fornecedor;
        if (!map.has(key)) {
          map.set(key, {
            id_fornecedor: evento.id_fornecedor,
            nome_fornecedor: evento.nome_fornecedor,
            contato_fornecedor: evento.contato_fornecedor,
            total_pedidos: 0,
            total_enviadas: 0,
            total_lidas: 0,
            total_cliques: 0,
            taxa_leitura: 0,
            taxa_cliques: 0,
            tempo_medio_leitura: 0,
            ultimo_pedido: null,
          });
        }
        const stats = map.get(key)!;
        stats.total_pedidos += 1;
        if (!stats.ultimo_pedido || evento.created_at > stats.ultimo_pedido) {
          stats.ultimo_pedido = evento.created_at;
        }

        const eventoStatuses = (statuses || []).filter(
          (s: any) => s.evento_pedido_id === evento.id
        );
        for (const s of eventoStatuses) {
          stats.total_enviadas += 1;
          if (["READ", "PLAYED"].includes(s.status)) {
            stats.total_lidas += 1;
          }
          if (s.button_clicked) {
            stats.total_cliques += 1;
          }
        }
      }

      // Calcular tempos médios
      const tempos = new Map<string, number[]>();
      for (const s of statuses || []) {
        if (!["READ", "PLAYED"].includes(s.status)) continue;
        const evento = eventos.find((e: any) => e.id === s.evento_pedido_id);
        if (!evento) continue;
        const minutos =
          (new Date(s.status_timestamp).getTime() - new Date(s.created_at).getTime()) /
          1000 /
          60;
        if (!tempos.has(evento.id_fornecedor)) tempos.set(evento.id_fornecedor, []);
        tempos.get(evento.id_fornecedor)!.push(minutos);
      }

      // Calcular taxas (taxa_cliques = cliques / TOTAL DE PEDIDOS, não enviadas)
      const arr = Array.from(map.values()).map((stats) => {
        const t = tempos.get(stats.id_fornecedor) || [];
        return {
          ...stats,
          taxa_leitura:
            stats.total_enviadas > 0 ? (stats.total_lidas / stats.total_enviadas) * 100 : 0,
          taxa_cliques:
            stats.total_pedidos > 0 ? (stats.total_cliques / stats.total_pedidos) * 100 : 0,
          tempo_medio_leitura:
            t.length > 0 ? t.reduce((a, b) => a + b, 0) / t.length : 0,
        };
      });

      setFornecedores(arr);
    } catch (err) {
      console.error("Erro ao buscar fornecedores:", err);
      setFornecedores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const formatTempo = (minutos: number) => {
    if (minutos === 0) return "—";
    if (minutos < 1) return "< 1 min";
    if (minutos < 60) return `${Math.round(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    const min = Math.round(minutos % 60);
    return `${horas}h ${min}min`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Filtrar e ordenar
  const filtered = fornecedores
    .filter((f) =>
      search
        ? f.nome_fornecedor?.toLowerCase().includes(search.toLowerCase()) ||
          f.id_fornecedor?.includes(search)
        : true
    )
    .sort((a, b) => {
      if (sortBy === "pedidos") return b.total_pedidos - a.total_pedidos;
      if (sortBy === "cliques") return b.taxa_cliques - a.taxa_cliques;
      if (sortBy === "tempo") {
        if (a.tempo_medio_leitura === 0) return 1;
        if (b.tempo_medio_leitura === 0) return -1;
        return a.tempo_medio_leitura - b.tempo_medio_leitura;
      }
      return 0;
    });

  // Classificação de engajamento baseada em PEDIDOS VS CLIQUES
  const getEngagementBadge = (taxaCliques: number, totalPedidos: number) => {
    if (totalPedidos < 3) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Novo
        </span>
      );
    }
    if (taxaCliques >= 70)
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Confiável
        </span>
      );
    if (taxaCliques >= 30)
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Médio
        </span>
      );
    if (taxaCliques > 0)
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
          Baixo
        </span>
      );
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Nunca abriu
      </span>
    );
  };

  const ENGAGEMENT_LEGEND = [
    { label: "Novo", range: "< 3 pedidos", className: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Confiável", range: "≥ 70%", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Médio", range: "30% – 70%", className: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Baixo", range: "1% – 29%", className: "bg-red-50 text-red-700 border-red-200" },
    { label: "Nunca abriu", range: "0%", className: "bg-gray-100 text-gray-500 border-gray-200" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Histórico por Fornecedor
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {loading
                  ? "Carregando..."
                  : `${fornecedores.length} fornecedor${fornecedores.length !== 1 ? "es" : ""} com pedidos`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor por nome ou ID..."
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

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Ordenar por */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Ordenar por:</span>
            <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-0.5">
              {[
                { key: "pedidos", label: "Mais pedidos" },
                { key: "cliques", label: "Mais cliques" },
                { key: "tempo", label: "Mais rápido" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key as any)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    sortBy === opt.key
                      ? "bg-black text-white"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--background-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legenda de Engajamento */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--muted-foreground)]">Engajamento:</span>
            {ENGAGEMENT_LEGEND.map((tag) => (
              <div
                key={tag.label}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tag.className}`}
              >
                <span>{tag.label}</span>
                <span className="opacity-70 font-mono">{tag.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Calculando estatísticas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users className="w-12 h-12 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor com pedidos"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
                  <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Fornecedor
                  </th>
                  <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Pedidos
                  </th>
                  <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Taxa Cliques
                  </th>
                  <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Taxa Leitura
                  </th>
                  <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Tempo Médio
                  </th>
                  <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Engajamento
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Último Pedido
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, idx) => (
                  <motion.tr
                    key={f.id_fornecedor}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                    className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors ${
                      idx % 2 === 0 ? "" : "bg-[var(--background-alt)]/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {f.nome_fornecedor}
                        </p>
                        <p className="text-[11px] text-[var(--muted-foreground)] font-mono">
                          #{f.id_fornecedor}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {f.total_pedidos}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] inline-flex items-center gap-0.5">
                          <MousePointerClick className="w-2.5 h-2.5 text-purple-600" />
                          {f.total_cliques} clique{f.total_cliques !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {f.taxa_cliques.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {f.taxa_leitura.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs text-[var(--foreground)]">
                          {formatTempo(f.tempo_medio_leitura)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getEngagementBadge(f.taxa_cliques, f.total_pedidos)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatDate(f.ultimo_pedido)}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
