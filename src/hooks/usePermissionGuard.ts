'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

type PermissionType = 'menu_assistencia' | 'menu_gerenciamento' | 'menu_planejamento' | 'menu_cadastro' | 'menu_notificacoes';

/**
 * Hook para proteger páginas baseado em permissões
 * Redireciona para home se o usuário não tiver a permissão necessária
 */
export function usePermissionGuard(requiredPermission: PermissionType) {
  const { userData, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Aguardar o carregamento dos dados
    if (loading) return;

    // Se não tem os dados do usuário ou não tem a permissão, redirecionar
    if (!userData || !userData[requiredPermission]) {
      console.log(`🚫 Acesso negado: Permissão "${requiredPermission}" não concedida. Redirecionando para home...`);
      router.push('/');
    }
  }, [userData, loading, requiredPermission, router]);

  return {
    hasPermission: userData?.[requiredPermission] || false,
    loading
  };
}
