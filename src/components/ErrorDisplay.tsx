"use client";

import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/button";
import type { SanitizedError } from "@/utils/errorHandler";

interface ErrorDisplayProps {
  error?: SanitizedError;
  title?: string;
  message?: string;
  showReload?: boolean;
  showHome?: boolean;
  onHome?: () => void;
}

export function ErrorDisplay({
  error,
  title = "Algo deu errado",
  message,
  showReload = true,
  showHome = false,
  onHome,
}: ErrorDisplayProps) {
  const displayMessage =
    message ||
    error?.userMessage ||
    "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-[#FEE2E2] rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[#EF4444]" />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-[#1B1B1B] mb-4">
          {title}
        </h2>

        <p className="text-[#4B5563] mb-6 leading-relaxed">
          {displayMessage}
        </p>

        {error?.errorId && (
          <div className="mb-6 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <p className="text-sm text-[#9CA3AF]">
              Codigo de referencia para suporte:
            </p>
            <p className="text-sm font-mono text-[#4B5563] mt-1">
              {error.errorId}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {showReload && (
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-black hover:bg-gray-800 text-white shadow-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar Pagina
            </Button>
          )}

          {showHome && onHome && (
            <Button
              onClick={onHome}
              variant="outline"
              className="w-full border-[#E5E7EB] text-[#1B1B1B] hover:bg-[#F3F3F3]"
            >
              <Home className="w-4 h-4 mr-2" />
              Voltar ao Inicio
            </Button>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
          <p className="text-sm text-[#9CA3AF]">
            Se o problema persistir, entre em contato com o suporte tecnico
            {error?.errorId &&
              " informando o codigo de referencia acima"}
          </p>
        </div>
      </div>
    </div>
  );
}
