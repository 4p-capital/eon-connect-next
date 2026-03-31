import { useState, useEffect, useCallback, useRef } from 'react';
import { apiBaseUrl, publicAnonKey } from '@/utils/supabase/info';

interface PaginationMetadata {
  page: number;
  limit: number;
  totalAbertas: number;
  totalFinalizadas: number;
  totalNestaPagina: number;
  hasMore: boolean;
}

interface UsePaginatedAssistenciasResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMetadata | null;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  hasMore: boolean;
}

interface UsePaginatedAssistenciasOptions {
  endpoint: string;
  pageSize?: number;
  autoLoad?: boolean;
  filters?: Record<string, string>;
}

export function usePaginatedAssistencias<T = unknown>({
  endpoint,
  pageSize = 50,
  autoLoad = true,
  filters = {}
}: UsePaginatedAssistenciasOptions): UsePaginatedAssistenciasResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async (page: number, append: boolean = false) => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...filters
      });

      const url = `${apiBaseUrl}${endpoint}?${params}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      let newData: T[];
      let paginationData: PaginationMetadata | null = null;

      if (result.data && result.pagination) {
        newData = result.data;
        paginationData = result.pagination;
      } else if (Array.isArray(result)) {
        newData = result;
        paginationData = {
          page,
          limit: pageSize,
          totalAbertas: result.length,
          totalFinalizadas: 0,
          totalNestaPagina: result.length,
          hasMore: result.length === pageSize
        };
      } else {
        throw new Error('Formato de resposta inválido');
      }

      if (append) {
        setData(prev => [...prev, ...newData]);
      } else {
        setData(newData);
      }

      setPagination(paginationData);
      setCurrentPage(page);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [endpoint, pageSize, filters]);

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || loading) return;
    await loadData(currentPage + 1, true);
  }, [currentPage, pagination, loading, loadData]);

  const reload = useCallback(async () => {
    setData([]);
    setCurrentPage(1);
    await loadData(1, false);
  }, [loadData]);

  useEffect(() => {
    if (autoLoad) {
      loadData(1, false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoLoad, endpoint, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    pagination,
    loadMore,
    reload,
    hasMore: pagination?.hasMore ?? false
  };
}

export function useHistoricoAssistencias() {
  return usePaginatedAssistencias({
    endpoint: '/assistencias-historico',
    pageSize: 100,
    autoLoad: true
  });
}
