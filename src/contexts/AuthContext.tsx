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

type AuthView = "login" | "signup" | "reset" | "verify-email" | "email-confirmado" | "reset-password-confirm";

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

    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAccessToken(null);
        setUserId(null);
        setUserName("Usuario");
        setUserEmail("usuario@email.com");
        setIsAuthenticated(false);
        setAuthView("login");
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    try {
      const supabase = getSupabaseClient();

      // Chamar getSession() PRIMEIRO para que o Supabase processe o hash da URL
      // e armazene a sessão em memória/localStorage (detectSessionInUrl: true)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // Se já estamos na página de reset, ela cuida do próprio token.
      // O AuthContext não deve interferir para evitar condição de corrida.
      if (window.location.pathname === "/reset-password-confirm") {
        setLoading(false);
        return;
      }

      // Verificar token de auth tanto no hash (#) quanto nos query params (?)
      // Supabase pode usar qualquer um dos dois dependendo da versão/configuração
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      const tokenType = hashParams.get("type") || queryParams.get("type");
      const tokenFromUrl =
        hashParams.get("access_token") || queryParams.get("access_token") ||
        queryParams.get("token_hash");

      if (tokenFromUrl) {
        // Limpar hash e query params da URL
        window.history.replaceState(null, "", window.location.pathname);

        if (tokenType === "recovery") {
          // Se getSession() ainda não estabeleceu sessão, trocar o token manualmente
          if (!session) {
            await supabase.auth.verifyOtp({
              token_hash: tokenFromUrl,
              type: "recovery",
            });
          }
          setAuthView("reset-password-confirm");
          setLoading(false);
          return;
        } else {
          // Confirmação de email ou signup
          if (!session) {
            const otpType = (tokenType === "signup" || tokenType === "magiclink")
              ? tokenType
              : "email";
            await supabase.auth.verifyOtp({
              token_hash: tokenFromUrl,
              type: otpType,
            });
          }
          setAuthView("email-confirmado");
          setLoading(false);
          return;
        }
      }

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
