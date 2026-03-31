"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/utils/supabase/client";
import { apiBaseUrl, publicAnonKey } from "@/utils/supabase/info";

type AuthView = "login" | "signup" | "reset" | "verify-email" | "email-confirmado";

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  userName: string;
  userEmail: string;
  accessToken: string | null;
  loading: boolean;
  authView: AuthView;
  verifyEmail: string;
  login: (token: string, id: string, name: string, email?: string) => void;
  logout: () => Promise<void>;
  setAuthView: (view: AuthView) => void;
  setVerifyEmail: (email: string) => void;
  handleWaitingPermission: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Usuario");
  const [userEmail, setUserEmail] = useState<string>("usuario@email.com");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [verifyEmail, setVerifyEmail] = useState("");

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    try {
      const supabase = getSupabaseClient();

      // Verificar tokens de autenticacao no hash (callback do Supabase)
      const hashParams = new URLSearchParams(
        window.location.hash.substring(1)
      );
      const hashType = hashParams.get("type");
      const accessTokenFromHash = hashParams.get("access_token");

      if (accessTokenFromHash) {
        window.history.replaceState(null, "", window.location.pathname);

        if (hashType === "recovery") {
          setLoading(false);
          window.location.replace("/reset-password-confirm");
          return;
        } else {
          setAuthView("email-confirmado");
          setLoading(false);
          return;
        }
      }

      // Verificar sessao ativa
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        if (
          sessionError.message?.includes("refresh") ||
          sessionError.message?.includes("Refresh Token") ||
          sessionError.message?.includes("Invalid Refresh Token")
        ) {
          await supabase.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
        }

        setLoading(false);
        return;
      }

      if (session?.access_token && session?.user?.id) {
        setAccessToken(session.access_token);
        setUserId(session.user.id);

        // Buscar nome do usuario do backend
        try {
          const response = await fetch(
            `${apiBaseUrl}/user/${session.user.id}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${publicAnonKey}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            setUserName(data.user.nome);
            setUserEmail(data.user.email);
          } else {
            setUserName(session.user.email || "Usuario");
            setUserEmail(session.user.email || "usuario@email.com");
          }
        } catch {
          setUserName(session.user.email || "Usuario");
          setUserEmail(session.user.email || "usuario@email.com");
        }

        setIsAuthenticated(true);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";

      if (
        message.includes("refresh") ||
        message.includes("Refresh Token") ||
        message.includes("Invalid Refresh Token")
      ) {
        try {
          const supabase = getSupabaseClient();
          await supabase.auth.signOut();
        } catch {
          // silently fail
        }
        localStorage.clear();
        sessionStorage.clear();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(
    (token: string, id: string, name: string, email?: string) => {
      setAccessToken(token);
      setUserId(id);
      setUserName(name);
      if (email) setUserEmail(email);
      setIsAuthenticated(true);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();

      setAccessToken(null);
      setUserId(null);
      setUserName("Usuario");
      setUserEmail("usuario@email.com");
      setIsAuthenticated(false);
      setAuthView("login");
    } catch (err) {
      console.error("AuthContext: Erro ao fazer logout:", err);
    }
  }, []);

  const handleWaitingPermission = useCallback(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUserId = localStorage.getItem("user_id");
    const storedUserName = localStorage.getItem("user_name");

    if (storedToken && storedUserId && storedUserName) {
      setAccessToken(storedToken);
      setUserId(storedUserId);
      setUserName(storedUserName);
      setIsAuthenticated(true);
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      userId,
      userName,
      userEmail,
      accessToken,
      loading,
      authView,
      verifyEmail,
      login,
      logout,
      setAuthView,
      setVerifyEmail,
      handleWaitingPermission,
    }),
    [
      isAuthenticated,
      userId,
      userName,
      userEmail,
      accessToken,
      loading,
      authView,
      verifyEmail,
      login,
      logout,
      handleWaitingPermission,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
