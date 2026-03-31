"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Redireciona URLs legadas com hash (#/) para URLs limpas
 * e parametros ?page= (compatibilidade WhatsApp)
 */
export function HashRedirectHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleRedirects = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);
      const pageParam = urlParams.get("page");

      // 1. Compatibilidade WhatsApp: ?page=solicitacao-assistencia-tecnica
      if (
        pageParam === "solicitacao-assistencia-tecnica" ||
        pageParam === "solicitacao"
      ) {
        router.replace("/solicitacao-assistencia-tecnica");
        return;
      }

      // 2. Ignorar hashes com tokens do Supabase (tratados pelo AuthContext)
      if (hash && !hash.startsWith("#/")) {
        return;
      }

      // 3. Retrocompatibilidade: redirecionar URLs com hash (#/rota) para URLs limpas
      if (hash && hash.startsWith("#/")) {
        const hashRoute = hash.substring(2);

        const routeMap: Record<string, string> = {
          home: "/",
          "gerenciamento-assistencia": "/gerenciamento-assistencia",
          "whatsapp-chats": "/whatsapp-chats",
          cadastros: "/cadastros",
          gerenciamento: "/gerenciamento",
          "solicitacao-assistencia-tecnica":
            "/solicitacao-assistencia-tecnica",
          "reset-password-confirm": "/reset-password-confirm",
        };

        const cleanRoute = routeMap[hashRoute];
        if (cleanRoute) {
          window.location.hash = "";
          router.replace(cleanRoute);
          return;
        }

        for (const [hashKey, route] of Object.entries(routeMap)) {
          if (hashRoute.startsWith(hashKey)) {
            window.location.hash = "";
            router.replace(route);
            return;
          }
        }
      }
    };

    handleRedirects();

    const handleHashChange = () => {
      handleRedirects();
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [router, pathname]);

  return null;
}
