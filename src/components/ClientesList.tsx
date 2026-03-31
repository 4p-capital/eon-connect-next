"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Users, Building2, Phone, Mail, ChevronLeft, ChevronRight, Loader2, UserCircle, Filter, X, Copy, Check, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface Cliente {
  id_cliente: number;
  proprietario: string;
  cpf: string;
  email: string;
  telefone: string;
  bloco: string;
  unidade: string;
  empreendimento: string;
  created_at?: string;
}

interface ApiResponse {
  data: Cliente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMIT_OPTIONS = [100, 300, 500, 1000] as const;

export function ClientesList() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState<number>(100);
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);
  const [filtroEmpreendimento, setFiltroEmpreendimento] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch empreendimentos for filter
  useEffect(() => {
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/clientes-empreendimentos`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(res => setEmpreendimentos(res.data || []))
      .catch(err => console.error('Erro ao buscar empreendimentos:', err));
  }, []);

  // Fetch clientes
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filtroEmpreendimento) params.set('empreendimento', filtroEmpreendimento);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/clientes?${params}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result: ApiResponse = await response.json();

      if (!response.ok) throw new Error((result as any).error || 'Erro ao buscar clientes');

      setClientes(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filtroEmpreendimento, limit]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const formatCPF = (cpf: string) => {
    if (!cpf) return '—';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFiltroEmpreendimento('');
    setPage(1);
  };

  const hasActiveFilters = debouncedSearch || filtroEmpreendimento;

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">Clientes</h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {loading ? 'Carregando...' : `${total} cliente${total !== 1 ? 's' : ''} cadastrado${total !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-black text-white'
                  : 'bg-[var(--background-secondary)] text-[var(--foreground)] hover:bg-[var(--border)]'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--error)] rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        {/* Search bar - always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail, telefone, bloco ou unidade..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <select
                    value={filtroEmpreendimento}
                    onChange={(e) => { setFiltroEmpreendimento(e.target.value); setPage(1); }}
                    className="pl-3 pr-8 py-2 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 appearance-none cursor-pointer"
                  >
                    <option value="">Todos os empreendimentos</option>
                    {empreendimentos.map((emp) => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-light)] rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar filtros
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[var(--muted-foreground)] animate-spin mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">Carregando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-[var(--background-secondary)] rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <p className="text-base font-medium text-[var(--foreground)] mb-1">
              Nenhum cliente encontrado
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {hasActiveFilters ? 'Tente ajustar os filtros de busca.' : 'Ainda nenhum cliente cadastrado.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3 w-16">
                      ID
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Proprietario/Inquilino
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      CPF
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Contato
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Empreendimento
                    </th>
                    <th className="text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider px-4 py-3">
                      Bloco/Unidade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente, idx) => (
                    <motion.tr
                      key={`row-${cliente.id_cliente ?? idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-alt)] transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)] bg-[var(--background-secondary)] px-1.5 py-0.5 rounded">
                          {cliente.id_cliente}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--background-secondary)] flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                              {(cliente.proprietario || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-[200px]">
                            {cliente.proprietario || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 group/cpf">
                          <span className="text-sm text-[var(--foreground)] font-mono">{formatCPF(cliente.cpf)}</span>
                          {cliente.cpf && (
                            <button
                              onClick={() => handleCopy(cliente.cpf, `cpf-${cliente.id_cliente}`)}
                              className="opacity-0 group-hover/cpf:opacity-100 transition-opacity"
                              title="Copiar CPF"
                            >
                              {copiedId === `cpf-${cliente.id_cliente}` ? (
                                <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {cliente.telefone && (
                            <div className="flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                              <Phone className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                              {formatPhone(cliente.telefone)}
                            </div>
                          )}
                          {cliente.email && (
                            <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] truncate max-w-[220px]">
                              <Mail className="w-3.5 h-3.5" />
                              {cliente.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--foreground)]">{cliente.empreendimento || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--foreground)]">
                          {cliente.bloco && cliente.unidade
                            ? `${cliente.bloco} - ${cliente.unidade}`
                            : cliente.bloco || cliente.unidade || '—'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {clientes.map((cliente, idx) => (
                <motion.div
                  key={`card-${cliente.id_cliente ?? idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setExpandedId(expandedId === cliente.id_cliente ? null : cliente.id_cliente)}
                  className="bg-white rounded-xl border border-[var(--border)] p-4 active:bg-[var(--background-alt)] transition-colors cursor-pointer"
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--background-secondary)] flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                        {(cliente.proprietario || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {cliente.proprietario || '—'}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        <span className="font-mono mr-1.5">#{cliente.id_cliente}</span>
                        {cliente.empreendimento || '—'}
                        {(cliente.bloco || cliente.unidade) && ` | ${cliente.bloco || ''}${cliente.bloco && cliente.unidade ? '-' : ''}${cliente.unidade || ''}`}
                      </p>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expandedId === cliente.id_cliente && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                              <span className="text-[var(--muted-foreground)] text-xs font-medium">CPF</span>
                              <span className="font-mono">{formatCPF(cliente.cpf)}</span>
                            </div>
                            {cliente.cpf && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopy(cliente.cpf, `m-cpf-${cliente.id_cliente}`); }}
                                className="p-1.5 rounded-md hover:bg-[var(--background-secondary)]"
                              >
                                {copiedId === `m-cpf-${cliente.id_cliente}` ? (
                                  <Check className="w-4 h-4 text-[var(--success)]" />
                                ) : (
                                  <Copy className="w-4 h-4 text-[var(--muted-foreground)]" />
                                )}
                              </button>
                            )}
                          </div>
                          {cliente.telefone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-[var(--muted-foreground)]" />
                              <a
                                href={`tel:${cliente.telefone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[var(--foreground)] underline-offset-2 hover:underline"
                              >
                                {formatPhone(cliente.telefone)}
                              </a>
                            </div>
                          )}
                          {cliente.email && (
                            <div className="flex items-center gap-2 text-sm min-w-0">
                              <Mail className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                              <a
                                href={`mailto:${cliente.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[var(--foreground)] underline-offset-2 hover:underline truncate"
                              >
                                {cliente.email}
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                            <span className="text-[var(--foreground)]">{cliente.empreendimento || '—'}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 px-1 gap-3">
              {/* Per-page selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">Exibir</span>
                <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-0.5">
                  {LIMIT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setLimit(opt); setPage(1); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        limit === opt
                          ? 'bg-black text-white'
                          : 'text-[var(--muted-foreground)] hover:bg-[var(--background-secondary)]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  | Mostrando {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} de {total}
                </span>
              </div>

              {/* Page navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === pageNum
                            ? 'bg-black text-white'
                            : 'hover:bg-white hover:border-[var(--border)] border border-transparent text-[var(--muted-foreground)]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[var(--border)] disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}