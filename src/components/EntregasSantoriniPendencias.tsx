"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  Loader2,
  Building2,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  HelpCircle,
  FileText,
  Wallet,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useUser } from "@/contexts/UserContext";
import { getSupabaseClient } from "@/utils/supabase/client";
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";

const API_BASE = `${apiBaseUrl}`;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

interface Cliente {
  id: string;
  reserva: number;
  data_venda: string | null;
  bloco: string | null;
  unidade: string | null;
  cliente: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  pendencia_agehab: boolean;
  pendencia_prosoluto: boolean;
  pendencia_jurosobra: boolean;
  pendencia_reras: boolean;
  verificado_agehab_em: string | null;
  verificado_financeiro_em: string | null;
  verificado_contratos_em: string | null;
  em_contato_agehab: boolean;
  em_contato_prosoluto: boolean;
  em_contato_jurosobra: boolean;
  em_contato_reras: boolean;
  em_contato_agehab_desde: string | null;
  em_contato_prosoluto_desde: string | null;
  em_contato_jurosobra_desde: string | null;
  em_contato_reras_desde: string | null;
}

type PendenciaField =
  | "pendencia_agehab"
  | "pendencia_prosoluto"
  | "pendencia_jurosobra"
  | "pendencia_reras";

type EmContatoField =
  | "em_contato_agehab"
  | "em_contato_prosoluto"
  | "em_contato_jurosobra"
  | "em_contato_reras";

type EmContatoDesdeField =
  | "em_contato_agehab_desde"
  | "em_contato_prosoluto_desde"
  | "em_contato_jurosobra_desde"
  | "em_contato_reras_desde";

type ToggleField = PendenciaField | EmContatoField;

type Setor = "agehab" | "financeiro" | "contratos";
type ItemState = "nao_verificado" | "ok" | "pendente" | "em_contato";
type FiltroKey =
  | "todos"
  | "com_pendencia"
  | "em_contato"
  | "pendencia_agehab"
  | "pendencia_financeiro"
  | "pendencia_contratos"
  | "em_contato_agehab"
  | "em_contato_financeiro"
  | "em_contato_contratos"
  | "tudo_ok";

const PENDENCIA_LABELS: Record<PendenciaField, string> = {
  pendencia_agehab: "AGEHAB",
  pendencia_prosoluto: "Pró-Soluto",
  pendencia_jurosobra: "Juros Obra",
  pendencia_reras: "RERAS",
};

const CAMPO_SETOR: Record<PendenciaField, Setor> = {
  pendencia_agehab: "agehab",
  pendencia_prosoluto: "financeiro",
  pendencia_jurosobra: "financeiro",
  pendencia_reras: "contratos",
};

const CAMPO_SETOR_EM_CONTATO: Record<EmContatoField, Setor> = {
  em_contato_agehab: "agehab",
  em_contato_prosoluto: "financeiro",
  em_contato_jurosobra: "financeiro",
  em_contato_reras: "contratos",
};

const SETOR_LABEL: Record<Setor, string> = {
  agehab: "AGEHAB",
  financeiro: "Financeiro",
  contratos: "Contratos",
};

const PENDENCIAS_POR_SETOR: Record<Setor, PendenciaField[]> = {
  agehab: ["pendencia_agehab"],
  financeiro: ["pendencia_prosoluto", "pendencia_jurosobra"],
  contratos: ["pendencia_reras"],
};

const SETOR_VERIFICADO_FIELD: Record<
  Setor,
  "verificado_agehab_em" | "verificado_financeiro_em" | "verificado_contratos_em"
> = {
  agehab: "verificado_agehab_em",
  financeiro: "verificado_financeiro_em",
  contratos: "verificado_contratos_em",
};

// em_contato é par-a-par com pendencia_<x>: cada campo tem seu próprio toggle.
const EM_CONTATO_DE_PENDENCIA: Record<PendenciaField, EmContatoField> = {
  pendencia_agehab: "em_contato_agehab",
  pendencia_prosoluto: "em_contato_prosoluto",
  pendencia_jurosobra: "em_contato_jurosobra",
  pendencia_reras: "em_contato_reras",
};

const EM_CONTATO_DESDE_DE_PENDENCIA: Record<PendenciaField, EmContatoDesdeField> = {
  pendencia_agehab: "em_contato_agehab_desde",
  pendencia_prosoluto: "em_contato_prosoluto_desde",
  pendencia_jurosobra: "em_contato_jurosobra_desde",
  pendencia_reras: "em_contato_reras_desde",
};

const EM_CONTATO_DESDE_FIELD: Record<EmContatoField, EmContatoDesdeField> = {
  em_contato_agehab: "em_contato_agehab_desde",
  em_contato_prosoluto: "em_contato_prosoluto_desde",
  em_contato_jurosobra: "em_contato_jurosobra_desde",
  em_contato_reras: "em_contato_reras_desde",
};

const SETORES_ORDEM: Setor[] = ["agehab", "financeiro", "contratos"];

function computeState(cliente: Cliente, field: PendenciaField): ItemState {
  if (cliente[EM_CONTATO_DE_PENDENCIA[field]]) return "em_contato";
  const setor = CAMPO_SETOR[field];
  const verificadoEm = cliente[SETOR_VERIFICADO_FIELD[setor]];
  if (!verificadoEm) return "nao_verificado";
  return cliente[field] ? "pendente" : "ok";
}

function setorPendente(cliente: Cliente, setor: Setor): boolean {
  // "Pendente" no contexto do filtro = pelo menos um campo pendente E não em_contato.
  return PENDENCIAS_POR_SETOR[setor].some(
    (f) => cliente[f] && !cliente[EM_CONTATO_DE_PENDENCIA[f]],
  );
}

function setorEmContato(cliente: Cliente, setor: Setor): boolean {
  return PENDENCIAS_POR_SETOR[setor].some(
    (f) => cliente[EM_CONTATO_DE_PENDENCIA[f]],
  );
}

function formatVerificadoEm(iso: string | null): string {
  if (!iso) return "Não verificado";
  const d = new Date(iso);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `Verificado em ${formatted}`;
}

function formatEmContatoDesde(iso: string | null): string {
  if (!iso) return "Em contato";
  const inicio = new Date(iso);
  const dias = Math.max(
    0,
    Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const dataFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(inicio);
  if (dias === 0) return `Em contato desde hoje (${dataFmt})`;
  if (dias === 1) return `Em contato há 1 dia (desde ${dataFmt})`;
  return `Em contato há ${dias} dias (desde ${dataFmt})`;
}

const SETOR_BG: Record<Setor, string> = {
  agehab: "bg-violet-50/50",
  financeiro: "bg-amber-50/30",
  contratos: "bg-slate-50/50",
};

const SETOR_BG_MOBILE: Record<Setor, string> = {
  agehab: "bg-violet-50/70",
  financeiro: "bg-amber-50/40",
  contratos: "bg-slate-50/70",
};

const SETOR_ICON_TONE: Record<Setor, string> = {
  agehab: "text-violet-700",
  financeiro: "text-amber-700",
  contratos: "text-slate-700",
};

function SetorIcon({ setor, className }: { setor: Setor; className?: string }) {
  const cls = className ?? "w-3.5 h-3.5";
  if (setor === "agehab") return <ShieldCheck className={cls} />;
  if (setor === "financeiro") return <Wallet className={cls} />;
  return <FileText className={cls} />;
}

export function EntregasSantoriniPendencias() {
  const { hasPermission, loading: permissionLoading } = usePermissionGuard(
    "entregas.santorini.pendencias",
  );
  const { hasPermission: hasPerm } = useUser();

  const canBySetor = useMemo<Record<Setor, boolean>>(
    () => ({
      agehab: hasPerm("entregas.santorini.pendencias.agehab"),
      financeiro: hasPerm("entregas.santorini.pendencias.financeiro"),
      contratos: hasPerm("entregas.santorini.pendencias.contratos"),
    }),
    [hasPerm],
  );

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<FiltroKey>("todos");
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);
  const [alertaAcesso, setAlertaAcesso] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission) return;
    const fetchClientes = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        const { data, error } = await (supabase
          .from("clientes_entrega_santorini") as ReturnType<typeof supabase.from>)
          .select(
            "id, reserva, data_venda, bloco, unidade, cliente, cpf_cnpj, email, telefone, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, pendencia_reras, verificado_agehab_em, verificado_financeiro_em, verificado_contratos_em, em_contato_agehab, em_contato_prosoluto, em_contato_jurosobra, em_contato_reras, em_contato_agehab_desde, em_contato_prosoluto_desde, em_contato_jurosobra_desde, em_contato_reras_desde",
          )
          .order("bloco", { ascending: true })
          .order("unidade", { ascending: true });
        if (error) throw error;
        setClientes((data ?? []) as Cliente[]);
      } catch (err) {
        console.error("Erro ao buscar clientes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [hasPermission]);

  const setStatus = async (
    cliente: Cliente,
    field: ToggleField,
    nextValue: boolean,
  ) => {
    const setor = CAMPO_SETOR[
      field as PendenciaField
    ] ?? CAMPO_SETOR_EM_CONTATO[field as EmContatoField];

    if (!canBySetor[setor]) {
      setAlertaAcesso(`Somente o setor ${SETOR_LABEL[setor]} pode alterar este campo.`);
      setTimeout(() => setAlertaAcesso(null), 2500);
      return;
    }

    const cellKey = `${cliente.id}:${field}`;
    setUpdatingCell(cellKey);

    const ehEmContato =
      field === "em_contato_agehab" ||
      field === "em_contato_prosoluto" ||
      field === "em_contato_jurosobra" ||
      field === "em_contato_reras";

    const verificadoField = SETOR_VERIFICADO_FIELD[setor];
    const emContatoField = ehEmContato
      ? (field as EmContatoField)
      : EM_CONTATO_DE_PENDENCIA[field as PendenciaField];
    const emContatoDesdeField = ehEmContato
      ? EM_CONTATO_DESDE_FIELD[field as EmContatoField]
      : EM_CONTATO_DESDE_DE_PENDENCIA[field as PendenciaField];
    const agoraISO = new Date().toISOString();

    const prevSnapshot = {
      pendencia_agehab: cliente.pendencia_agehab,
      pendencia_prosoluto: cliente.pendencia_prosoluto,
      pendencia_jurosobra: cliente.pendencia_jurosobra,
      pendencia_reras: cliente.pendencia_reras,
      verificado_agehab_em: cliente.verificado_agehab_em,
      verificado_financeiro_em: cliente.verificado_financeiro_em,
      verificado_contratos_em: cliente.verificado_contratos_em,
      em_contato_agehab: cliente.em_contato_agehab,
      em_contato_prosoluto: cliente.em_contato_prosoluto,
      em_contato_jurosobra: cliente.em_contato_jurosobra,
      em_contato_reras: cliente.em_contato_reras,
      em_contato_agehab_desde: cliente.em_contato_agehab_desde,
      em_contato_prosoluto_desde: cliente.em_contato_prosoluto_desde,
      em_contato_jurosobra_desde: cliente.em_contato_jurosobra_desde,
      em_contato_reras_desde: cliente.em_contato_reras_desde,
    };

    setClientes((prev) =>
      prev.map((c) => {
        if (c.id !== cliente.id) return c;
        if (ehEmContato) {
          return {
            ...c,
            [field]: nextValue,
            [emContatoDesdeField]: nextValue ? agoraISO : null,
          };
        }
        const next: Cliente = {
          ...c,
          [field]: nextValue,
          [verificadoField]: agoraISO,
        };
        if (c[emContatoField]) {
          next[emContatoField] = false;
          next[emContatoDesdeField] = null;
        }
        return next;
      }),
    );

    try {
      const supabase = getSupabaseClient();
      const { data: session } = await supabase.auth.getUser();
      const authUserId = session?.user?.id;

      if (!authUserId) throw new Error("Sessão inválida — faça login novamente");

      const resp = await fetch(`${API_BASE}/entregas/pendencias/toggle`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente.id,
          campo: field,
          valor: nextValue,
          auth_user_id: authUserId,
        }),
      });
      const data = await resp.json();

      if (!data.ok) {
        throw new Error(data.error || "Erro ao atualizar status");
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      setClientes((prev) =>
        prev.map((c) => (c.id === cliente.id ? { ...c, ...prevSnapshot } : c)),
      );
      setAlertaAcesso(err instanceof Error ? err.message : "Erro ao atualizar");
      setTimeout(() => setAlertaAcesso(null), 3000);
    } finally {
      setUpdatingCell(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = clientes;

    if (term) {
      result = result.filter((c) =>
        [c.cliente, c.cpf_cnpj, c.email, c.bloco, c.unidade, String(c.reserva)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }

    // "Pendência" no filtro = pelo menos um campo do setor pendente E não em_contato.
    if (filtro === "com_pendencia") {
      result = result.filter(
        (c) =>
          setorPendente(c, "agehab") ||
          setorPendente(c, "financeiro") ||
          setorPendente(c, "contratos"),
      );
    } else if (filtro === "em_contato") {
      result = result.filter(
        (c) =>
          c.em_contato_agehab ||
          c.em_contato_prosoluto ||
          c.em_contato_jurosobra ||
          c.em_contato_reras,
      );
    } else if (filtro === "pendencia_agehab") {
      result = result.filter((c) => setorPendente(c, "agehab"));
    } else if (filtro === "pendencia_financeiro") {
      result = result.filter((c) => setorPendente(c, "financeiro"));
    } else if (filtro === "pendencia_contratos") {
      result = result.filter((c) => setorPendente(c, "contratos"));
    } else if (filtro === "em_contato_agehab") {
      result = result.filter((c) => setorEmContato(c, "agehab"));
    } else if (filtro === "em_contato_financeiro") {
      result = result.filter((c) => setorEmContato(c, "financeiro"));
    } else if (filtro === "em_contato_contratos") {
      result = result.filter((c) => setorEmContato(c, "contratos"));
    } else if (filtro === "tudo_ok") {
      result = result.filter(
        (c) =>
          !c.pendencia_agehab &&
          !c.pendencia_prosoluto &&
          !c.pendencia_jurosobra &&
          !c.pendencia_reras &&
          !c.em_contato_agehab &&
          !c.em_contato_prosoluto &&
          !c.em_contato_jurosobra &&
          !c.em_contato_reras,
      );
    }

    return result;
  }, [clientes, search, filtro]);

  const stats = useMemo(
    () => ({
      total: clientes.length,
      agehabNaoVerif: clientes.filter((c) => !c.verificado_agehab_em).length,
      agehabPendente: clientes.filter((c) => setorPendente(c, "agehab")).length,
      agehabEmContato: clientes.filter((c) => setorEmContato(c, "agehab")).length,
      financeiroNaoVerif: clientes.filter((c) => !c.verificado_financeiro_em).length,
      financeiroPendente: clientes.filter((c) => setorPendente(c, "financeiro")).length,
      financeiroEmContato: clientes.filter((c) => setorEmContato(c, "financeiro")).length,
      contratosNaoVerif: clientes.filter((c) => !c.verificado_contratos_em).length,
      contratosPendente: clientes.filter((c) => setorPendente(c, "contratos")).length,
      contratosEmContato: clientes.filter((c) => setorEmContato(c, "contratos")).length,
    }),
    [clientes],
  );

  if (permissionLoading || !hasPermission) {
    return (
      <div className="min-h-screen bg-[var(--background-alt)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const total = clientes.length;
  const somenteLeitura =
    !canBySetor.agehab && !canBySetor.financeiro && !canBySetor.contratos;

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Pendências — Gran Santorini
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {loading
                  ? "Carregando..."
                  : `${total} cliente${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {!loading && (
            <EscopoAviso canBySetor={canBySetor} somenteLeitura={somenteLeitura} />
          )}
        </div>
      </div>

      {/* Toast de permissão negada */}
      {alertaAcesso && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%]">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3 rounded-xl shadow-lg flex items-start gap-2">
            <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{alertaAcesso}</p>
          </div>
        </div>
      )}

      {/* Métricas — 1 card por setor com 3 contadores inline (aguardando / pendente / em contato) */}
      {!loading && clientes.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SetorMetricCard
              setor="agehab"
              naoVerificado={stats.agehabNaoVerif}
              pendente={stats.agehabPendente}
              emContato={stats.agehabEmContato}
            />
            <SetorMetricCard
              setor="financeiro"
              naoVerificado={stats.financeiroNaoVerif}
              pendente={stats.financeiroPendente}
              emContato={stats.financeiroEmContato}
            />
            <SetorMetricCard
              setor="contratos"
              naoVerificado={stats.contratosNaoVerif}
              pendente={stats.contratosPendente}
              emContato={stats.contratosEmContato}
            />
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, email, bloco, unidade ou reserva..."
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

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(
            [
              { key: "todos", label: "Todos", tone: "default" },
              { key: "com_pendencia", label: "Com pendência", tone: "pendente" },
              { key: "em_contato", label: "Em contato", tone: "em_contato" },
              { key: "tudo_ok", label: "Tudo OK", tone: "ok" },
              { key: "pendencia_agehab", label: "Pendência AGEHAB", tone: "pendente" },
              { key: "em_contato_agehab", label: "Em contato AGEHAB", tone: "em_contato" },
              { key: "pendencia_financeiro", label: "Pendência Financeiro", tone: "pendente" },
              { key: "em_contato_financeiro", label: "Em contato Financeiro", tone: "em_contato" },
              { key: "pendencia_contratos", label: "Pendência Contratos", tone: "pendente" },
              { key: "em_contato_contratos", label: "Em contato Contratos", tone: "em_contato" },
            ] as { key: FiltroKey; label: string; tone: "default" | "ok" | "pendente" | "em_contato" }[]
          ).map(({ key, label, tone }) => {
            const ativo = filtro === key;
            const activeBg =
              tone === "em_contato"
                ? "bg-amber-500 text-white"
                : tone === "pendente"
                  ? "bg-orange-500 text-white"
                  : tone === "ok"
                    ? "bg-emerald-500 text-white"
                    : "bg-black text-white";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFiltro(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  ativo
                    ? activeBg
                    : "bg-white border border-[var(--border)] text-[var(--muted-foreground)] hover:border-black/30 hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Carregando clientes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ClipboardList className="w-12 h-12 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {search || filtro !== "todos"
                ? "Nenhum cliente encontrado com os filtros aplicados"
                : "Nenhum cliente cadastrado"}
            </p>
            {(search || filtro !== "todos") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFiltro("todos");
                }}
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--background-alt)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider whitespace-nowrap">
                        Reserva
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider whitespace-nowrap">
                        Unidade
                      </th>
                      {SETORES_ORDEM.map((setor) => (
                        <th
                          key={setor}
                          className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider"
                        >
                          <div className={`flex items-center gap-1.5 ${SETOR_ICON_TONE[setor]}`}>
                            <SetorIcon setor={setor} />
                            <span>{SETOR_LABEL[setor]}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-[var(--background-alt)]/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-[var(--foreground)] align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>#{c.reserva}</span>
                            {c.reserva >= 999000 && <TesteBadge />}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {c.cliente || "—"}
                          </p>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            {c.cpf_cnpj || ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--foreground)]">{c.bloco || "—"}</p>
                              <p className="text-[11px] text-[var(--muted-foreground)]">
                                {c.unidade || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        {SETORES_ORDEM.map((setor) => (
                          <td key={setor} className={`px-4 py-3 align-top ${SETOR_BG[setor]}`}>
                            <SetorCell
                              cliente={c}
                              setor={setor}
                              allowed={canBySetor[setor]}
                              updatingCell={updatingCell}
                              onSet={setStatus}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-[var(--border)] overflow-hidden"
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {c.cliente || "—"}
                          </p>
                          {c.reserva >= 999000 && <TesteBadge />}
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          #{c.reserva} • {c.cpf_cnpj || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <Building2 className="w-3.5 h-3.5" />
                      {c.bloco || "—"} • {c.unidade || "—"}
                    </div>
                    {(c.email || c.telefone) && (
                      <div className="text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                        {c.email && <p className="truncate">{c.email}</p>}
                        {c.telefone && <p>{c.telefone}</p>}
                      </div>
                    )}
                  </div>

                  {SETORES_ORDEM.map((setor) => (
                    <div
                      key={setor}
                      className={`${SETOR_BG_MOBILE[setor]} p-4 border-t border-[var(--border)]`}
                    >
                      <div className={`flex items-center gap-1.5 mb-2 ${SETOR_ICON_TONE[setor]}`}>
                        <SetorIcon setor={setor} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">
                          {SETOR_LABEL[setor]}
                        </span>
                      </div>
                      <SetorCell
                        cliente={c}
                        setor={setor}
                        allowed={canBySetor[setor]}
                        updatingCell={updatingCell}
                        onSet={setStatus}
                        hideHeader
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-4 text-[11px] text-[var(--muted-foreground)] text-right">
              Exibindo {filtered.length} de {total} clientes
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SetorMetricCard({
  setor,
  naoVerificado,
  pendente,
  emContato,
}: {
  setor: Setor;
  naoVerificado: number;
  pendente: number;
  emContato: number;
}) {
  return (
    <div className="px-3 py-2 rounded-lg border bg-white border-[var(--border)]">
      <div className={`flex items-center gap-1.5 mb-1.5 ${SETOR_ICON_TONE[setor]}`}>
        <SetorIcon setor={setor} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {SETOR_LABEL[setor]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <MiniStat
          icon={<HelpCircle className="w-3 h-3 text-slate-500" />}
          value={naoVerificado}
          label="aguard."
          tone="text-slate-700"
          title="Aguardando verificação"
        />
        <span className="h-6 w-px bg-[var(--border)]" />
        <MiniStat
          icon={<AlertTriangle className="w-3 h-3 text-orange-600" />}
          value={pendente}
          label="pend."
          tone="text-orange-700"
          title="Com pendência (recebe notificação)"
        />
        <span className="h-6 w-px bg-[var(--border)]" />
        <MiniStat
          icon={<MessageCircle className="w-3 h-3 text-amber-600" />}
          value={emContato}
          label="contato"
          tone="text-amber-700"
          title="Em contato — notificação suspensa"
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
  tone,
  title,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: string;
  title: string;
}) {
  return (
    <div className="flex-1 min-w-0" title={title}>
      <div className="flex items-center gap-1">
        {icon}
        <span className={`text-base font-bold leading-none ${tone}`}>{value}</span>
      </div>
      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 truncate">
        {label}
      </p>
    </div>
  );
}

function SetorCell({
  cliente,
  setor,
  allowed,
  updatingCell,
  onSet,
  hideHeader = false,
}: {
  cliente: Cliente;
  setor: Setor;
  allowed: boolean;
  updatingCell: string | null;
  onSet: (cliente: Cliente, field: ToggleField, value: boolean) => void;
  hideHeader?: boolean;
}) {
  const fields = PENDENCIAS_POR_SETOR[setor];
  const verificadoEm = cliente[SETOR_VERIFICADO_FIELD[setor]];

  const rodape = verificadoEm ? (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <CheckCircle2 className="w-3 h-3" />
      {formatVerificadoEm(verificadoEm)}
    </span>
  ) : (
    <span className="text-slate-400 italic">Não verificado</span>
  );

  return (
    <div className="space-y-1.5 min-w-[260px]">
      {fields.map((field) => {
        const emContatoField = EM_CONTATO_DE_PENDENCIA[field];
        const emContatoDesdeField = EM_CONTATO_DESDE_DE_PENDENCIA[field];
        const cellKey = `${cliente.id}:${field}`;
        const emContatoCellKey = `${cliente.id}:${emContatoField}`;
        const state = computeState(cliente, field);
        return (
          <PendenciaItemRow
            key={field}
            label={PENDENCIA_LABELS[field]}
            state={state}
            emContatoDesde={cliente[emContatoDesdeField]}
            busy={updatingCell === cellKey || updatingCell === emContatoCellKey}
            locked={!allowed}
            lockedTitle={`Apenas ${SETOR_LABEL[setor]} pode alterar este campo`}
            onSetPendencia={(value) => onSet(cliente, field, value)}
            onSetEmContato={(value) => onSet(cliente, emContatoField, value)}
          />
        );
      })}
      <div
        className={
          hideHeader
            ? "mt-1.5 text-[10px]"
            : "pt-1.5 mt-1.5 border-t border-[var(--border)]/60 text-[10px]"
        }
      >
        {rodape}
      </div>
    </div>
  );
}

function PendenciaItemRow({
  label,
  state,
  emContatoDesde,
  busy,
  locked,
  lockedTitle,
  onSetPendencia,
  onSetEmContato,
}: {
  label: string;
  state: ItemState;
  emContatoDesde: string | null;
  busy: boolean;
  locked: boolean;
  lockedTitle?: string;
  onSetPendencia: (value: boolean) => void;
  onSetEmContato: (value: boolean) => void;
}) {
  const okActive = state === "ok";
  const pendenteActive = state === "pendente";
  const emContatoActive = state === "em_contato";

  const baseBtn =
    "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all disabled:opacity-50 inline-flex items-center gap-1";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs ${
            state === "nao_verificado"
              ? "text-slate-500"
              : "text-[var(--foreground)] font-medium"
          }`}
        >
          {label}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => onSetPendencia(false)}
            title={locked ? lockedTitle : "Verificado: sem pendência"}
            aria-pressed={okActive}
            className={`${baseBtn} ${
              locked
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : okActive
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            OK
          </button>
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => onSetPendencia(true)}
            title={locked ? lockedTitle : "Verificado: com pendência"}
            aria-pressed={pendenteActive}
            className={`${baseBtn} ${
              locked
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : pendenteActive
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-orange-400 hover:text-orange-600"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Pend.
          </button>
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => onSetEmContato(!emContatoActive)}
            title={
              locked
                ? lockedTitle
                : emContatoActive
                  ? "Em contato — clique para encerrar"
                  : "Em contato com o cliente (suspende notificação automática)"
            }
            aria-pressed={emContatoActive}
            className={`${baseBtn} ${
              locked
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : emContatoActive
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600"
            }`}
          >
            <MessageCircle className="w-3 h-3" />
            Em contato
          </button>
        </div>
      </div>
      {emContatoActive && (
        <p className="text-[10px] text-amber-700 inline-flex items-center gap-1 pl-1">
          <MessageCircle className="w-2.5 h-2.5" />
          {formatEmContatoDesde(emContatoDesde)}
        </p>
      )}
    </div>
  );
}

function EscopoAviso({
  canBySetor,
  somenteLeitura,
}: {
  canBySetor: Record<Setor, boolean>;
  somenteLeitura: boolean;
}) {
  if (somenteLeitura) {
    return (
      <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <Lock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-700">
          Você só consegue visualizar esta tela. Para editar pendências, solicite
          permissão de algum dos setores: AGEHAB, Financeiro ou Contratos.
        </p>
      </div>
    );
  }

  const setores: string[] = [];
  if (canBySetor.agehab) setores.push("AGEHAB");
  if (canBySetor.financeiro) setores.push("Financeiro (Pró-Soluto + Juros Obra)");
  if (canBySetor.contratos) setores.push("Contratos (RERAS + Rescisão)");

  if (setores.length === 3) return null;

  return (
    <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
      <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-800">
        Você pode editar apenas:{" "}
        <span className="font-semibold">{setores.join(", ")}</span>. Os demais
        campos ficam travados.
      </p>
    </div>
  );
}

function TesteBadge() {
  return (
    <span
      title="Cliente de teste (reserva >= 999000)"
      className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 rounded"
    >
      Teste
    </span>
  );
}
