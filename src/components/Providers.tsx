"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { HashRedirectHandler } from "@/components/HashRedirectHandler";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Toaster />
        <HashRedirectHandler />
        {children}
      </ErrorBoundary>
    </AuthProvider>
  );
}
