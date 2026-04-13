"use client";

import { Wrench, Clock, Shield, Sparkles, ArrowRight, Users, FolderOpen, AlertCircle, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'motion/react';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';

export function Home() {
  const { userData, loading } = useUser();
  const { userName } = useAuth();
  const router = useRouter();

  const onNavigate = (route: string) => {
    const path = route === 'home' ? '/' : `/${route}`;
    router.push(path);
  };

  // Verificar se tem alguma permissão
  const hasAnyPermission = userData && (
    userData.menu_assistencia ||
    userData.menu_gerenciamento ||
    userData.menu_cadastro ||
    userData.menu_notificacoes
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <img
            src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
            alt="EON"
            className="h-10 mx-auto mb-4 animate-pulse opacity-50"
          />
        </div>
      </div>
    );
  }

  // Se não tem nenhuma permissão: Aguardando Permissão
  if (!hasAnyPermission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-xl"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>

              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Aguardando Permissões
              </h1>
              <p className="text-gray-600">
                Olá, <span className="font-medium text-gray-900">{userName}</span>
              </p>
              <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                Seu cadastro foi realizado, mas você precisa de permissão de um administrador para acessar os módulos.
              </p>
            </div>

            <div className="p-6 bg-gray-50/50 space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Acesso Restrito</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Entre em contato com o gestor do sistema para solicitar liberação.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900">O que fazer?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Aguarde a notificação de liberação ou contate o suporte.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">ID do Usuário: {String(userData?.id).slice(0, 8)}</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Se tem permissões: Boas-vindas com módulos disponíveis
  const availableModules = [
    {
      id: 'assistencia',
      title: 'Assistência Técnica',
      description: 'Gestão de chamados e manutenções',
      icon: Wrench,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
      route: 'gerenciamento-assistencia',
      enabled: userData?.menu_assistencia || false
    },
    {
      id: 'cadastros',
      title: 'Cadastros',
      description: 'Gestão de clientes e fornecedores',
      icon: FolderOpen,
      iconColor: 'text-gray-900',
      iconBg: 'bg-gray-100',
      route: 'cadastros',
      enabled: userData?.menu_cadastro || false
    },
    {
      id: 'notificacoes',
      title: 'Notificações',
      description: 'Pedidos aprovados e notificações para fornecedores',
      icon: Bell,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      route: 'notificacoes-fornecedor',
      enabled: userData?.menu_notificacoes || false
    },
    {
      id: 'gerenciamento',
      title: 'Gerenciamento',
      description: 'Administração do sistema e usuários',
      icon: Users,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      route: 'gerenciamento',
      enabled: userData?.menu_gerenciamento || false
    }
  ];

  const enabledModules = availableModules.filter(m => m.enabled);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Header Section */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-gray-200 shadow-sm mb-4">
            <Sparkles className="h-3.5 w-3.5 text-gray-900" />
            <span className="text-xs font-medium text-gray-600">Bem-vindo ao EON Connect</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Painel de Controle
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Selecione um módulo abaixo para iniciar suas atividades de gestão.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {enabledModules.map((module, index) => {
            const Icon = module.icon;
            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="group relative overflow-hidden bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 cursor-pointer h-full"
                  onClick={() => onNavigate(module.route)}
                >
                  <CardContent className="p-8 flex flex-col h-full">
                    <div className={`w-14 h-14 ${module.iconBg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`h-7 w-7 ${module.iconColor}`} />
                    </div>

                    <div className="space-y-2 mb-6 flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-black transition-colors">
                        {module.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {module.description}
                      </p>
                    </div>

                    <div className="flex items-center text-sm font-medium text-gray-900 group-hover:text-black">
                      Acessar módulo
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="pt-12 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} EON Connect - Versão 2.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
