import { describe, it, expect, vi, beforeEach } from "vitest";
import { isApiSuccess, isApiError } from "@/services/api";

// Mock env variables
vi.mock("@/utils/supabase/info", () => ({
  apiBaseUrl: "https://test.supabase.co/functions/v1/test",
  publicAnonKey: "test-anon-key",
  projectId: "test-project",
  supabaseUrl: "https://test.supabase.co",
}));

describe("API Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isApiSuccess", () => {
    it("deve retornar true para resultado com ok=true", () => {
      const result = { ok: true as const, data: { test: true } };
      expect(isApiSuccess(result)).toBe(true);
    });

    it("deve retornar false para resultado com ok=false", () => {
      const result = {
        ok: false as const,
        error: {
          type: "UNKNOWN" as const,
          userMessage: "Erro",
          timestamp: new Date().toISOString(),
        },
      };
      expect(isApiSuccess(result)).toBe(false);
    });
  });

  describe("isApiError", () => {
    it("deve retornar true para resultado com ok=false", () => {
      const result = {
        ok: false as const,
        error: {
          type: "UNKNOWN" as const,
          userMessage: "Erro",
          timestamp: new Date().toISOString(),
        },
      };
      expect(isApiError(result)).toBe(true);
    });

    it("deve retornar false para resultado com ok=true", () => {
      const result = { ok: true as const, data: { test: true } };
      expect(isApiError(result)).toBe(false);
    });
  });
});
