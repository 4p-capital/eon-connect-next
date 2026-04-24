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
  verificado_agehab_em: string | null;
  verificado_financeiro_em: string | null;
}

type PendenciaField = "pendencia_agehab" | "pendencia_prosoluto" | "pendencia_jurosobra";
type Setor = "contratos" | "financeiro";
type TriState = "nao_verificado" | "ok" | "pendente";

function computeState(cliente: Cliente, field: PendenciaField): TriState {
  const verificadoEm =
    field === "pendencia_agehab"
      ? cliente.verificado_agehab_em
      : cliente.verificado_financeiro_em;
  if (!verificadoEm) return "nao_verificado";
  return cliente[field] ? "pendente" : "ok";
}

const PENDENCIA_LABELS: Record<PendenciaField, string> = {
  pendencia_agehab: "AGEHAB?",
  pendencia_prosoluto: "PRÓ-SOLUTO?",
  pendencia_jurosobra: "Juros Obra?",
};

const CAMPO_SETOR: Record<PendenciaField, Setor> = {
  pendencia_agehab: "contratos",
  pendencia_prosoluto: "financeiro",
  pendencia_jurosobra: "financeiro",
};

const SETOR_LABEL: Record<Setor, string> = {
  contratos: "Contratos",
  financeiro: "Financeiro",
};

export function EntregasSantoriniPendencias() {
  const { hasPermission, loading: permissionLoading } = usePermissionGuard(
    "entregas.santorini.pendencias",
  );
  const { hasPermission: hasPerm } = useUser();

  const canByField = useMemo<Record<PendenciaField, boolean>>(
    () => ({
      pendencia_agehab: hasPerm("entregas.santorini.pendencias.contratos"),
      pendencia_prosoluto: hasPerm("entregas.santorini.pendencias.financeiro"),
      pendencia_jurosobra: hasPerm("entregas.santorini.pendencias.financeiro"),
    }),
    [hasPerm],
  );

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
            "id, reserva, data_venda, bloco, unidade, cliente, cpf_cnpj, email, telefone, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra, verificado_agehab_em, verificado_financeiro_em",
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

    const verificadoField =
      field === "pendencia_agehab"
        ? "verificado_agehab_em"
        : "verificado_financeiro_em";
    const agoraISO = new Date().toISOString();
    const prevVerificadoEm = cliente[verificadoField];
    const prevPendencia = cliente[field];

    // Otimista: carimba tanto a pendência quanto o verificado_em do setor
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
      // Rollback
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
    if (!term) return clientes;
    return clientes.filter((c) =>
      [c.cliente, c.cpf_cnpj, c.email, c.bloco, c.unidade, String(c.reserva)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [clientes, search]);

  const stats = useMemo(
    () => ({
      total: clientes.length,
      agehabNaoVerif: clientes.filter((c) => !c.verificado_agehab_em).length,
      agehabPendente: clientes.filter((c) => c.pendencia_agehab).length,
      financeiroNaoVerif: clientes.filter((c) => !c.verificado_financeiro_em).length,
      financeiroPendente: clientes.filter(
        (c) => c.pendencia_prosoluto || c.pendencia_jurosobra,
      ).length,
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
    !canByField.pendencia_agehab &&
    !canByField.pendencia_prosoluto &&
    !canByField.pendencia_jurosobra;

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

          {/* Aviso sobre escopo de edição */}
          {!loading && (
            <EscopoAviso canByField={canByField} somenteLeitura={somenteLeitura} />
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

      {/* Métricas */}
      {!loading && clientes.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">AGEHAB aguardando</span>
              </div>
              <p className="text-xl font-bold text-slate-700">{stats.agehabNaoVerif}</p>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">não verificados</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">AGEHAB com pendência</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{stats.agehabPendente}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Financeiro aguardando</span>
              </div>
              <p className="text-xl font-bold text-slate-700">{stats.financeiroNaoVerif}</p>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">não verificados</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Financeiro com pendência</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{stats.financeiroPendente}</p>
            </div>
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
              {search ? "Nenhum cliente encontrado com os filtros aplicados" : "Nenhum cliente cadastrado"}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-sm text-black underline hover:no-underline"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full">
                <thead className="bg-[var(--background-alt)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Reserva
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Unidade
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Contato
                    </th>
                    {(Object.keys(PENDENCIA_LABELS) as PendenciaField[]).map((field) => (
                      <th
                        key={field}
                        className="px-4 py-3 text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{PENDENCIA_LABELS[field]}</span>
                          <span className="text-[9px] font-normal text-[var(--muted-foreground)] normal-case tracking-normal">
                            {SETOR_LABEL[CAMPO_SETOR[field]]}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--background-alt)] transition-colors">
                      <td className="px-4 py-3 text-sm text-[var(--foreground)]">#{c.reserva}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {c.cliente || "—"}
                          </p>
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            {c.cpf_cnpj || ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs text-[var(--foreground)] truncate max-w-[180px]">
                            {c.email || "—"}
                          </p>
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            {c.telefone || "—"}
                          </p>
                        </div>
                      </td>
                      {(Object.keys(PENDENCIA_LABELS) as PendenciaField[]).map((field) => {
                        const allowed = canByField[field];
                        const cellKey = `${c.id}:${field}`;
                        return (
                          <td key={field} className="px-4 py-3">
                            <div className="flex justify-center">
                              <TriStateControl
                                state={computeState(c, field)}
                                busy={updatingCell === cellKey}
                                locked={!allowed}
                                lockedTitle={`Apenas ${SETOR_LABEL[CAMPO_SETOR[field]]} pode alterar este campo`}
                                onSet={(valor) => setPendencia(c, field, valor)}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {c.cliente || "—"}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        #{c.reserva} • {c.cpf_cnpj || ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                    <Building2 className="w-3.5 h-3.5" />
                    {c.bloco} • {c.unidade}
                  </div>

                  {(c.email || c.telefone) && (
                    <div className="text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                      {c.email && <p className="truncate">{c.email}</p>}
                      {c.telefone && <p>{c.telefone}</p>}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                    {(Object.keys(PENDENCIA_LABELS) as PendenciaField[]).map((field) => {
                      const allowed = canByField[field];
                      const cellKey = `${c.id}:${field}`;
                      return (
                        <div key={field} className="flex flex-col items-center gap-1.5 flex-1">
                          <span className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider text-center">
                            {PENDENCIA_LABELS[field]}
                          </span>
                          <TriStateControl
                            state={computeState(c, field)}
                            busy={updatingCell === cellKey}
                            locked={!allowed}
                            lockedTitle={`Apenas ${SETOR_LABEL[CAMPO_SETOR[field]]}`}
                            onSet={(valor) => setPendencia(c, field, valor)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 text-[11px] text-[var(--muted-foreground)] text-right">
              Exibindo {filtered.length} de {total} clientes
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EscopoAviso({
  canByField,
  somenteLeitura,
}: {
  canByField: Record<PendenciaField, boolean>;
  somenteLeitura: boolean;
}) {
  if (somenteLeitura) {
    return (
      <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <Lock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-700">
          Você só consegue visualizar esta tela. Para editar pendências, solicite permissão dos setores Contratos ou Financeiro.
        </p>
      </div>
    );
  }

  const setores: string[] = [];
  if (canByField.pendencia_agehab) setores.push("Contratos (AGEHAB)");
  if (canByField.pendencia_prosoluto || canByField.pendencia_jurosobra) {
    setores.push("Financeiro (Pró-Soluto + Juros Obra)");
  }

  // Se já pode editar tudo, não precisa de aviso
  if (setores.length === 2) return null;

  return (
    <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
      <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-800">
        Você pode editar apenas: <span className="font-semibold">{setores.join(", ")}</span>. Os demais campos ficam travados.
      </p>
    </div>
  );
}

function TriStateControl({
  state,
  busy,
  locked,
  lockedTitle,
  onSet,
}: {
  state: TriState;
  busy: boolean;
  locked: boolean;
  lockedTitle?: string;
  onSet: (pendencia: boolean) => void;
}) {
  const statusLabel =
    state === "nao_verificado"
      ? { text: "Não verificado", cls: "text-slate-400" }
      : state === "ok"
        ? { text: "Verificado", cls: "text-emerald-600" }
        : { text: "Com pendência", cls: "text-orange-600" };

  const okActive = state === "ok";
  const pendenteActive = state === "pendente";

  const baseBtn =
    "px-2 py-1 text-[11px] font-medium rounded-md transition-all disabled:opacity-50 flex items-center gap-1";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${statusLabel.cls}`}
      >
        {statusLabel.text}
      </span>
      <div className="flex items-center gap-1">
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
