'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

/**
 * Hook para proteger páginas baseado em permissões.
 * Aceita dot-notation (ex: "entregas.santorini.pendencias") ou chave de menu ("gerenciamento").
 * Redireciona para home se o usuário não tiver a permissão necessária.
 */
export function usePermissionGuard(requiredPermission: string) {
  const { userData, loading, hasPermission } = useUser();
  const router = useRouter();

  const allowed = hasPermission(requiredPermission);

  useEffect(() => {
    if (loading) return;
    if (!userData || !allowed) {
      console.log(`🚫 Acesso negado: "${requiredPermission}". Redirecionando para home...`);
      router.push('/');
    }
  }, [userData, loading, allowed, requiredPermission, router]);

  return {
    hasPermission: allowed,
    loading,
  };
}
