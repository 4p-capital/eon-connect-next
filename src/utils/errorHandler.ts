/**
 * Sistema de tratamento de erros
 * Garante que detalhes tecnicos sensiveis nunca sejam expostos aos usuarios
 */

export enum ErrorType {
  NETWORK = "NETWORK",
  AUTH = "AUTH",
  VALIDATION = "VALIDATION",
  NOT_FOUND = "NOT_FOUND",
  PERMISSION = "PERMISSION",
  SERVER = "SERVER",
  UNKNOWN = "UNKNOWN",
}

export interface SanitizedError {
  type: ErrorType;
  userMessage: string;
  timestamp: string;
  errorId?: string;
}

function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeMessage(message: string): string {
  if (!message) return "";
  let sanitized = message.replace(/https?:\/\/[^\s]+/gi, "[URL removida]");
  sanitized = sanitized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    "[IP removido]"
  );
  sanitized = sanitized.replace(/[A-Za-z]:\\[^:\n]+/g, "[caminho removido]");
  sanitized = sanitized.replace(
    /\/[^\s:]+\.(tsx?|jsx?|js|ts)/gi,
    "[arquivo removido]"
  );
  sanitized = sanitized.replace(/at\s+[^\n]+/g, "");
  sanitized = sanitized.replace(/[a-f0-9]{32,}/gi, "[token removido]");
  return sanitized.trim();
}

function detectErrorType(error: any): ErrorType {
  const message = (error?.message || "").toLowerCase();
  const status = error?.status || error?.response?.status;

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return ErrorType.NETWORK;
  }
  if (
    status === 401 ||
    status === 403 ||
    message.includes("unauthorized") ||
    message.includes("authentication") ||
    message.includes("token")
  ) {
    return ErrorType.AUTH;
  }
  if (
    status === 400 ||
    message.includes("validation") ||
    message.includes("invalid")
  ) {
    return ErrorType.VALIDATION;
  }
  if (status === 404 || message.includes("not found")) {
    return ErrorType.NOT_FOUND;
  }
  if (
    status === 403 ||
    message.includes("permission") ||
    message.includes("forbidden")
  ) {
    return ErrorType.PERMISSION;
  }
  if (status >= 500 || message.includes("server error")) {
    return ErrorType.SERVER;
  }
  return ErrorType.UNKNOWN;
}

function getUserFriendlyMessage(type: ErrorType): string {
  const messages = {
    [ErrorType.NETWORK]:
      "Nao foi possivel conectar ao servidor. Verifique sua conexao com a internet e tente novamente.",
    [ErrorType.AUTH]:
      "Sua sessao expirou. Por favor, faca login novamente.",
    [ErrorType.VALIDATION]:
      "Os dados fornecidos sao invalidos. Por favor, verifique e tente novamente.",
    [ErrorType.NOT_FOUND]: "O recurso solicitado nao foi encontrado.",
    [ErrorType.PERMISSION]:
      "Voce nao tem permissao para realizar esta acao.",
    [ErrorType.SERVER]:
      "Ocorreu um erro no servidor. Nossa equipe foi notificada e estamos trabalhando para resolver.",
    [ErrorType.UNKNOWN]:
      "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.",
  };
  return messages[type];
}

export function sanitizeError(error: any): SanitizedError {
  const errorId = generateErrorId();
  const type = detectErrorType(error);
  const userMessage = getUserFriendlyMessage(type);

  if (process.env.NODE_ENV !== "production") {
    console.group(`Erro Capturado [${errorId}]`);
    console.error("Tipo:", type);
    console.error("Erro original:", error);
    console.error("Stack:", error?.stack);
    console.groupEnd();
  } else {
    console.error(`Erro [${errorId}]:`, type);
  }

  return { type, userMessage, timestamp: new Date().toISOString(), errorId };
}

export async function handleApiError(
  response: Response
): Promise<SanitizedError> {
  let errorData: any = {};
  try {
    errorData = await response.json();
  } catch {
    // Resposta nao e JSON
  }
  const error = {
    status: response.status,
    message: errorData.error || errorData.message || response.statusText,
    ...errorData,
  };
  return sanitizeError(error);
}

export function handleFetchError(error: any): SanitizedError {
  return sanitizeError({ message: error?.message || "Network error", ...error });
}

export async function safeApiCall<T>(
  apiCall: () => Promise<Response>
): Promise<{ data?: T; error?: SanitizedError }> {
  try {
    const response = await apiCall();
    if (!response.ok) {
      const error = await handleApiError(response);
      return { error };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    const sanitizedError = handleFetchError(error);
    return { error: sanitizedError };
  }
}

export function getErrorDisplay(error: SanitizedError) {
  return {
    title: "Algo deu errado",
    message: error.userMessage,
    errorId: error.errorId,
    timestamp: new Date(error.timestamp).toLocaleString("pt-BR"),
  };
}

export function handleError(error: any, customMessage?: string): void {
  const sanitized = sanitizeError(error);
  if (typeof window !== "undefined") {
    const toastFn = (window as any).toast;
    if (toastFn && typeof toastFn.error === "function") {
      toastFn.error(customMessage || sanitized.userMessage, {
        description: sanitized.errorId
          ? `Codigo: ${sanitized.errorId}`
          : undefined,
      });
    } else {
      console.error(customMessage || sanitized.userMessage, sanitized);
    }
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    retryOn?: ErrorType[];
  } = {}
): Promise<T> {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    retryOn = [ErrorType.NETWORK, ErrorType.SERVER],
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorType = detectErrorType(error);
      if (attempt < maxRetries && retryOn.includes(errorType)) {
        console.log(
          `Tentativa ${attempt + 1}/${maxRetries + 1} falhou. Tentando novamente em ${retryDelay}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1))
        );
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
