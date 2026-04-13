"use client";

import { useState, useEffect } from 'react';
import {
  Wrench, Menu, X, ChevronLeft, ChevronDown, LogOut, Users,
  FolderOpen, LayoutDashboard, MessageCircle, Sparkles, UserCircle, FileText, Bell, Users2, List, BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, usePathname } from 'next/navigation';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import type { LucideIcon } from 'lucide-react';

interface SubMenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  visible: boolean;
  children?: SubMenuItem[];
}

interface SidebarProps {
  onWidthChange?: (width: number) => void;
}

export function Sidebar({ onWidthChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { userData, loading } = useUser();
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const currentRoute = (() => {
    if (pathname === '/') return 'home';
    return pathname.substring(1);
  })();

  // Auto-expand parent menu when a child route is active
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => currentRoute === child.id);
        if (hasActiveChild && !expandedMenus.includes(item.id)) {
          setExpandedMenus((prev) => [...prev, item.id]);
        }
      }
    });
  }, [currentRoute]);

  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(isExpanded ? 280 : 80);
    }
  }, [isExpanded, onWidthChange]);

  const handleNavigate = (route: string) => {
    if (route === 'logout') {
      logout().then(() => router.push('/'));
      setIsMobileOpen(false);
      return;
    }
    const path = route === 'home' ? '/' : `/${route}`;
    router.push(path);
    setIsMobileOpen(false);
  };

  const toggleSubmenu = (id: string) => {
    setExpandedMenus((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const menuItems: MenuItem[] = [
    {
      id: 'home',
      icon: LayoutDashboard,
      label: 'Início',
      visible: true,
    },
    {
      id: 'assistencia',
      icon: Wrench,
      label: 'Assistência',
      visible: userData?.menu_assistencia === true,
      children: [
        {
          id: 'gerenciamento-assistencia',
          icon: Wrench,
          label: 'Gerenciar',
        },
        {
          id: 'whatsapp-chats',
          icon: MessageCircle,
          label: 'WhatsApp',
        },
        {
          id: 'termos-assistencia',
          icon: FileText,
          label: 'Termos',
        },
      ],
    },
    {
      id: 'gestao',
      icon: FolderOpen,
      label: 'Cadastros',
      visible: userData?.menu_cadastro === true,
      children: [
        {
          id: 'cadastros',
          icon: FolderOpen,
          label: 'Cadastros',
        },
        {
          id: 'clientes',
          icon: UserCircle,
          label: 'Clientes',
        },
      ],
    },
    {
      id: 'notificacoes-fornecedor',
      icon: Bell,
      label: 'Notificações',
      visible: userData?.menu_notificacoes === true,
      children: [
        {
          id: 'notificacoes-fornecedor',
          icon: List,
          label: 'Pedidos',
        },
        {
          id: 'notificacoes-fornecedor/historico',
          icon: BarChart3,
          label: 'Histórico Fornecedores',
        },
        {
          id: 'notificacoes-fornecedor/historico-grupos',
          icon: BarChart3,
          label: 'Histórico Grupos',
        },
        {
          id: 'notificacoes-fornecedor/grupos',
          icon: Users2,
          label: 'Cadastro de Grupos',
        },
      ],
    },
    {
      id: 'gerenciamento',
      icon: Users,
      label: 'Gerenciamento',
      visible: userData?.menu_gerenciamento === true,
    },
  ].filter(item => item.visible);

  const isRouteActive = (id: string) => currentRoute === id;

  const isParentActive = (item: MenuItem) => {
    if (item.children) {
      return item.children.some((child) => currentRoute === child.id) || currentRoute === item.id;
    }
    return currentRoute === item.id;
  };

  // ── Render menu item (shared between desktop & mobile) ──

  const renderMenuItem = (item: MenuItem, isMobile: boolean) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = expandedMenus.includes(item.id);
    const isActive = !hasChildren && isRouteActive(item.id);
    const isParent = hasChildren && isParentActive(item);

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              if (!isExpanded && !isMobile) {
                setIsExpanded(true);
                if (!isOpen) toggleSubmenu(item.id);
              } else {
                toggleSubmenu(item.id);
              }
            } else {
              handleNavigate(item.id);
            }
          }}
          title={!isExpanded && !isMobile ? item.label : undefined}
          className={`group relative w-full flex items-center ${
            isExpanded || isMobile ? 'px-3' : 'justify-center px-0'
          } py-2.5 text-sm font-medium transition-all rounded-lg
          ${isActive || isParent
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          {(isActive || isParent) && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-black rounded-r-full" />
          )}

          <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${
            isActive || isParent ? 'text-black' : 'text-gray-500 group-hover:text-gray-700'
          }`} />

          {(isExpanded || isMobile) && (
            <>
              <span className="ml-3 whitespace-nowrap overflow-hidden flex-1 text-left">
                {item.label}
              </span>
              {hasChildren && (
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </>
          )}
        </button>

        {/* Submenu */}
        {hasChildren && (isExpanded || isMobile) && (
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="ml-4 pl-4 border-l border-gray-200 mt-1 space-y-0.5">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = isRouteActive(child.id);

                    return (
                      <button
                        key={child.id}
                        onClick={() => handleNavigate(child.id)}
                        className={`group relative w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all rounded-lg
                        ${isChildActive
                          ? 'text-gray-900 bg-gray-100'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <ChildIcon className={`h-4 w-4 flex-shrink-0 ${isChildActive ? 'text-black' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        <span>{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="hidden md:flex fixed top-0 left-0 bottom-0 w-20 bg-white border-r border-gray-200 z-40 items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        aria-label={isMobileOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
        aria-expanded={isMobileOpen}
        aria-controls="mobile-sidebar"
      >
        {isMobileOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            id="mobile-sidebar"
            role="navigation"
            aria-label="Menu principal"
            className="md:hidden fixed top-0 left-0 bottom-0 w-80 bg-white z-50 flex flex-col shadow-xl"
          >
            <div className="h-16 flex items-center px-6 border-b border-gray-200">
              <img src={typeof eonLogo === "string" ? eonLogo : eonLogo.src} alt="EON" className="h-8" />
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {menuItems.map((item) => renderMenuItem(item, true))}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => handleNavigate('logout')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isExpanded ? 280 : 80 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        role="navigation"
        aria-label="Menu principal"
        className="hidden md:flex fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 z-40 flex-col"
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200 relative">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center px-6 w-full"
              >
                <img src={typeof eonLogo === "string" ? eonLogo : eonLogo.src} alt="EON" className="h-8" />
              </motion.div>
            ) : (
              <motion.div
                key="collapsed-logo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center justify-center"
              >
                <img src={typeof eonLogo === "string" ? eonLogo : eonLogo.src} alt="EON" className="h-6" />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute -right-4 top-20 w-8 h-8 bg-black rounded-full shadow-md flex items-center justify-center text-white hover:bg-gray-800 transition-all z-50"
            aria-label={isExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${!isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {menuItems.map((item) => renderMenuItem(item, false))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => handleNavigate('logout')}
            className={`w-full flex items-center ${isExpanded ? 'px-3' : 'justify-center'} py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors group`}
            title={!isExpanded ? "Sair" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {isExpanded && (
              <span className="ml-3 whitespace-nowrap">Sair</span>
            )}
          </button>

          {isExpanded && (
            <div className="mt-4 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-gray-900" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-gray-900">EON Connect</span>
                <span className="text-[10px] text-gray-500">Versão 2.0.0</span>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
