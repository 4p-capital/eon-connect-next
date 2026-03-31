import { describe, it, expect } from "vitest";
import {
  sanitizeError,
  ErrorType,
  handleFetchError,
  safeApiCall,
  withRetry,
} from "@/utils/errorHandler";

describe("errorHandler", () => {
  describe("sanitizeError", () => {
    it("deve retornar um SanitizedError com tipo e mensagem", () => {
      const error = new Error("Network error");
      const result = sanitizeError(error);

      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("userMessage");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("errorId");
      expect(result.errorId).toMatch(/^ERR-/);
    });

    it("deve detectar erro de rede", () => {
      const error = new Error("Failed to fetch");
      const result = sanitizeError(error);
      expect(result.type).toBe(ErrorType.NETWORK);
    });

    it("deve detectar erro de autenticação por status 401", () => {
      const error = { status: 401, message: "Unauthorized" };
      const result = sanitizeError(error);
      expect(result.type).toBe(ErrorType.AUTH);
    });

    it("deve detectar erro de validação", () => {
      const error = { status: 400, message: "Validation failed" };
      const result = sanitizeError(error);
      expect(result.type).toBe(ErrorType.VALIDATION);
    });

    it("deve detectar erro 404", () => {
      const error = { status: 404, message: "Not found" };
      const result = sanitizeError(error);
      expect(result.type).toBe(ErrorType.NOT_FOUND);
    });

    it("deve detectar erro de servidor", () => {
      const error = { status: 500, message: "Internal server error" };
      const result = sanitizeError(error);
      expect(result.type).toBe(ErrorType.SERVER);
    });

    it("deve retornar UNKNOWN para erros não classificados", () => {
      const error = { message: "something weird happened" };
      const result = sanitizeError(error);
      expect(result.type).toBe(ErrorType.UNKNOWN);
    });

    it("deve gerar mensagem amigável para o usuário", () => {
      const error = new Error("Failed to fetch");
      const result = sanitizeError(error);
      expect(result.userMessage).toContain("conexao");
    });
  });

  describe("handleFetchError", () => {
    it("deve tratar erro de fetch corretamente", () => {
      const error = new Error("Network error");
      const result = handleFetchError(error);
      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.userMessage).toBeDefined();
    });

    it("deve lidar com erro sem mensagem", () => {
      const result = handleFetchError({});
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("userMessage");
    });
  });

  describe("safeApiCall", () => {
    it("deve retornar data quando API responde OK", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ message: "sucesso" }),
      } as Response;

      const result = await safeApiCall(() => Promise.resolve(mockResponse));
      expect(result.data).toEqual({ message: "sucesso" });
      expect(result.error).toBeUndefined();
    });

    it("deve retornar error quando API responde com erro", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid data" }),
      } as Response;

      const result = await safeApiCall(() => Promise.resolve(mockResponse));
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it("deve capturar exceções de rede", async () => {
      const result = await safeApiCall(() =>
        Promise.reject(new Error("Failed to fetch"))
      );
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe(ErrorType.NETWORK);
    });
  });

  describe("withRetry", () => {
    it("deve executar função com sucesso na primeira tentativa", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn, { maxRetries: 2 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("deve fazer retry em erro de rede", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Failed to fetch"))
        .mockResolvedValueOnce("success");

      const result = await withRetry(fn, { maxRetries: 2, retryDelay: 10 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("deve lançar exceção após todas as tentativas falharem", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      await expect(
        withRetry(fn, { maxRetries: 1, retryDelay: 10 })
      ).rejects.toThrow("Failed to fetch");
      expect(fn).toHaveBeenCalledTimes(2); // 1 original + 1 retry
    });

    it("deve não fazer retry para erros de autenticação", async () => {
      const authError = new Error("Unauthorized");
      (authError as Error & { status: number }).status = 401;
      const fn = vi.fn().mockRejectedValue(authError);

      await expect(
        withRetry(fn, { maxRetries: 2, retryDelay: 10 })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
