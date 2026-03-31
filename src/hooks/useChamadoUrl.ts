"use client";

import { useCallback, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const PARAM_KEY = "chamado";

/**
 * Hook para sincronizar o ID do chamado aberto com a URL
 *
 * Usa window.history.replaceState para atualizar a URL instantaneamente
 * sem disparar navegação do Next.js (que causa re-render lento).
 */
export function useChamadoUrl() {
  const pathname = usePathname();

  // Ler o param da URL na montagem
  const [chamadoId, setChamadoId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(PARAM_KEY);
  });

  // Sincronizar se a URL mudar externamente (popstate)
  useEffect(() => {
    const onPopState = () => {
      setChamadoId(new URLSearchParams(window.location.search).get(PARAM_KEY));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Abre um chamado — atualiza URL instantaneamente */
  const abrirChamado = useCallback(
    (id: number | string) => {
      const strId = String(id);
      setChamadoId(strId);
      const params = new URLSearchParams(window.location.search);
      params.set(PARAM_KEY, strId);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname]
  );

  /** Fecha o chamado — remove da URL instantaneamente */
  const fecharChamado = useCallback(() => {
    setChamadoId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete(PARAM_KEY);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [pathname]);

  return { chamadoId, abrirChamado, fecharChamado };
}
