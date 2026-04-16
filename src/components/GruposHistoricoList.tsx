"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Users2,
  Loader2,
  X,
  TrendingUp,
  Clock,
  MousePointerClick,
  Building2,
} from "lucide-react";
import { motion } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";

interface GrupoStats {
  grupo_id: string;
  nome_grupo: string;
  centros_custo: string[];
  contato: string;
  ativo: boolean;
  total_pedidos: number;
  total_enviadas: number;
  total_lidas: number;
  total_cliques: number;
  taxa_leitura: number;
  taxa_cliques: number;
  tempo_medio_leitura: number;
  ultimo_pedido: string | null;
}

export function GruposHistoricoList() {
  usePermissionGuard("notificacoes.historico_grupos");
  const [grupos, setGrupos] = useState<GrupoStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"pedidos" | "cliques" | "tempo">("pedidos");

  const fetchGruposStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseComprasClient();

      // Buscar todos os grupos cadastrados
      const { data: gruposData } = await (supabase
        .from("grupos_notificacao") as any)
        .select("*")
        .order("nome_grupo", { ascending: true });

      if (!gruposData || gruposData.length === 0) {
        setGrupos([]);
        return;
      }

      // Buscar todas as mensagens enviadas para grupos
      const { data: statuses } = await (supabase
        .from("whatsapp_message_status") as any)
        .select("evento_pedido_id, destinatario, nome_destinatario, status, button_clicked, created_at, status_timestamp")
        .eq("tipo_destinatario", "grupo");

      // Buscar eventos de pedidos para conseguir mapear cada mensagem ao centro_custo
      const { data: eventos } = await (supabase
        .from("eventos_pedidos_aprovados") as any)
        .select("id, centro_custo, created_at");

      const eventosMap = new Map<string, any>();
      (eventos || []).forEach((e: any) => eventosMap.set(e.id, e));

      // Agrupar stats por grupo (chave: grupo.id)
      const statsMap = new Map<string, GrupoStats>();

      for (const grupo of gruposData) {
        statsMap.set(grupo.id, {
          grupo_id: grupo.id,
          nome_grupo: grupo.nome_grupo,
          centros_custo: grupo.centros_custo || [],
          contato: grupo.contato,
          ativo: grupo.ativo,
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

      // Mapear cada status para o grupo correto via centros_custo (array) + nome_destinatario
      const tempos = new Map<string, number[]>();

      for (const s of statuses || []) {
        const evento = eventosMap.get(s.evento_pedido_id);
        if (!evento) continue;

        // Achar o grupo correspondente: centros_custo contém o centro do evento + mesmo nome_destinatario
        const grupo = gruposData.find(
          (g: any) =>
            (g.centros_custo || []).includes(evento.centro_custo) &&
            g.nome_grupo === s.nome_destinatario
        );
        if (!grupo) continue;

        const stats = statsMap.get(grupo.id);
        if (!stats) continue;

        stats.total_pedidos += 1;
        stats.total_enviadas += 1;

        if (!stats.ultimo_pedido || evento.created_at > stats.ultimo_pedido) {
          stats.ultimo_pedido = evento.created_at;
        }

        if (["READ", "PLAYED"].includes(s.status)) {
          stats.total_lidas += 1;
        }
        if (s.button_clicked) {
          stats.total_cliques += 1;
        }

        // Tempo até leitura
        if (["READ", "PLAYED"].includes(s.status) && s.created_at && s.status_timestamp) {
          const minutos =
            (new Date(s.status_timestamp).getTime() - new Date(s.created_at).getTime()) / 1000 / 60;
          if (!tempos.has(grupo.id)) tempos.set(grupo.id, []);
          tempos.get(grupo.id)!.push(minutos);
        }
      }

      // Calcular taxas
      const arr = Array.from(statsMap.values()).map((stats) => {
        const t = tempos.get(stats.grupo_id) || [];
        return {
          ...stats,
          taxa_leitura:
            stats.total_enviadas > 0 ? (stats.total_lidas / stats.total_enviadas) * 100 : 0,
          taxa_cliques:
            stats.total_pedidos > 0 ? (stats.total_cliques / stats.total_pedidos) * 100 : 0,
          tempo_medio_leitura: t.length > 0 ? t.reduce((a, b) => a + b, 0) / t.length : 0,
        };
      });

      setGrupos(arr);
    } catch (err) {
      console.error("Erro ao buscar grupos:", err);
      setGrupos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGruposStats();
  }, [fetchGruposStats]);

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
  const filtered = grupos
    .filter((g) =>
      search
        ? g.nome_grupo?.toLowerCase().includes(search.toLowerCase()) ||
          (g.centros_custo || []).some((cc) => cc.includes(search)) ||
          g.contato?.includes(search)
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
              <Users2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Histórico por Grupo
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {loading
                  ? "Carregando..."
                  : `${grupos.length} grupo${grupos.length !== 1 ? "s" : ""} cadastrado${grupos.length !== 1 ? "s" : ""}`}
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
            placeholder="Buscar grupo por nome, centro de custo ou contato..."
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
            <Users2 className="w-12 h-12 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {search ? "Nenhum grupo encontrado" : "Nenhum grupo cadastrado ainda"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
                  <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Grupo
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                    Centros de Custo
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
                {filtered.map((g, idx) => (
                  <motion.tr
                    key={g.grupo_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                    className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors ${
                      idx % 2 === 0 ? "" : "bg-[var(--background-alt)]/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--background-secondary)] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                            {g.nome_grupo.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {g.nome_grupo}
                            {!g.ativo && (
                              <span className="ml-1.5 text-[10px] text-[var(--muted-foreground)] font-normal">
                                (inativo)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[var(--muted-foreground)] font-mono truncate max-w-[200px]">
                            {g.contato}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(g.centros_custo || []).map((cc) => (
                          <span
                            key={cc}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--background-secondary)] text-xs font-mono text-[var(--foreground)]"
                          >
                            <Building2 className="w-3 h-3 text-[var(--muted-foreground)]" />
                            {cc}
                          </span>
                        ))}
                        {(!g.centros_custo || g.centros_custo.length === 0) && (
                          <span className="text-[11px] text-[var(--muted-foreground)]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {g.total_pedidos}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] inline-flex items-center gap-0.5">
                          <MousePointerClick className="w-2.5 h-2.5 text-purple-600" />
                          {g.total_cliques} clique{g.total_cliques !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {g.taxa_cliques.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {g.taxa_leitura.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs text-[var(--foreground)]">
                          {formatTempo(g.tempo_medio_leitura)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getEngagementBadge(g.taxa_cliques, g.total_pedidos)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatDate(g.ultimo_pedido)}
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
