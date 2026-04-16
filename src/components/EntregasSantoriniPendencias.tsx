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
} from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { getSupabaseClient } from "@/utils/supabase/client";

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
}

type PendenciaField = "pendencia_agehab" | "pendencia_prosoluto" | "pendencia_jurosobra";

const PENDENCIA_LABELS: Record<PendenciaField, string> = {
  pendencia_agehab: "AGEHAB?",
  pendencia_prosoluto: "PRÓ-SOLUTO?",
  pendencia_jurosobra: "Juros Obra?",
};

export function EntregasSantoriniPendencias() {
  const { hasPermission, loading: permissionLoading } = usePermissionGuard(
    "entregas.santorini.pendencias",
  );

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingRow, setUpdatingRow] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission) return;
    const fetchClientes = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        const { data, error } = await (supabase
          .from("clientes_entrega_santorini") as ReturnType<typeof supabase.from>)
          .select(
            "id, reserva, data_venda, bloco, unidade, cliente, cpf_cnpj, email, telefone, pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra",
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

  const togglePendencia = async (cliente: Cliente, field: PendenciaField) => {
    const nextValue = !cliente[field];
    setUpdatingRow(cliente.id);
    setClientes((prev) =>
      prev.map((c) => (c.id === cliente.id ? { ...c, [field]: nextValue } : c)),
    );
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase
        .from("clientes_entrega_santorini") as ReturnType<typeof supabase.from>)
        .update({ [field]: nextValue })
        .eq("id", cliente.id);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao atualizar pendência:", err);
      setClientes((prev) =>
        prev.map((c) => (c.id === cliente.id ? { ...c, [field]: cliente[field] } : c)),
      );
      alert(`Erro ao atualizar: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setUpdatingRow(null);
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
      agehab: clientes.filter((c) => c.pendencia_agehab).length,
      prosoluto: clientes.filter((c) => c.pendencia_prosoluto).length,
      jurosobra: clientes.filter((c) => c.pendencia_jurosobra).length,
      semPendencias: clientes.filter(
        (c) => !c.pendencia_agehab && !c.pendencia_prosoluto && !c.pendencia_jurosobra,
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
        </div>
      </div>

      {/* Métricas */}
      {!loading && clientes.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Sem pendências</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{stats.semPendencias}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Com pendência AGEHAB</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{stats.agehab}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Com pendência Pró-Soluto</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{stats.prosoluto}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Com pendência Juros Obra</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{stats.jurosobra}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
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

      {/* Content */}
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
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      <div className="leading-tight">
                        <div>Código</div>
                        <div>Reserva</div>
                      </div>
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Cliente
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Empreend.
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Contato
                    </th>
                    <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      <div className="leading-tight">
                        <div>Pendências</div>
                        <div>AGEHAB?</div>
                      </div>
                    </th>
                    <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      <div className="leading-tight">
                        <div>Pendências</div>
                        <div>PRÓ-SOLUTO?</div>
                      </div>
                    </th>
                    <th className="text-center text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      <div className="leading-tight">
                        <div>Pendências</div>
                        <div>Juros Obra?</div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors ${
                        idx % 2 === 0 ? "" : "bg-[var(--background-alt)]/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">
                          {c.reserva}
                        </span>
                      </td>
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
                      {(Object.keys(PENDENCIA_LABELS) as PendenciaField[]).map((field) => (
                        <td key={field} className="px-4 py-3">
                          <div className="flex justify-center">
                            <Toggle
                              on={c[field]}
                              disabled={updatingRow === c.id}
                              onClick={() => togglePendencia(c, field)}
                            />
                          </div>
                        </td>
                      ))}
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
                    {(Object.keys(PENDENCIA_LABELS) as PendenciaField[]).map((field) => (
                      <div key={field} className="flex flex-col items-center gap-1.5 flex-1">
                        <span className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                          {PENDENCIA_LABELS[field]}
                        </span>
                        <Toggle
                          on={c[field]}
                          disabled={updatingRow === c.id}
                          onClick={() => togglePendencia(c, field)}
                        />
                      </div>
                    ))}
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

function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide transition-colors ${
          on ? "text-orange-500" : "text-emerald-600"
        }`}
      >
        {on ? "Sim" : "Não"}
      </span>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          on ? "bg-orange-500" : "bg-emerald-500"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-label={on ? "Tem pendência" : "Sem pendência"}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
