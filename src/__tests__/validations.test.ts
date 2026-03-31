import { describe, it, expect } from "vitest";
import { loginSchema, signUpSchema, resetPasswordSchema } from "@/lib/validations/auth";

describe("Validações de Auth", () => {
  describe("loginSchema", () => {
    it("deve aceitar dados válidos", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "123456",
      });
      expect(result.success).toBe(true);
    });

    it("deve rejeitar email vazio", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "123456",
      });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar email inválido", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "123456",
      });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar senha curta", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "123",
      });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar senha vazia", () => {
      const result = loginSchema.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("signUpSchema", () => {
    const validData = {
      nome: "João Silva",
      cpf: "123.456.789-00",
      telefone: "(11) 99999-9999",
      email: "joao@example.com",
      password: "123456",
      confirmPassword: "123456",
      idempresa: "1",
    };

    it("deve aceitar dados válidos", () => {
      const result = signUpSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("deve rejeitar nome curto", () => {
      const result = signUpSchema.safeParse({ ...validData, nome: "Jo" });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar CPF inválido", () => {
      const result = signUpSchema.safeParse({ ...validData, cpf: "12345" });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar telefone inválido", () => {
      const result = signUpSchema.safeParse({ ...validData, telefone: "12345" });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar senhas que não coincidem", () => {
      const result = signUpSchema.safeParse({
        ...validData,
        confirmPassword: "654321",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const confirmError = result.error.issues.find(
          (e) => e.path.includes("confirmPassword")
        );
        expect(confirmError?.message).toBe("As senhas não coincidem");
      }
    });

    it("deve rejeitar empresa não selecionada", () => {
      const result = signUpSchema.safeParse({ ...validData, idempresa: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("deve aceitar email válido", () => {
      const result = resetPasswordSchema.safeParse({
        email: "user@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("deve rejeitar email inválido", () => {
      const result = resetPasswordSchema.safeParse({
        email: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });
});
