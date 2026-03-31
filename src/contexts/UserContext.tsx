"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/utils/supabase/client";
import { apiBaseUrl, publicAnonKey } from "@/utils/supabase/info";
import { withRetry } from "@/utils/errorHandler";

export interface UserData {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  menu_assistencia: boolean;
  menu_gerenciamento: boolean;
  menu_planejamento: boolean;
  menu_cadastro: boolean;
}

interface UserContextType {
  userData: UserData | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  authUuid,
  children,
}: {
  authUuid: string;
  children: ReactNode;
}) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchUserData = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        const email = authData?.user?.email;

        const result = await withRetry(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const url = new URL(`${apiBaseUrl}/users/me`);
          url.searchParams.append("authUuid", authUuid);
          if (email) {
            url.searchParams.append("email", email);
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Erro ao buscar usuario");
          }

          return await response.json();
        }, {
          maxRetries: 2,
          retryDelay: 1500,
        });

        if (!cancelled) {
          setUserData(result.user ?? null);
          setLoading(false);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          if (process.env.NODE_ENV !== "production") {
            const message = error instanceof Error ? error.message : "Erro desconhecido";
            console.error("UserContext: Erro ao buscar dados:", message);
          }
          setUserData(null);
          setLoading(false);
        }
      }
    };

    fetchUserData();

    return () => {
      cancelled = true;
    };
  }, [authUuid]);

  const value = useMemo<UserContextType>(
    () => ({ userData, loading }),
    [userData, loading]
  );

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser deve ser usado dentro de UserProvider");
  }
  return context;
}
