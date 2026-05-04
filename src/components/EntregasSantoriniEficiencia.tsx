"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import {
  TrendingDown,
  Calendar,
  Filter,
  X,
  Loader2,
  Trophy,
  Download,
  ShieldCheck,
  Wallet,
  FileText,
  AlertCircle,
  Users,
  KeyRound,
  Building2,
} from "lucide-react";
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";

type Setor = "agehab" | "financeiro" | "contratos";
type Visao = "pendencias" | "clientes";

interface EficienciaResp {
  baseline: Record<Setor, number>;
  atual: Record<Setor, number>;
  resolvidas: Record<Setor, number>;
  reabertas: Record<Setor, number>;
  clientes: { baseline: number; atual: number; liberados: number };
  distribuicao: { baseline: Record<string, number>; atual: Record<string, number> };
  topEmpreendimentos: Array<{
    nome: string;
    clientes: number;
    agehab: number;
    financeiro: number;
    contratos: number;
    total: number;
  }>;
  evolucaoDiaria: Array<{
    data: string;
    agehab: number;
    financeiro: number;
    contratos: number;
    clientesPendentes: number;
  }>;
  topResolvedores: Array<{ nome: string; total: number }>;
  periodo: { inicioISO: string; fimISO: string; snapshotInicialEm: string | null };
}

const SETOR_INFO: Record<Setor, { label: string; cor: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  contratos: { label: "Contratos (RERAS)", cor: "#475569", icon: FileText },
  financeiro: { label: "Financeiro", cor: "#f59e0b", icon: Wallet },
  agehab: { label: "AGEHAB", cor: "#7c3aed", icon: ShieldCheck },
};

function formatarData(d: string) {
  try {
    const [ano, mes, dia] = d.split("-").map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return d;
  }
}

function formatarDataLocal(s: string) {
  if (!s) return "";
  const [ano, mes, dia] = s.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

export function EntregasSantoriniEficiencia() {
  const [dados, setDados] = useState<EficienciaResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [setor, setSetor] = useState<"" | Setor>("");
  const [visao, setVisao] = useState<Visao>("pendencias");

  const abortRef = useRef<AbortController | null>(null);

  const aplicarAtalho = (periodo: string) => {
    const hoje = new Date();
    let inicio = new Date();
    switch (periodo) {
      case "7dias":
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - 7);
        break;
      case "30dias":
        inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - 30);
        break;
      case "este_mes":
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      case "campanha":
        // Sem dataInicio → backend usa snapshotInicialEm como início.
        setDataInicio("");
        setDataFim("");
        setFiltroAtivo(false);
        return;
    }
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDataInicio(fmt(inicio));
    setDataFim(fmt(hoje));
    setFiltroAtivo(true);
  };

  const carregar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroAtivo && dataInicio) params.set("dataInicio", dataInicio);
      if (filtroAtivo && dataFim) params.set("dataFim", dataFim);
      if (setor) params.set("setor", setor);

      const res = await fetch(`${apiBaseUrl}/entregas/pendencias/eficiencia?${params}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDados(json);
    } catch (e: unknown) {
      const isAbort =
        typeof e === "object" && e !== null && "name" in e && (e as { name?: unknown }).name === "AbortError";
      if (isAbort) return;
      console.error("Erro em /entregas/pendencias/eficiencia:", e);
      setErro("Erro ao carregar dados de eficiência. Tente novamente.");
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, filtroAtivo, setor]);

  useEffect(() => {
    carregar();
    return () => abortRef.current?.abort();
  }, [carregar]);

  const totais = useMemo(() => {
    if (!dados) return null;
    const baseline = dados.baseline.agehab + dados.baseline.financeiro + dados.baseline.contratos;
    const atual = dados.atual.agehab + dados.atual.financeiro + dados.atual.contratos;
    const resolvidas = dados.resolvidas.agehab + dados.resolvidas.financeiro + dados.resolvidas.contratos;
    const reabertas = dados.reabertas.agehab + dados.reabertas.financeiro + dados.reabertas.contratos;
    const reducao = baseline > 0 ? Math.round(((baseline - atual) / baseline) * 100) : 0;
    return { baseline, atual, resolvidas, reabertas, reducao };
  }, [dados]);

  const exportarCsv = () => {
    if (!dados) return;
    const linhas: string[] = [];
    linhas.push(["Setor", "Baseline", "Atual", "Resolvidas no período", "Reabertas no período", "% redução"].join(";"));
    for (const s of ["contratos", "financeiro", "agehab"] as Setor[]) {
      const b = dados.baseline[s];
      const a = dados.atual[s];
      const r = b > 0 ? Math.round(((b - a) / b) * 100) : 0;
      linhas.push(
        [SETOR_INFO[s].label, String(b), String(a), String(dados.resolvidas[s]), String(dados.reabertas[s]), `${r}%`]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendencias-eficiencia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodoLabel = useMemo(() => {
    if (!filtroAtivo || !dataInicio || !dataFim) {
      const inicio = dados?.periodo.snapshotInicialEm
        ? new Date(dados.periodo.snapshotInicialEm).toLocaleDateString("pt-BR")
        : "início da campanha";
      return `Desde ${inicio} até hoje`;
    }
    return `${formatarDataLocal(dataInicio)} → ${formatarDataLocal(dataFim)}`;
  }, [filtroAtivo, dataInicio, dataFim, dados]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Período</span>
          {[
            { value: "campanha", label: "Toda a campanha" },
            { value: "7dias", label: "7 dias" },
            { value: "30dias", label: "30 dias" },
            { value: "este_mes", label: "Este mês" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => aplicarAtalho(opt.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex items-center gap-2 flex-1 w-full">
            <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Setor</label>
                <select
                  value={setor}
                  onChange={(e) => setSetor(e.target.value as Setor | "")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Todos</option>
                  <option value="contratos">Contratos (RERAS)</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="agehab">AGEHAB</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (dataInicio && dataFim) setFiltroAtivo(true);
              }}
              disabled={!dataInicio || !dataFim}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all text-sm font-medium"
            >
              <Filter className="h-4 w-4" />
              Aplicar
            </button>
            {filtroAtivo && (
              <button
                onClick={() => {
                  setFiltroAtivo(false);
                  setDataInicio("");
                  setDataFim("");
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
              >
                <X className="h-4 w-4" />
                Limpar
              </button>
            )}
            <button
              onClick={exportarCsv}
              disabled={!dados}
              className="flex items-center gap-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exportar CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">{periodoLabel}</p>
      </div>

      {/* Loading / Erro */}
      {carregando && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      {erro && !carregando && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </div>
      )}

      {/* Conteúdo */}
      {!carregando && !erro && dados && totais && (
        <>
          {/* KPI destaque: clientes liberados */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white rounded-xl p-5 shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-3 rounded-xl">
                  <KeyRound className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-100">Clientes liberados para recebimento</p>
                  <p className="text-3xl sm:text-4xl font-bold">{dados.clientes.liberados}</p>
                  <p className="text-[11px] text-emerald-100 mt-0.5">desde o início da campanha</p>
                </div>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="text-xs text-emerald-100 mb-1">Inaptos no início</p>
                <p className="text-2xl font-semibold">{dados.clientes.baseline}</p>
                <p className="text-[10px] text-emerald-100">de 367 totais</p>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="text-xs text-emerald-100 mb-1">Ainda pendentes hoje</p>
                <p className="text-2xl font-semibold">{dados.clientes.atual}</p>
                <p className="text-[10px] text-emerald-100">
                  {dados.clientes.baseline > 0
                    ? `${Math.round((dados.clientes.liberados / dados.clientes.baseline) * 100)}% liberados`
                    : "—"}
                </p>
              </div>
            </div>
            {/* Barra de progresso */}
            <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{
                  width: `${
                    dados.clientes.baseline > 0
                      ? Math.min(100, (dados.clientes.liberados / dados.clientes.baseline) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* KPIs principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-blue-100">Resolvidas no período</p>
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <TrendingDown className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{totais.resolvidas}</p>
              <p className="text-[10px] text-blue-100 mt-1">
                pendências{totais.reabertas > 0 && ` · ${totais.reabertas} reabertas`}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-2">Baseline (início)</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totais.baseline}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                pendências · {dados.clientes.baseline} clientes
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-2">Pendências hoje</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totais.atual}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                pendências · {dados.clientes.atual} clientes
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-2">Redução total</p>
              <p
                className={`text-2xl sm:text-3xl font-bold ${
                  totais.reducao > 0 ? "text-emerald-700" : totais.reducao < 0 ? "text-red-700" : "text-gray-900"
                }`}
              >
                {totais.reducao}%
              </p>
              <p className="text-[10px] text-gray-500 mt-1">pendências vs. baseline</p>
            </div>
          </div>

          {/* Cards por setor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["contratos", "financeiro", "agehab"] as Setor[]).map((s) => {
              const info = SETOR_INFO[s];
              const Icon = info.icon;
              const baseline = dados.baseline[s];
              const atual = dados.atual[s];
              const resolvidas = dados.resolvidas[s];
              const reducao = baseline > 0 ? Math.round(((baseline - atual) / baseline) * 100) : 0;
              const progresso = baseline > 0 ? Math.min(100, Math.max(0, ((baseline - atual) / baseline) * 100)) : 0;
              return (
                <div key={s} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${info.cor}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: info.cor }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{info.label}</span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        reducao > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : reducao < 0
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {reducao > 0 ? "-" : reducao < 0 ? "+" : ""}
                      {Math.abs(reducao)}%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-gray-600">
                      <span>Baseline</span>
                      <span className="font-semibold text-gray-900">{baseline}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <span>Hoje</span>
                      <span className="font-semibold text-gray-900">{atual}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Resolvidas no período</span>
                      <span className="font-bold">{resolvidas}</span>
                    </div>
                  </div>

                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progresso}%`,
                        backgroundColor: info.cor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gráfico de evolução */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Evolução {visao === "pendencias" ? "das pendências" : "dos clientes pendentes"}
                </h3>
                <p className="text-xs text-gray-500">
                  {visao === "pendencias"
                    ? "Estoque diário por setor (cada campo true conta como 1)"
                    : "Clientes com pelo menos uma pendência em aberto"}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setVisao("pendencias")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    visao === "pendencias" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Pendências
                  </span>
                </button>
                <button
                  onClick={() => setVisao("clientes")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    visao === "clientes" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    Clientes
                  </span>
                </button>
              </div>
            </div>
            {dados.evolucaoDiaria.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dados.evolucaoDiaria} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="data"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    tickFormatter={formatarData}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                    labelFormatter={formatarData}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  {visao === "pendencias" ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="contratos"
                        name="Contratos (RERAS)"
                        stroke={SETOR_INFO.contratos.cor}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="financeiro"
                        name="Financeiro"
                        stroke={SETOR_INFO.financeiro.cor}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="agehab"
                        name="AGEHAB"
                        stroke={SETOR_INFO.agehab.cor}
                        strokeWidth={2}
                        dot={false}
                      />
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="clientesPendentes"
                      name="Clientes pendentes"
                      stroke="#0f766e"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-xs text-gray-500">Sem dados no período.</div>
            )}
          </div>

          {/* Distribuição de pendências por cliente */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Distribuição de pendências por cliente</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Quantos clientes têm 1, 2, 3 ou 4 pendências — comparativo baseline vs hoje.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={["1", "2", "3", "4"].map((k) => ({
                  qtd: `${k} pendência${k === "1" ? "" : "s"}`,
                  baseline: dados.distribuicao.baseline[k] || 0,
                  atual: dados.distribuicao.atual[k] || 0,
                }))}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="qtd" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="baseline" name="Baseline" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="atual" name="Hoje" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[11px] text-gray-500">
              Cliente com 4 pendências costuma ser o mais difícil de liberar — observe se a barra "Hoje" está
              menor que "Baseline" para confirmar progresso.
            </p>
          </div>

          {/* Top empreendimentos com pendências */}
          {dados.topEmpreendimentos.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Empreendimentos com mais clientes pendentes
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-left py-2 font-medium">Empreendimento</th>
                      <th className="text-right py-2 font-medium">Clientes</th>
                      <th className="text-right py-2 font-medium">Contratos</th>
                      <th className="text-right py-2 font-medium">Financeiro</th>
                      <th className="text-right py-2 font-medium">AGEHAB</th>
                      <th className="text-right py-2 font-medium">Total pend.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.topEmpreendimentos.map((e) => (
                      <tr key={e.nome} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 text-gray-900 truncate max-w-[260px]">{e.nome}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{e.clientes}</td>
                        <td className="py-2 text-right text-gray-700">{e.contratos || "—"}</td>
                        <td className="py-2 text-right text-gray-700">{e.financeiro || "—"}</td>
                        <td className="py-2 text-right text-gray-700">{e.agehab || "—"}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{e.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top resolvedores */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900">Top colaboradores que resolveram pendências</h3>
            </div>
            {dados.topResolvedores.length > 0 ? (
              <div className="space-y-2">
                {dados.topResolvedores.map((r, i) => {
                  const max = dados.topResolvedores[0]?.total || 1;
                  const pct = (r.total / max) * 100;
                  return (
                    <div key={r.nome} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 w-6">#{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-900 truncate">{r.nome}</span>
                          <span className="text-xs font-semibold text-emerald-700">{r.total}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-500">
                Nenhuma pendência foi resolvida no período selecionado ainda.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
