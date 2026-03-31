import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: "eon-connect-auth",
          storage: {
            getItem: (key) => {
              try {
                return localStorage.getItem(key);
              } catch {
                return null;
              }
            },
            setItem: (key, value) => {
              try {
                localStorage.setItem(key, value);
              } catch {
                // silently fail
              }
            },
            removeItem: (key) => {
              try {
                localStorage.removeItem(key);
              } catch {
                // silently fail
              }
            },
          },
        },
      }
    );

    supabaseClient.auth.onAuthStateChange((event) => {
      if (process.env.NODE_ENV !== "production") {
        if (event === "TOKEN_REFRESHED") {
          console.log("Token atualizado com sucesso");
        } else if (event === "SIGNED_OUT") {
          console.log("Usuario deslogado");
        }
      }
    });
  }
  return supabaseClient;
}
