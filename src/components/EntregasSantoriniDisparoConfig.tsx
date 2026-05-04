"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Send,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  Clock,
  Save,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  FileText,
  ChevronDown,
  ChevronUp,
  Settings,
} from "lucide-react";
import { getSupabaseClient } from "@/utils/supabase/client";
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";

type Setor = "agehab" | "financeiro" | "contratos";

interface ConfigDisparo {
  pausado_global: boolean;
  pausado_agehab: boolean;
  pausado_financeiro: boolean;
  pausado_contratos: boolean;
  cota_agehab_dia: number;
  cota_financeiro_dia: number;
  cota_contratos_dia: number;
  cadencia_dias: number;
  slots_por_dia: number;
  updated_at: string;
  updated_by: string | null;
}

interface DisparosHoje {
  agehab: { total: number; success: number; failed: number };
  financeiro: { total: number; success: number; failed: number };
  contratos: { total: number; success: number; failed: number };
}

const SETOR_INFO: Record<
  Setor,
  { label: string; cor: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; cotaField: keyof ConfigDisparo; pausaField: keyof ConfigDisparo }
> = {
  contratos: {
    label: "Contratos (RERAS)",
    cor: "#475569",
    icon: FileText,
    cotaField: "cota_contratos_dia",
    pausaField: "pausado_contratos",
  },
  financeiro: {
    label: "Financeiro",
    cor: "#f59e0b",
    icon: Wallet,
    cotaField: "cota_financeiro_dia",
    pausaField: "pausado_financeiro",
  },
  agehab: {
    label: "AGEHAB",
    cor: "#7c3aed",
    icon: ShieldCheck,
    cotaField: "cota_agehab_dia",
    pausaField: "pausado_agehab",
  },
};

export function EntregasSantoriniDisparoConfig() {
  const [cfg, setCfg] = useState<ConfigDisparo | null>(null);
  const [disparosHoje, setDisparosHoje] = useState<DisparosHoje | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`${apiBaseUrl}/entregas/pendencias/disparo-config`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCfg(json.cfg as ConfigDisparo);
      setDisparosHoje(json.disparosHoje as DisparosHoje);
      setDirty(false);
    } catch (e: unknown) {
      console.error(e);
      setErro("Erro ao carregar configuração de disparos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const updateField = <K extends keyof ConfigDisparo>(field: K, value: ConfigDisparo[K]) => {
    if (!cfg) return;
    setCfg({ ...cfg, [field]: value });
    setDirty(true);
    setFeedback(null);
  };

  const salvar = async (override?: Partial<ConfigDisparo>) => {
    if (!cfg) return;
    setSalvando(true);
    setErro(null);
    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getUser();
      const authUserId = session?.user?.id;
      if (!authUserId) throw new Error("Sessão inválida — faça login novamente");

      const payload = {
        auth_user_id: authUserId,
        pausado_global: cfg.pausado_global,
        pausado_agehab: cfg.pausado_agehab,
        pausado_financeiro: cfg.pausado_financeiro,
        pausado_contratos: cfg.pausado_contratos,
        cota_agehab_dia: cfg.cota_agehab_dia,
        cota_financeiro_dia: cfg.cota_financeiro_dia,
        cota_contratos_dia: cfg.cota_contratos_dia,
        cadencia_dias: cfg.cadencia_dias,
        slots_por_dia: cfg.slots_por_dia,
        ...(override || {}),
      };

      const res = await fetch(`${apiBaseUrl}/entregas/pendencias/disparo-config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erro ao salvar");
      setCfg(json.cfg as ConfigDisparo);
      setDirty(false);
      setFeedback("Configuração salva.");
      setTimeout(() => setFeedback(null), 2500);
    } catch (e: unknown) {
      console.error(e);
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const togglePausaGlobal = () => {
    if (!cfg) return;
    const next = !cfg.pausado_global;
    setCfg({ ...cfg, pausado_global: next });
    setDirty(true);
    salvar({ pausado_global: next });
  };

  const togglePausaSetor = (setor: Setor) => {
    if (!cfg) return;
    const field = SETOR_INFO[setor].pausaField as keyof ConfigDisparo;
    const next = !cfg[field];
    setCfg({ ...cfg, [field]: next as never } as ConfigDisparo);
    setDirty(true);
    salvar({ [field]: next } as Partial<ConfigDisparo>);
  };

  // Header de loading mantém o componente com altura mínima e silencia o estado.
  if (carregando) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando configuração de disparos…
      </div>
    );
  }

  // Sem config: mostra um header discreto com botão de retry, sem ocupar a tela inteira.
  if (!cfg) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          {erro || "Configuração de disparos indisponível."}
        </div>
        <button
          onClick={carregar}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const cotaTotalDia = cfg.cota_agehab_dia + cfg.cota_financeiro_dia + cfg.cota_contratos_dia;
  const totalDisparosHoje =
    (disparosHoje?.agehab.total ?? 0) +
    (disparosHoje?.financeiro.total ?? 0) +
    (disparosHoje?.contratos.total ?? 0);

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        cfg.pausado_global ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
      }`}
    >
      {/* Header clicável (sempre visível) */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50/60 transition-colors"
        aria-expanded={expandido}
      >
        <div className="flex items-center gap-3 text-left">
          <div className={`p-2 rounded-lg ${cfg.pausado_global ? "bg-red-100" : "bg-blue-100"}`}>
            <Settings className={`h-5 w-5 ${cfg.pausado_global ? "text-red-600" : "text-blue-600"}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              Configuração da campanha
              {cfg.pausado_global && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded uppercase tracking-wide">
                  Pausada
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">
              {cfg.pausado_global ? (
                <span className="text-red-700">Disparos automáticos pausados globalmente</span>
              ) : (
                <>
                  {cotaTotalDia} disparos/dia · {cfg.slots_por_dia} slots · cadência {cfg.cadencia_dias} dias · hoje:{" "}
                  <span className="font-semibold text-gray-700">{totalDisparosHoje}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {expandido ? "Recolher" : "Expandir"}
          {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Conteúdo expansível */}
      {expandido && (
        <div className="border-t border-gray-200 p-4 space-y-3 bg-white">
          {/* Linha de pausa global */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">Disparos automáticos</span>
            </div>
            <button
              onClick={togglePausaGlobal}
              disabled={salvando}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                cfg.pausado_global
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : cfg.pausado_global ? (
                <PlayCircle className="h-3.5 w-3.5" />
              ) : (
                <PauseCircle className="h-3.5 w-3.5" />
              )}
              {cfg.pausado_global ? "Retomar disparos" : "Pausar tudo"}
            </button>
          </div>
          {feedback && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {feedback}
            </div>
          )}
          {erro && (
            <div className="flex items-center gap-1.5 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {erro}
            </div>
          )}

          {/* Cards por setor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["contratos", "financeiro", "agehab"] as Setor[]).map((s) => {
          const info = SETOR_INFO[s];
          const Icon = info.icon;
          const pausado = cfg[info.pausaField] as boolean;
          const cota = cfg[info.cotaField] as number;
          const usado = disparosHoje?.[s]?.total ?? 0;
          const sucesso = disparosHoje?.[s]?.success ?? 0;

          return (
            <div
              key={s}
              className={`rounded-xl border p-4 transition-all ${
                pausado ? "bg-gray-50 border-gray-200 opacity-75" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${info.cor}20` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: info.cor }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{info.label}</p>
                    <p className="text-[10px] text-gray-500">
                      {pausado ? <span className="text-red-700 font-semibold">Pausado</span> : "Ativo"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => togglePausaSetor(s)}
                  disabled={salvando}
                  className={`p-1.5 rounded-md transition-all disabled:opacity-50 ${
                    pausado ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                  title={pausado ? "Retomar setor" : "Pausar setor"}
                >
                  {pausado ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    Cota por dia
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={cota}
                    onChange={(e) =>
                      updateField(info.cotaField, Math.max(0, parseInt(e.target.value) || 0) as never)
                    }
                    disabled={pausado || salvando}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="text-[11px] text-gray-600 flex items-center justify-between pt-1">
                  <span>Hoje:</span>
                  <span className="font-semibold text-gray-900">
                    {usado} disparos
                    {usado > 0 && sucesso < usado && (
                      <span className="text-red-600 ml-1">({usado - sucesso} falhas)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configurações globais */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Cadência e slots</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Cadência (dias entre disparos pro mesmo cliente)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={cfg.cadencia_dias}
              onChange={(e) =>
                updateField("cadencia_dias", Math.max(1, parseInt(e.target.value) || 1) as never)
              }
              disabled={salvando}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Slots por dia (10h, 12h, 14h SP)
            </label>
            <input
              type="number"
              min={1}
              max={6}
              value={cfg.slots_por_dia}
              onChange={(e) =>
                updateField("slots_por_dia", Math.max(1, parseInt(e.target.value) || 1) as never)
              }
              disabled={salvando}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] text-gray-500">
                Última atualização: {new Date(cfg.updated_at).toLocaleString("pt-BR")}
                {cfg.updated_by && ` por ${cfg.updated_by}`}
              </p>
              {dirty && (
                <button
                  onClick={() => salvar()}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alterações
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
