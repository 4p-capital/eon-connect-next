/**
 * Variáveis de ambiente do Supabase Compras
 */

export const envCompras = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_COMPRAS_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_COMPRAS_ANON_KEY!,
} as const;
