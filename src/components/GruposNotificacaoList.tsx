"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Users2,
  Plus,
  Loader2,
  X,
  Trash2,
  Building2,
  Phone,
  Edit2,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";
import { toast } from "sonner";

interface GrupoNotificacao {
  id: string;
  nome_grupo: string;
  centro_custo: string;
  contato: string;
  created_at: string;
}

export function GruposNotificacaoList() {
  const [grupos, setGrupos] = useState<GrupoNotificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formNome, setFormNome] = useState("");
  const [formCentroCusto, setFormCentroCusto] = useState("");
  const [formContato, setFormContato] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchGrupos = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseComprasClient();
      let query = (supabase
        .from("grupos_notificacao") as any)
        .select("*")
        .order("centro_custo", { ascending: true });

      if (debouncedSearch) {
        query = query.or(
          `nome_grupo.ilike.%${debouncedSearch}%,centro_custo.ilike.%${debouncedSearch}%,contato.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      console.error("Erro ao buscar grupos:", error);
      toast.error("Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchGrupos();
  }, [fetchGrupos]);

  const resetForm = () => {
    setFormNome("");
    setFormCentroCusto("");
    setFormContato("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (grupo: GrupoNotificacao) => {
    setFormNome(grupo.nome_grupo);
    setFormCentroCusto(grupo.centro_custo);
    setFormContato(grupo.contato);
    setEditingId(grupo.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formNome.trim() || !formCentroCusto.trim() || !formContato.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseComprasClient();

      if (editingId) {
        const { error } = await (supabase
          .from("grupos_notificacao") as any)
          .update({
            nome_grupo: formNome.trim(),
            centro_custo: formCentroCusto.trim(),
            contato: formContato.trim(),
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Grupo atualizado");
      } else {
        const { error } = await (supabase.from("grupos_notificacao") as any).insert({
          nome_grupo: formNome.trim(),
          centro_custo: formCentroCusto.trim(),
          contato: formContato.trim(),
        });
        if (error) throw error;
        toast.success("Grupo cadastrado");
      }

      resetForm();
      fetchGrupos();
    } catch (error) {
      console.error("Erro ao salvar grupo:", error);
      toast.error("Erro ao salvar grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const supabase = getSupabaseComprasClient();
      const { error } = await (supabase
        .from("grupos_notificacao") as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Grupo removido");
      fetchGrupos();
    } catch (error) {
      console.error("Erro ao remover grupo:", error);
      toast.error("Erro ao remover grupo");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Agrupar por centro de custo
  const grouped = grupos.reduce(
    (acc, grupo) => {
      const cc = grupo.centro_custo;
      if (!acc[cc]) acc[cc] = [];
      acc[cc].push(grupo);
      return acc;
    },
    {} as Record<string, GrupoNotificacao[]>
  );

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <Users2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">
                  Cadastro de Grupos
                </h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {loading
                    ? "Carregando..."
                    : `${grupos.length} grupo${grupos.length !== 1 ? "s" : ""} cadastrado${grupos.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Cadastrar Grupo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => resetForm()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  {editingId ? "Editar Grupo" : "Cadastrar Grupo"}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <X className="w-4 h-4 text-[var(--muted-foreground)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Nome do Grupo / Obra
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Santorine Insumos"
                    className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Centro de Custo
                  </label>
                  <input
                    type="text"
                    value={formCentroCusto}
                    onChange={(e) => setFormCentroCusto(e.target.value)}
                    placeholder="Ex: 120"
                    className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    ID do Grupo / Telefone
                  </label>
                  <input
                    type="text"
                    value={formContato}
                    onChange={(e) => setFormContato(e.target.value)}
                    placeholder="Ex: groups-2382sdds832823 ou 5561986562744"
                    className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                  />
                  <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                    Use o ID do grupo do WhatsApp ou um telefone com DDD
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] bg-[var(--background-secondary)] hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingId ? "Salvar" : "Cadastrar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, centro de custo ou contato..."
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
            <p className="text-sm text-[var(--muted-foreground)]">Carregando grupos...</p>
          </div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users2 className="w-12 h-12 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {debouncedSearch
                ? "Nenhum grupo encontrado com a busca aplicada"
                : "Nenhum grupo cadastrado ainda"}
            </p>
            {!debouncedSearch && (
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Cadastrar primeiro grupo
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
                      Nome do Grupo
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Centro de Custo
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Contato / ID Grupo
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Cadastrado em
                    </th>
                    <th className="text-right text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((grupo, idx) => (
                    <tr
                      key={grupo.id}
                      className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors ${
                        idx % 2 === 0 ? "" : "bg-[var(--background-alt)]/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--background-secondary)] flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                              {grupo.nome_grupo.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-[var(--foreground)]">
                            {grupo.nome_grupo}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                          <span className="text-xs font-mono text-[var(--foreground)]">
                            {grupo.centro_custo}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                          <span className="text-xs font-mono text-[var(--foreground)]">
                            {grupo.contato}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatDate(grupo.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(grupo)}
                            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(grupo.id)}
                            disabled={deleting === grupo.id}
                            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Remover"
                          >
                            {deleting === grupo.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {Object.entries(grouped).map(([cc, items]) => (
                <div key={cc} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Centro de Custo: {cc}
                    </span>
                  </div>
                  {items.map((grupo) => (
                    <div
                      key={grupo.id}
                      className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {grupo.nome_grupo}
                          </p>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">
                            {grupo.contato}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(grupo)}
                            className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)]"
                          >
                            <Edit2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                          </button>
                          <button
                            onClick={() => handleDelete(grupo.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
