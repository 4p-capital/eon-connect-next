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
  Power,
  PowerOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { toast } from "sonner";

interface GrupoNotificacao {
  id: string;
  nome_grupo: string;
  centros_custo: string[];
  contato: string;
  ativo: boolean;
  created_at: string;
}

export function GruposNotificacaoList() {
  usePermissionGuard("menu_notificacoes");
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
  const [formCentrosCusto, setFormCentrosCusto] = useState<string[]>([]);
  const [formCentroCustoInput, setFormCentroCustoInput] = useState("");
  const [formContato, setFormContato] = useState("");

  // Configurações globais
  const [notificarFornecedor, setNotificarFornecedor] = useState(true);
  const [notificarGrupo, setNotificarGrupo] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Buscar configurações globais
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const supabase = getSupabaseComprasClient();
        const { data } = await (supabase
          .from("configuracoes_notificacao") as any)
          .select("notificar_fornecedor, notificar_grupo")
          .eq("id", 1)
          .single();
        if (data) {
          setNotificarFornecedor(data.notificar_fornecedor);
          setNotificarGrupo(data.notificar_grupo);
        }
      } catch (err) {
        console.error("Erro ao buscar config:", err);
      }
    };
    fetchConfig();
  }, []);

  const updateConfig = async (
    field: "notificar_fornecedor" | "notificar_grupo",
    value: boolean
  ) => {
    if (field === "notificar_fornecedor") setNotificarFornecedor(value);
    else setNotificarGrupo(value);

    try {
      const supabase = getSupabaseComprasClient();
      const { error } = await (supabase
        .from("configuracoes_notificacao") as any)
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      toast.success(
        `${field === "notificar_fornecedor" ? "Fornecedor" : "Grupo"}: notificação ${value ? "ativada" : "desativada"}`
      );
    } catch (err) {
      console.error("Erro ao atualizar config:", err);
      toast.error("Erro ao atualizar configuração");
      if (field === "notificar_fornecedor") setNotificarFornecedor(!value);
      else setNotificarGrupo(!value);
    }
  };

  const fetchGrupos = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseComprasClient();
      let query = (supabase
        .from("grupos_notificacao") as any)
        .select("*")
        .order("nome_grupo", { ascending: true });

      if (debouncedSearch) {
        query = query.or(
          `nome_grupo.ilike.%${debouncedSearch}%,contato.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtro adicional client-side por centro de custo (busca em array)
      const filtered = debouncedSearch
        ? (data || []).filter(
            (g: GrupoNotificacao) =>
              g.nome_grupo?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              g.contato?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              (g.centros_custo || []).some((cc) =>
                cc.toLowerCase().includes(debouncedSearch.toLowerCase())
              )
          )
        : data || [];

      setGrupos(filtered);
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
    setFormCentrosCusto([]);
    setFormCentroCustoInput("");
    setFormContato("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (grupo: GrupoNotificacao) => {
    setFormNome(grupo.nome_grupo);
    setFormCentrosCusto(grupo.centros_custo || []);
    setFormCentroCustoInput("");
    setFormContato(grupo.contato);
    setEditingId(grupo.id);
    setShowForm(true);
  };

  const addCentroCusto = () => {
    const value = formCentroCustoInput.trim();
    if (!value) return;
    if (formCentrosCusto.includes(value)) {
      toast.error("Centro de custo já adicionado");
      return;
    }
    setFormCentrosCusto([...formCentrosCusto, value]);
    setFormCentroCustoInput("");
  };

  const removeCentroCusto = (cc: string) => {
    setFormCentrosCusto(formCentrosCusto.filter((c) => c !== cc));
  };

  const handleSave = async () => {
    if (!formNome.trim() || formCentrosCusto.length === 0 || !formContato.trim()) {
      toast.error("Preencha todos os campos e adicione ao menos 1 centro de custo");
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
            centros_custo: formCentrosCusto,
            contato: formContato.trim(),
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Grupo atualizado");
      } else {
        const { error } = await (supabase.from("grupos_notificacao") as any).insert({
          nome_grupo: formNome.trim(),
          centros_custo: formCentrosCusto,
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

  const handleToggleAtivo = async (grupo: GrupoNotificacao) => {
    // Otimista
    setGrupos((prev) =>
      prev.map((g) => (g.id === grupo.id ? { ...g, ativo: !g.ativo } : g))
    );
    try {
      const supabase = getSupabaseComprasClient();
      const { error } = await (supabase
        .from("grupos_notificacao") as any)
        .update({ ativo: !grupo.ativo })
        .eq("id", grupo.id);
      if (error) throw error;
      toast.success(!grupo.ativo ? "Grupo ativado" : "Grupo desativado");
    } catch (error) {
      console.error("Erro ao atualizar grupo:", error);
      toast.error("Erro ao atualizar grupo");
      // Reverter
      setGrupos((prev) =>
        prev.map((g) => (g.id === grupo.id ? { ...g, ativo: grupo.ativo } : g))
      );
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Cards mobile usam ordem natural (sem agrupar - 1 grupo pode ter vários CCs)

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
                    Centros de Custo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formCentroCustoInput}
                      onChange={(e) => setFormCentroCustoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCentroCusto();
                        }
                      }}
                      placeholder="Ex: 120 (pressione Enter para adicionar)"
                      className="flex-1 px-3 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={addCentroCusto}
                      disabled={!formCentroCustoInput.trim()}
                      className="px-3 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {formCentrosCusto.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {formCentrosCusto.map((cc) => (
                        <span
                          key={cc}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--background-secondary)] text-xs font-mono text-[var(--foreground)]"
                        >
                          <Building2 className="w-3 h-3 text-[var(--muted-foreground)]" />
                          {cc}
                          <button
                            type="button"
                            onClick={() => removeCentroCusto(cc)}
                            className="ml-0.5 text-[var(--muted-foreground)] hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                    Adicione todos os centros de custo que devem notificar este grupo
                  </p>
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

      {/* Configurações Globais */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-white rounded-xl border border-[var(--border)] p-4">
          <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Configurações Globais de Notificação
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Toggle Fornecedor */}
            <div className="flex items-center justify-between p-3 bg-[var(--background-alt)] rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Notificar Fornecedor
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  Ao desativar, nenhum fornecedor recebe WhatsApp
                </p>
              </div>
              <button
                onClick={() =>
                  updateConfig("notificar_fornecedor", !notificarFornecedor)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${
                  notificarFornecedor ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificarFornecedor ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Toggle Grupo */}
            <div className="flex items-center justify-between p-3 bg-[var(--background-alt)] rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Notificar Grupos da Obra
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  Ao desativar, nenhum grupo recebe WhatsApp
                </p>
              </div>
              <button
                onClick={() =>
                  updateConfig("notificar_grupo", !notificarGrupo)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${
                  notificarGrupo ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificarGrupo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

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
                      Centros de Custo
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Contato / ID Grupo
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Status
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
                        <div className="flex items-center gap-1 flex-wrap">
                          {(grupo.centros_custo || []).map((cc) => (
                            <span
                              key={cc}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--background-secondary)] text-xs font-mono text-[var(--foreground)]"
                            >
                              <Building2 className="w-3 h-3 text-[var(--muted-foreground)]" />
                              {cc}
                            </span>
                          ))}
                          {(!grupo.centros_custo || grupo.centros_custo.length === 0) && (
                            <span className="text-[11px] text-[var(--muted-foreground)]">—</span>
                          )}
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
                        <button
                          onClick={() => handleToggleAtivo(grupo)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            grupo.ativo ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                          title={grupo.ativo ? "Desativar notificação" : "Ativar notificação"}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              grupo.ativo ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
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
              {grupos.map((grupo) => (
                <div
                  key={grupo.id}
                  className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {grupo.nome_grupo}
                        {!grupo.ativo && (
                          <span className="ml-1.5 text-[10px] text-[var(--muted-foreground)] font-normal">
                            (inativo)
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono truncate">
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
                  <div className="flex items-center gap-1 flex-wrap">
                    {(grupo.centros_custo || []).map((cc) => (
                      <span
                        key={cc}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--background-secondary)] text-[11px] font-mono text-[var(--foreground)]"
                      >
                        <Building2 className="w-3 h-3 text-[var(--muted-foreground)]" />
                        {cc}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
