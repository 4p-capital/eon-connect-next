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
}

type PendenciaField =
  | "pendencia_agehab"
  | "pendencia_prosoluto"
  | "pendencia_jurosobra"
  | "pendencia_reras";

type Setor = "agehab" | "financeiro" | "contratos";
type TriState = "nao_verificado" | "ok" | "pendente";
type FiltroKey =
  | "todos"
  | "aguardando_agehab"
  | "aguardando_financeiro"
  | "aguardando_contratos"
  | "com_pendencia";

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

const SETORES_ORDEM: Setor[] = ["agehab", "financeiro", "contratos"];

function computeState(cliente: Cliente, field: PendenciaField): TriState {
  const setor = CAMPO_SETOR[field];
  const verificadoEm = cliente[SETOR_VERIFICADO_FIELD[setor]];
  if (!verificadoEm) return "nao_verificado";
  return cliente[field] ? "pendente" : "ok";
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

  const canByField = useMemo<Record<PendenciaField, boolean>>(
    () => ({
      pendencia_agehab: canBySetor.agehab,
      pendencia_prosoluto: canBySetor.financeiro,
      pendencia_jurosobra: canBySetor.financeiro,
      pendencia_reras: canBySetor.contratos,
    }),
    [canBySetor],
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
            "id, reserva, data_venda, bloco, unidade, cliente, cpf_cnpj, email, telefone, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, pendencia_reras, verificado_agehab_em, verificado_financeiro_em, verificado_contratos_em",
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

  const setPendencia = async (
    cliente: Cliente,
    field: PendenciaField,
    nextValue: boolean,
  ) => {
    if (!canByField[field]) {
      const setor = SETOR_LABEL[CAMPO_SETOR[field]];
      setAlertaAcesso(`Somente o setor ${setor} pode alterar este campo.`);
      setTimeout(() => setAlertaAcesso(null), 2500);
      return;
    }

    const cellKey = `${cliente.id}:${field}`;
    setUpdatingCell(cellKey);

    const setor = CAMPO_SETOR[field];
    const verificadoField = SETOR_VERIFICADO_FIELD[setor];
    const agoraISO = new Date().toISOString();
    const prevVerificadoEm = cliente[verificadoField];
    const prevPendencia = cliente[field];

    setClientes((prev) =>
      prev.map((c) =>
        c.id === cliente.id
          ? { ...c, [field]: nextValue, [verificadoField]: agoraISO }
          : c,
      ),
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
        throw new Error(data.error || "Erro ao atualizar pendência");
      }
    } catch (err) {
      console.error("Erro ao atualizar pendência:", err);
      setClientes((prev) =>
        prev.map((c) =>
          c.id === cliente.id
            ? { ...c, [field]: prevPendencia, [verificadoField]: prevVerificadoEm }
            : c,
        ),
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

    if (filtro === "aguardando_agehab") {
      result = result.filter((c) => !c.verificado_agehab_em);
    } else if (filtro === "aguardando_financeiro") {
      result = result.filter((c) => !c.verificado_financeiro_em);
    } else if (filtro === "aguardando_contratos") {
      result = result.filter((c) => !c.verificado_contratos_em);
    } else if (filtro === "com_pendencia") {
      result = result.filter(
        (c) =>
          c.pendencia_agehab ||
          c.pendencia_prosoluto ||
          c.pendencia_jurosobra ||
          c.pendencia_reras,
      );
    }

    return result;
  }, [clientes, search, filtro]);

  const stats = useMemo(
    () => ({
      total: clientes.length,
      agehabNaoVerif: clientes.filter((c) => !c.verificado_agehab_em).length,
      agehabPendente: clientes.filter((c) => c.pendencia_agehab).length,
      financeiroNaoVerif: clientes.filter((c) => !c.verificado_financeiro_em).length,
      financeiroPendente: clientes.filter(
        (c) => c.pendencia_prosoluto || c.pendencia_jurosobra,
      ).length,
      contratosNaoVerif: clientes.filter((c) => !c.verificado_contratos_em).length,
      contratosPendente: clientes.filter((c) => c.pendencia_reras).length,
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

      {/* Métricas — 3 setores × 2 = 6 cards */}
      {!loading && clientes.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              icon={<HelpCircle className="w-4 h-4 text-slate-500" />}
              label="AGEHAB aguardando"
              value={stats.agehabNaoVerif}
              hint="não verificados"
              tone="neutral"
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              label="AGEHAB com pendência"
              value={stats.agehabPendente}
              tone="warning"
            />
            <MetricCard
              icon={<HelpCircle className="w-4 h-4 text-slate-500" />}
              label="Financeiro aguardando"
              value={stats.financeiroNaoVerif}
              hint="não verificados"
              tone="neutral"
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              label="Financeiro com pendência"
              value={stats.financeiroPendente}
              tone="warning"
            />
            <MetricCard
              icon={<HelpCircle className="w-4 h-4 text-slate-500" />}
              label="Contratos aguardando"
              value={stats.contratosNaoVerif}
              hint="não verificados"
              tone="neutral"
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              label="Contratos com pendência"
              value={stats.contratosPendente}
              tone="warning"
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
              { key: "todos", label: "Todos" },
              { key: "aguardando_agehab", label: "Aguardando AGEHAB" },
              { key: "aguardando_financeiro", label: "Aguardando Financeiro" },
              { key: "aguardando_contratos", label: "Aguardando Contratos" },
              { key: "com_pendencia", label: "Com pendência" },
            ] as { key: FiltroKey; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltro(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                filtro === key
                  ? "bg-black text-white"
                  : "bg-white border border-[var(--border)] text-[var(--muted-foreground)] hover:border-black/30 hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
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
                              canByField={canByField}
                              updatingCell={updatingCell}
                              onSet={setPendencia}
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
                        canByField={canByField}
                        updatingCell={updatingCell}
                        onSet={setPendencia}
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

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  tone: "neutral" | "warning";
}) {
  const valueClass = tone === "warning" ? "text-amber-700" : "text-slate-700";
  const labelClass = tone === "warning" ? "text-amber-700" : "text-slate-700";
  return (
    <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {hint && (
        <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function SetorCell({
  cliente,
  setor,
  canByField,
  updatingCell,
  onSet,
  hideHeader = false,
}: {
  cliente: Cliente;
  setor: Setor;
  canByField: Record<PendenciaField, boolean>;
  updatingCell: string | null;
  onSet: (cliente: Cliente, field: PendenciaField, value: boolean) => void;
  hideHeader?: boolean;
}) {
  const fields = PENDENCIAS_POR_SETOR[setor];
  const verificadoEm = cliente[SETOR_VERIFICADO_FIELD[setor]];

  const verificadoNote = verificadoEm ? (
    <span className="inline-flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" />
      {formatVerificadoEm(verificadoEm)}
    </span>
  ) : (
    "Não verificado"
  );

  return (
    <div className="space-y-1.5 min-w-[200px]">
      {fields.map((field) => {
        const allowed = canByField[field];
        const cellKey = `${cliente.id}:${field}`;
        const state = computeState(cliente, field);
        return (
          <PendenciaItemRow
            key={field}
            label={PENDENCIA_LABELS[field]}
            state={state}
            busy={updatingCell === cellKey}
            locked={!allowed}
            lockedTitle={`Apenas ${SETOR_LABEL[setor]} pode alterar este campo`}
            onSet={(value) => onSet(cliente, field, value)}
          />
        );
      })}
      {!hideHeader && (
        <div className="pt-1.5 mt-1.5 border-t border-[var(--border)]/60">
          <p
            className={`text-[10px] ${
              verificadoEm ? "text-emerald-700" : "text-slate-400 italic"
            }`}
          >
            {verificadoNote}
          </p>
        </div>
      )}
      {hideHeader && (
        <p
          className={`text-[10px] mt-1.5 ${
            verificadoEm ? "text-emerald-700" : "text-slate-400 italic"
          }`}
        >
          {verificadoNote}
        </p>
      )}
    </div>
  );
}

function PendenciaItemRow({
  label,
  state,
  busy,
  locked,
  lockedTitle,
  onSet,
}: {
  label: string;
  state: TriState;
  busy: boolean;
  locked: boolean;
  lockedTitle?: string;
  onSet: (value: boolean) => void;
}) {
  const okActive = state === "ok";
  const pendenteActive = state === "pendente";

  const baseBtn =
    "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all disabled:opacity-50 inline-flex items-center gap-1";

  return (
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
          onClick={() => onSet(false)}
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
          onClick={() => onSet(true)}
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
      </div>
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
