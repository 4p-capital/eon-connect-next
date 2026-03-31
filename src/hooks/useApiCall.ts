import { useState, useCallback } from 'react';
import { sanitizeError, type SanitizedError } from '@/utils/errorHandler';
import { toast } from 'sonner';

interface ApiCallState<T> {
  data: T | null;
  loading: boolean;
  error: SanitizedError | null;
}

interface ApiCallOptions {
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
}

/**
 * Hook para facilitar chamadas de API com tratamento de erros automático
 *
 * Uso:
 * ```tsx
 * const { data, loading, error, execute } = useApiCall<ResponseType>();
 *
 * const handleSubmit = async () => {
 *   const result = await execute(async () => {
 *     const response = await fetch('/api/endpoint', { method: 'POST', ... });
 *     if (!response.ok) throw new Error('Falha na requisição');
 *     return response.json();
 *   });
 *
 *   if (result.success) {
 *     // Fazer algo com result.data
 *   }
 * };
 * ```
 */
export function useApiCall<T = any>(options: ApiCallOptions = {}) {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage = 'Operação realizada com sucesso!',
  } = options;

  const [state, setState] = useState<ApiCallState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (
      apiCall: () => Promise<T>
    ): Promise<{ success: boolean; data?: T; error?: SanitizedError }> => {
      setState({ data: null, loading: true, error: null });

      try {
        const data = await apiCall();

        setState({ data, loading: false, error: null });

        if (showSuccessToast) {
          toast.success(successMessage);
        }

        return { success: true, data };
      } catch (error: any) {
        const sanitizedError = sanitizeError(error);

        setState({ data: null, loading: false, error: sanitizedError });

        if (showErrorToast) {
          toast.error(sanitizedError.userMessage, {
            description: sanitizedError.errorId
              ? `Código de referência: ${sanitizedError.errorId}`
              : undefined,
          });
        }

        return { success: false, error: sanitizedError };
      }
    },
    [showErrorToast, showSuccessToast, successMessage]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Wrapper para fetch com tratamento de erro automático
 * Lança exceção se a resposta não for OK
 */
export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorMessage = response.statusText;

    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Resposta não é JSON
    }

    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}
