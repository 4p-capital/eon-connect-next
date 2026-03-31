import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware Next.js
 *
 * A autenticação é gerenciada client-side pelo AuthContext (Supabase + localStorage).
 * O layout (protected) já cuida de renderizar login vs. app.
 *
 * Este middleware aplica headers de segurança e pode ser estendido
 * futuramente para verificar cookies se migrar para auth server-side.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Headers de segurança adicionais por rota (se necessário)
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
