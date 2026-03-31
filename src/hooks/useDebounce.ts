import { useState, useEffect } from 'react';

/**
 * Hook para debouncing de valores
 * Útil para pesquisas e filtros que fazem requisições ao backend
 *
 * @param value - Valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 500ms)
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   // Só faz a busca após 500ms sem digitar
 *   if (debouncedSearch) {
 *     fetchData(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Criar timer que atualiza o valor após o delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpar timer se o valor mudar antes do delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debouncing de funções
 * Útil para eventos como scroll, resize, etc
 *
 * @param callback - Função a ser chamada após o delay
 * @param delay - Delay em milissegundos (padrão: 500ms)
 *
 * @example
 * ```tsx
 * const debouncedSave = useDebouncedCallback((value) => {
 *   saveToDatabase(value);
 * }, 1000);
 *
 * <input onChange={(e) => debouncedSave(e.target.value)} />
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = (...args: Parameters<T>) => {
    // Limpar timeout anterior se existir
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Criar novo timeout
    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };

  // Limpar timeout ao desmontar componente
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
}

/**
 * Hook para throttling (limitar taxa de execução)
 * Diferente de debounce, garante que a função seja chamada periodicamente
 *
 * @param callback - Função a ser throttled
 * @param limit - Tempo mínimo entre execuções em ms (padrão: 500ms)
 *
 * @example
 * ```tsx
 * const throttledScroll = useThrottle((scrollY) => {
 *   console.log('Scroll position:', scrollY);
 * }, 200);
 *
 * useEffect(() => {
 *   window.addEventListener('scroll', () => throttledScroll(window.scrollY));
 * }, []);
 * ```
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 500
): (...args: Parameters<T>) => void {
  const [lastRun, setLastRun] = useState(Date.now());

  const throttledCallback = (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRun >= limit) {
      callback(...args);
      setLastRun(now);
    }
  };

  return throttledCallback;
}

/**
 * Hook combinado de debounce + loading state
 * Útil para mostrar feedback visual durante pesquisas
 *
 * @example
 * ```tsx
 * const { debouncedValue, isDebouncing } = useDebouncedState('', 500);
 *
 * return (
 *   <div>
 *     <input value={value} onChange={(e) => setValue(e.target.value)} />
 *     {isDebouncing && <Spinner />}
 *   </div>
 * );
 * ```
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 500
): {
  value: T;
  debouncedValue: T;
  setValue: (value: T) => void;
  isDebouncing: boolean;
} {
  const [value, setValue] = useState<T>(initialValue);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    if (value !== debouncedValue) {
      setIsDebouncing(true);
    } else {
      setIsDebouncing(false);
    }
  }, [value, debouncedValue]);

  return {
    value,
    debouncedValue,
    setValue,
    isDebouncing
  };
}

/**
 * Hook para debouncing de pesquisa com estado
 * Gerencia input, debouncing e loading automaticamente
 *
 * @example
 * ```tsx
 * const search = useSearchDebounce({
 *   onSearch: (term) => fetchResults(term),
 *   delay: 500
 * });
 *
 * return (
 *   <div>
 *     <input
 *       value={search.value}
 *       onChange={(e) => search.setValue(e.target.value)}
 *       placeholder="Pesquisar..."
 *     />
 *     {search.isSearching && <Loader />}
 *   </div>
 * );
 * ```
 */
export function useSearchDebounce({
  onSearch,
  delay = 500,
  minLength = 3
}: {
  onSearch: (term: string) => void | Promise<void>;
  delay?: number;
  minLength?: number;
}) {
  const [value, setValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedValue.length >= minLength) {
        setIsSearching(true);
        try {
          await onSearch(debouncedValue);
        } finally {
          setIsSearching(false);
        }
      } else if (debouncedValue.length === 0) {
        // Limpar resultados quando campo está vazio
        await onSearch('');
      }
    };

    performSearch();
  }, [debouncedValue]);

  const clear = () => {
    setValue('');
  };

  return {
    value,
    setValue,
    debouncedValue,
    isSearching,
    clear,
    hasMinLength: value.length >= minLength
  };
}
