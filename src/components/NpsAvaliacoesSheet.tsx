"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search, Star, MessageSquare, Building2, User, Calendar, X, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";

interface AvaliacaoNps {
  id: string;
  nota: number;
  comentario: string | null;
  responded_at: string | null;
  id_assistencia: number;
  responsaveis: string[];
  categoria_reparo: string | null;
  proprietario: string | null;
  cpf: string | null;
  empreendimento: string | null;
  bloco: string | null;
  unidade: string | null;
}

interface Agregados {
  media: number | null;
  total: number;
  distribuicao: Record<string, number>;
  detratores: number;
  neutros: number;
  promotores: number;
  npsScore: number | null;
}

interface FiltrosDisponiveis {
  empreendimentos: string[];
  responsaveis: string[];
  categorias: string[];
}

interface NpsAvaliacoesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataInicio?: string;
  dataFim?: string;
}

const ITENS_POR_PAGINA = 25;

const mascararCpf = (cpf: string | null) => {
  if (!cpf) return "-";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
};

const classificarNota = (n: number) => {
  if (n <= 6) return { tipo: "detrator", label: "Detrator", cls: "bg-red-100 text-red-700 border-red-200" };
  if (n <= 8) return { tipo: "neutro", label: "Neutro", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  return { tipo: "promotor", label: "Promotor", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
};

const formatarDataRel = (iso: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const agora = new Date();
    const diffMs = agora.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 36e5);
    if (diffH < 1) return "há poucos minutos";
    if (diffH < 24) return `há ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `há ${diffD}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
};

const formatarDataAbs = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
};

export function NpsAvaliacoesSheet({ open, onOpenChange, dataInicio, dataFim }: NpsAvaliacoesSheetProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [data, setData] = useState<AvaliacaoNps[]>([]);
  const [agregados, setAgregados] = useState<Agregados | null>(null);
  const [filtrosDisp, setFiltrosDisp] = useState<FiltrosDisponiveis>({ empreendimentos: [], responsaveis: [], categorias: [] });
  const [paginacao, setPaginacao] = useState<{ total: number; hasMore: boolean; page: number; truncatedPool: boolean }>({
    total: 0, hasMore: false, page: 1, truncatedPool: false,
  });

  // Filtros internos
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [faixa, setFaixa] = useState<"todas" | "detrator" | "neutro" | "promotor">("todas");
  const [apenasComComentario, setApenasComComentario] = useState(false);
  const [empreendimento, setEmpreendimento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ordem, setOrdem] = useState<"data_desc" | "nota_asc" | "nota_desc">("data_desc");
  const [page, setPage] = useState(1);
  const [comentarioExpandidoId, setComentarioExpandidoId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  // Reset página ao mudar filtros
  useEffect(() => {
    setPage(1);
  }, [buscaDebounced, faixa, apenasComComentario, empreendimento, responsavel, categoria, ordem, dataInicio, dataFim]);

  const { minNota, maxNota } = useMemo(() => {
    switch (faixa) {
      case "detrator": return { minNota: 1, maxNota: 6 };
      case "neutro": return { minNota: 7, maxNota: 8 };
      case "promotor": return { minNota: 9, maxNota: 10 };
      default: return { minNota: undefined, maxNota: undefined };
    }
  }, [faixa]);

  const carregar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      if (minNota !== undefined) params.set("minNota", String(minNota));
      if (maxNota !== undefined) params.set("maxNota", String(maxNota));
      if (apenasComComentario) params.set("apenasComComentario", "true");
      if (buscaDebounced.trim()) params.set("search", buscaDebounced.trim());
      if (empreendimento) params.set("empreendimento", empreendimento);
      if (responsavel) params.set("responsavel", responsavel);
      if (categoria) params.set("categoria", categoria);
      params.set("ordem", ordem);
      params.set("page", String(page));
      params.set("limit", String(ITENS_POR_PAGINA));

      const res = await fetch(`${apiBaseUrl}/avaliacoes-nps?${params}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data || []);
      setAgregados(json.agregados || null);
      setFiltrosDisp(json.filtrosDisponiveis || { empreendimentos: [], responsaveis: [], categorias: [] });
      setPaginacao({
        total: json.pagination?.total || 0,
        hasMore: json.pagination?.hasMore || false,
        page: json.pagination?.page || 1,
        truncatedPool: json.pagination?.truncatedPool || false,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error("Erro ao carregar avaliações NPS:", e);
      setErro("Erro ao carregar avaliações. Tente novamente.");
      setData([]);
      setAgregados(null);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, minNota, maxNota, apenasComComentario, buscaDebounced, empreendimento, responsavel, categoria, ordem, page]);

  useEffect(() => {
    if (open) carregar();
    return () => abortRef.current?.abort();
  }, [open, carregar]);

  const exportarCsv = () => {
    if (data.length === 0) return;
    const linhas: string[] = [];
    linhas.push(["Cliente", "CPF", "Empreendimento", "Bloco", "Unidade", "Data", "Nota", "Faixa", "Comentário", "Categoria", "Responsáveis", "Chamado"].join(";"));
    for (const r of data) {
      const faixaInfo = classificarNota(r.nota);
      const linha = [
        r.proprietario || "",
        r.cpf || "",
        r.empreendimento || "",
        r.bloco || "",
        r.unidade || "",
        r.responded_at ? new Date(r.responded_at).toLocaleString("pt-BR") : "",
        String(r.nota ?? ""),
        faixaInfo.label,
        (r.comentario || "").replace(/[\r\n;]+/g, " "),
        r.categoria_reparo || "",
        (r.responsaveis || []).join(", "),
        String(r.id_assistencia ?? ""),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";");
      linhas.push(linha);
    }
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nps-avaliacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const limparFiltros = () => {
    setBusca("");
    setFaixa("todas");
    setApenasComComentario(false);
    setEmpreendimento("");
    setResponsavel("");
    setCategoria("");
    setOrdem("data_desc");
    setPage(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(paginacao.total / ITENS_POR_PAGINA));

  const periodoLabel = useMemo(() => {
    if (!dataInicio && !dataFim) return "Todo o período";
    const fmt = (s?: string) => {
      if (!s) return "";
      const [a, m, d] = s.split("-").map(Number);
      return new Date(a, m - 1, d).toLocaleDateString("pt-BR");
    };
    return `${fmt(dataInicio)} → ${fmt(dataFim)}`;
  }, [dataInicio, dataFim]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-4xl p-0 overflow-y-auto"
      >
        <SheetHeader className="px-4 sm:px-6 pt-6 pb-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <SheetTitle className="text-base sm:text-lg">Avaliações NPS</SheetTitle>
                <SheetDescription className="text-xs">
                  {periodoLabel} · {paginacao.total} {paginacao.total === 1 ? "avaliação" : "avaliações"}
                  {paginacao.truncatedPool && " (amostra de 1.000)"}
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Resumo agregado */}
          {agregados && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-[10px] text-yellow-800 font-semibold uppercase tracking-wide">Média</p>
                <p className="text-2xl font-bold text-gray-900">{agregados.media !== null ? agregados.media.toFixed(1) : "—"}</p>
                <p className="text-[10px] text-gray-500">de 10</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wide">Promotores</p>
                <p className="text-2xl font-bold text-emerald-700">{agregados.promotores}</p>
                <p className="text-[10px] text-gray-500">notas 9–10</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[10px] text-amber-800 font-semibold uppercase tracking-wide">Neutros</p>
                <p className="text-2xl font-bold text-amber-700">{agregados.neutros}</p>
                <p className="text-[10px] text-gray-500">notas 7–8</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-[10px] text-red-800 font-semibold uppercase tracking-wide">Detratores</p>
                <p className="text-2xl font-bold text-red-700">{agregados.detratores}</p>
                <p className="text-[10px] text-gray-500">notas 0–6</p>
              </div>
            </div>
          )}

          {/* Distribuição (mini histograma) */}
          {agregados && agregados.total > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide mb-1">Distribuição</p>
              <div className="flex items-end gap-1 h-12">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const qtd = agregados.distribuicao?.[String(n)] || 0;
                  const max = Math.max(...Object.values(agregados.distribuicao || {}));
                  const altura = max > 0 ? Math.max(4, (qtd / max) * 100) : 4;
                  const c = classificarNota(n);
                  const cor = c.tipo === "promotor" ? "bg-emerald-500" : c.tipo === "neutro" ? "bg-amber-500" : "bg-red-500";
                  return (
                    <div key={n} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className={`w-full rounded-sm ${cor}`} style={{ height: `${altura}%` }} title={`Nota ${n}: ${qtd}`} />
                      <span className="text-[9px] text-gray-500 font-medium">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Filtros */}
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-gray-50 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou comentário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as typeof ordem)}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
            >
              <option value="data_desc">Mais recentes</option>
              <option value="nota_desc">Maior nota</option>
              <option value="nota_asc">Menor nota</option>
            </select>
            <button
              onClick={exportarCsv}
              disabled={data.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exportar CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-0.5">
              {([
                { value: "todas", label: "Todas" },
                { value: "promotor", label: "Promotores" },
                { value: "neutro", label: "Neutros" },
                { value: "detrator", label: "Detratores" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFaixa(opt.value)}
                  className={`px-2 py-1 text-[11px] font-medium rounded ${faixa === opt.value ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded-md px-2 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={apenasComComentario}
                onChange={(e) => setApenasComComentario(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Com comentário
            </label>

            <select
              value={empreendimento}
              onChange={(e) => setEmpreendimento(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white max-w-[160px]"
            >
              <option value="">Empreendimento</option>
              {filtrosDisp.empreendimentos.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white max-w-[160px]"
            >
              <option value="">Responsável</option>
              {filtrosDisp.responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white max-w-[160px]"
            >
              <option value="">Categoria</option>
              {filtrosDisp.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {(busca || faixa !== "todas" || apenasComComentario || empreendimento || responsavel || categoria || ordem !== "data_desc") && (
              <button
                onClick={limparFiltros}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 hover:text-gray-900"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="px-4 sm:px-6 py-4">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : erro ? (
            <div className="text-center py-12 text-sm text-red-600">{erro}</div>
          ) : data.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhuma avaliação no recorte atual.</p>
              <p className="text-xs text-gray-400 mt-1">Tente ajustar os filtros ou o período.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((r) => {
                const faixaInfo = classificarNota(r.nota);
                const expandido = comentarioExpandidoId === r.id;
                const temComentario = !!(r.comentario && r.comentario.trim());
                return (
                  <div
                    key={r.id}
                    className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 truncate">{r.proprietario || "—"}</span>
                          <span className="text-[11px] text-gray-500 font-mono">{mascararCpf(r.cpf)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${faixaInfo.cls}`}>
                            {faixaInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 flex-wrap">
                          {r.empreendimento && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {r.empreendimento}
                              {r.bloco && r.unidade ? ` · Bl. ${r.bloco} / Un. ${r.unidade}` : ""}
                            </span>
                          )}
                          {r.categoria_reparo && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">
                              {r.categoria_reparo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1" title={formatarDataAbs(r.responded_at)}>
                            <Calendar className="h-3 w-3" />
                            {formatarDataRel(r.responded_at)}
                          </span>
                          {(r.responsaveis || []).length > 0 && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {r.responsaveis.join(", ")}
                            </span>
                          )}
                          <span className="text-gray-400">Chamado #{r.id_assistencia}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center min-w-[44px]">
                        <span className="text-2xl font-bold text-gray-900">{r.nota}</span>
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">de 10</span>
                      </div>
                    </div>

                    {temComentario && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-start gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p
                            className={`text-xs text-gray-700 leading-relaxed ${expandido ? "" : "line-clamp-2"} cursor-pointer`}
                            onClick={() => setComentarioExpandidoId(expandido ? null : r.id)}
                          >
                            {r.comentario}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação */}
          {!carregando && data.length > 0 && totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <p className="text-[11px] text-gray-500">
                Página {paginacao.page} de {totalPaginas}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={paginacao.page === 1}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!paginacao.hasMore}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
