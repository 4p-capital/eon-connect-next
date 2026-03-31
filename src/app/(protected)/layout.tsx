"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { DndProviderSingleton } from "@/components/DndProviderSingleton";
import { UserProvider } from "@/contexts/UserContext";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { WhatsAppStatusAlert } from "@/components/WhatsAppStatusAlert";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Login } from "@/components/Login";
import { SignUp } from "@/components/SignUp";
import { ResetPassword } from "@/components/ResetPassword";
import { VerifiqueEmail } from "@/components/VerifiqueEmail";
import { EmailConfirmado } from "@/components/EmailConfirmado";
import eonLogo from "@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png";
import Image from "next/image";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isAuthenticated,
    userId,
    loading,
    authView,
    verifyEmail,
    login,
    logout,
    setAuthView,
    setVerifyEmail,
    handleWaitingPermission,
  } = useAuth();

  const router = useRouter();
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Tela de carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Image
            src={eonLogo}
            alt="EON"
            className="h-12 mb-8 mx-auto animate-pulse"
            width={48}
            height={48}
          />
          <div className="w-12 h-12 border-3 border-[#E5E7EB] border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#9CA3AF]">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se nao estiver autenticado, mostrar telas de autenticacao
  if (!isAuthenticated) {
    if (authView === "login") {
      return (
        <Login
          onLogin={(token, id, name) => {
            login(token, id, name);
            router.push("/");
          }}
          onNavigateToSignUp={() => setAuthView("signup")}
          onNavigateToReset={() => setAuthView("reset")}
          onWaitingPermission={handleWaitingPermission}
        />
      );
    }

    if (authView === "signup") {
      return (
        <SignUp
          onSignUpSuccess={() => setAuthView("login")}
          onNavigateToLogin={() => setAuthView("login")}
          onNavigateToVerifyEmail={(email: string) => {
            setVerifyEmail(email);
            setAuthView("verify-email");
          }}
        />
      );
    }

    if (authView === "reset") {
      return (
        <ResetPassword onNavigateToLogin={() => setAuthView("login")} />
      );
    }

    if (authView === "verify-email") {
      return (
        <VerifiqueEmail
          onNavigateToLogin={() => setAuthView("login")}
          email={verifyEmail}
        />
      );
    }

    if (authView === "email-confirmado") {
      return (
        <EmailConfirmado onNavigateToLogin={() => setAuthView("login")} />
      );
    }

    // Fallback
    return (
      <Login
        onLogin={(token, id, name) => {
          login(token, id, name);
          router.push("/");
        }}
        onNavigateToSignUp={() => setAuthView("signup")}
        onNavigateToReset={() => setAuthView("reset")}
        onWaitingPermission={handleWaitingPermission}
      />
    );
  }

  // Autenticado: Renderizar interface principal
  return (
    <DndProviderSingleton>
      {userId && <WhatsAppStatusAlert />}

      {userId && (
        <UserProvider authUuid={userId}>
          <TopBar sidebarWidth={sidebarWidth} />
          <Sidebar onWidthChange={setSidebarWidth} />

          <div
            className="min-h-screen transition-all duration-300 md:pt-16 overflow-hidden"
            style={{ marginLeft: isMobile ? "0" : `${sidebarWidth}px` }}
          >
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </UserProvider>
      )}
    </DndProviderSingleton>
  );
}
