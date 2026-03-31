/**
 * Variáveis de ambiente do Supabase
 *
 * IMPORTANTE: Next.js substitui process.env.NEXT_PUBLIC_* em tempo de build.
 * Por isso, cada variável deve ser acessada diretamente (não via string dinâmica).
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseProjectId: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID!,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
} as const;
