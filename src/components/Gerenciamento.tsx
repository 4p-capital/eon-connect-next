"use client";

import { useState, useEffect } from 'react';
import { Users, Shield, Search, Loader2, AlertCircle, Book, Package, BarChart3 } from 'lucide-react';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentacaoAPI } from '@/components/DocumentacaoAPI';
import { PerformanceLogs } from '@/components/PerformanceLogs';
import { GerenciarMateriais } from '@/components/GerenciarMateriais';
import { withRetry } from '@/utils/errorHandler';

interface User {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  idempresa: number;
  nivel_permissao: string;
  created_at: string;
  ativo: boolean;
  menu_assistencia: boolean;
  menu_gerenciamento: boolean;
  menu_cadastro: boolean;
}

export function Gerenciamento() {
  // ✅ Todos os hooks ANTES de qualquer early return
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUser, setUpdatingUser] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');

  // 🔒 Proteção de acesso - Requer permissão menu_gerenciamento
  const { hasPermission, loading: permissionLoading } = usePermissionGuard(
    'menu_gerenciamento'
  );

  // ✅ useEffect DEVE vir ANTES do early return
  useEffect(() => {
    if (hasPermission) {
      fetchUsers();
    }
  }, [hasPermission]);

  // Se não tem permissão, o hook já redirecionou - apenas mostrar loading
  if (permissionLoading || !hasPermission) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#E5E7EB] border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#4B5563]">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Usar withRetry para tentar automaticamente 2 vezes em caso de erro
      const data = await withRetry(async () => {
        // Timeout de 10 segundos no frontend
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/users/all`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao buscar usuários');
        }

        return await response.json();
      }, {
        maxRetries: 2,
        retryDelay: 1500,
      });

      setUsers(data.users || []);
    } catch (err: any) {
      console.error('❌ Erro ao buscar usuários:', err);
      
      // Mensagem amigável baseada no tipo de erro
      if (err.name === 'AbortError') {
        setError('A solicitação demorou muito. O servidor pode estar sobrecarregado.');
      } else {
        setError('Erro ao carregar dados. Tente recarregar a página.');
      }
    } finally {
      setLoading(false);
    }
  };

  const syncAuthUserIds = async () => {
    try {
      setSyncing(true);
      setSyncResult('');

      console.log('🔧 Iniciando sincronização de auth_user_id...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/sync-auth-user-ids`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao sincronizar');
      }

      const result = await response.json();
      console.log('✅ Sincronização concluída:', result);

      setSyncResult(
        `✅ Sincronização concluída!\n` +
        `Total processado: ${result.results.total}\n` +
        `Atualizados: ${result.results.updated}\n` +
        `Não encontrados: ${result.results.notFound}\n` +
        `Erros: ${result.results.errors.length}`
      );

      // Recarregar lista de usuários
      await fetchUsers();
    } catch (err) {
      console.error('❌ Erro na sincronização:', err);
      setSyncResult('❌ Erro ao sincronizar usuários');
    } finally {
      setSyncing(false);
    }
  };

  const updatePermission = async (userId: number, field: string, value: boolean) => {
    try {
      setUpdatingUser(userId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/users/${userId}/permissions`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ [field]: value }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro do servidor:', errorData);
        throw new Error(errorData.error || 'Erro ao atualizar permissão');
      }

      const result = await response.json();
      console.log('✅ Permissão atualizada:', result);

      // Atualizar estado local
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, [field]: value } : user
        )
      );
    } catch (err) {
      console.error('❌ Erro ao atualizar permissão:', err);
      alert(`Erro ao atualizar permissão: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setUpdatingUser(null);
    }
  };

  const filteredUsers = users.filter(user =>
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.cpf.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-black mx-auto mb-4" />
          <p className="text-[#4B5563]">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-[#1B1B1B]">Erro ao carregar dados</h2>
          <p className="text-[#4B5563] mb-6">{error}</p>
          <button
            onClick={fetchUsers}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 pt-6 md:pt-8 pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-black rounded-xl shadow-sm">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#1B1B1B]">Gerenciamento</h1>
              <p className="text-[#4B5563] text-sm">Gerencie usuários e consulte a documentação da API</p>
            </div>
          </div>
          
          {/* Botão de Sincronização (temporário para debug) */}
          <button
            onClick={syncAuthUserIds}
            disabled={syncing}
            className="px-4 py-2 bg-[#F59E0B] hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-sm"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                🔧 Sincronizar Auth IDs
              </>
            )}
          </button>
        </div>
        
        {/* Resultado da Sincronização */}
        {syncResult && (
          <div className={`mb-6 p-4 rounded-xl ${syncResult.includes('✅') ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
            <pre className="text-sm whitespace-pre-wrap">{syncResult}</pre>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4 bg-white p-1.5 h-auto shadow-sm border border-[#E5E7EB] rounded-xl mb-6">
            <TabsTrigger 
              value="usuarios" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-2.5 rounded-lg transition-all duration-200"
            >
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger 
              value="materiais" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-2.5 rounded-lg transition-all duration-200"
            >
              <Package className="h-4 w-4" />
              Materiais
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-2.5 rounded-lg transition-all duration-200"
            >
              <BarChart3 className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger 
              value="documentacao" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-2.5 rounded-lg transition-all duration-200"
            >
              <Book className="h-4 w-4" />
              Documentação
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="usuarios" className="mt-0">
            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Buscar por nome, email ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#F3F3F3] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all duration-150"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm text-gray-600 whitespace-nowrap">Nome</th>
                      <th className="px-6 py-4 text-left text-sm text-gray-600 whitespace-nowrap">Email</th>
                      <th className="px-6 py-4 text-left text-sm text-gray-600 whitespace-nowrap">CPF</th>
                      <th className="px-6 py-4 text-left text-sm text-gray-600 whitespace-nowrap">Telefone</th>
                      <th className="px-6 py-4 text-center text-sm text-gray-600 whitespace-nowrap">Ativo</th>
                      <th className="px-6 py-4 text-center text-sm text-gray-600 whitespace-nowrap">Assistência</th>
                      <th className="px-6 py-4 text-center text-sm text-gray-600 whitespace-nowrap">Gerenciamento</th>
                      <th className="px-6 py-4 text-center text-sm text-gray-600 whitespace-nowrap">Cadastro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">{user.nome.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-[#1B1B1B]">{user.nome}</div>
                              <div className="text-xs text-[#9CA3AF]">{user.nivel_permissao}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#4B5563]">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-[#4B5563]">{user.cpf || '-'}</td>
                        <td className="px-6 py-4 text-sm text-[#4B5563]">{user.telefone || '-'}</td>
                        
                        {/* Toggle Ativo */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => updatePermission(user.id, 'ativo', !user.ativo)}
                              disabled={updatingUser === user.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                user.ativo ? 'bg-[#10B981]' : 'bg-[#E5E7EB]'
                              } ${updatingUser === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  user.ativo ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                        
                        {/* Toggle Assistência */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => updatePermission(user.id, 'menu_assistencia', !user.menu_assistencia)}
                              disabled={updatingUser === user.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                user.menu_assistencia ? 'bg-black' : 'bg-[#E5E7EB]'
                              } ${updatingUser === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  user.menu_assistencia ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                        
                        {/* Toggle Gerenciamento */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => updatePermission(user.id, 'menu_gerenciamento', !user.menu_gerenciamento)}
                              disabled={updatingUser === user.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                user.menu_gerenciamento ? 'bg-black' : 'bg-[#E5E7EB]'
                              } ${updatingUser === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  user.menu_gerenciamento ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                        
                        {/* Toggle Cadastro */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => updatePermission(user.id, 'menu_cadastro', !user.menu_cadastro)}
                              disabled={updatingUser === user.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                user.menu_cadastro ? 'bg-black' : 'bg-[#E5E7EB]'
                              } ${updatingUser === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  user.menu_cadastro ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-[#9CA3AF] mx-auto mb-4" />
                  <p className="text-[#4B5563]">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4">
                <div className="text-sm text-[#4B5563]">Total de Usuários</div>
                <div className="text-2xl font-semibold text-[#1B1B1B] mt-1">{users.length}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4">
                <div className="text-sm text-[#4B5563]">Usuários Ativos</div>
                <div className="text-2xl font-semibold text-[#10B981] mt-1">
                  {users.filter(u => u.ativo).length}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4">
                <div className="text-sm text-[#4B5563]">Com Assistência</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">
                  {users.filter(u => u.menu_assistencia && u.ativo).length}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-sm">
                <div className="text-sm text-[#4B5563]">Com Gerenciamento</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">
                  {users.filter(u => u.menu_gerenciamento && u.ativo).length}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-sm">
                <div className="text-sm text-[#4B5563]">Com Cadastro</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">
                  {users.filter(u => u.menu_cadastro && u.ativo).length}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Materiais Tab */}
          <TabsContent value="materiais">
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 text-[#1B1B1B]">Catálogo de Materiais</h2>
                <p className="text-[#4B5563]">
                  Gerencie o catálogo de materiais utilizados nos reparos de assistência técnica. 
                  Você pode adicionar, editar ou remover materiais conforme necessário.
                </p>
              </div>
              <GerenciarMateriais 
                aberto={true} 
                aoFechar={() => {}} 
                aoAtualizar={() => console.log('Materiais atualizados')} 
                modoEmbutido={true}
              />
            </div>
          </TabsContent>

          {/* Performance Logs */}
          <TabsContent value="performance">
            <PerformanceLogs />
          </TabsContent>

          {/* Documentação API */}
          <TabsContent value="documentacao">
            <DocumentacaoAPI />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}