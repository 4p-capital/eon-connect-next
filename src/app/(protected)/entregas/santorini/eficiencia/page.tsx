"use client";

import { Loader2, TrendingDown } from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { EntregasSantoriniEficiencia } from "@/components/EntregasSantoriniEficiencia";
import { EntregasSantoriniDisparoConfig } from "@/components/EntregasSantoriniDisparoConfig";

export default function EntregasSantoriniEficienciaPage() {
  const { hasPermission, loading } = usePermissionGuard("entregas.santorini.eficiencia");

  if (loading || !hasPermission) {
    return (
      <div className="min-h-screen bg-[var(--background-alt)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Acompanhamento — Gran Santorini
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Evolução das pendências, clientes liberados para recebimento e gestão dos disparos automáticos.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        <EntregasSantoriniDisparoConfig />
        <EntregasSantoriniEficiencia />
      </div>
    </div>
  );
}
