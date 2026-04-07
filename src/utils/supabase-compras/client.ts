import { createClient } from "@supabase/supabase-js";
import { envCompras } from "./env";

let supabaseComprasClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseComprasClient() {
  if (!supabaseComprasClient) {
    supabaseComprasClient = createClient(
      envCompras.supabaseUrl,
      envCompras.supabaseAnonKey
    );
  }
  return supabaseComprasClient;
}
