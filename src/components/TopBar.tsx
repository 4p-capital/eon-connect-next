"use client";

import { useState, useEffect } from 'react';
import { User, Calendar, Clock, ChevronDown, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopBarProps {
  sidebarWidth?: number;
}

export function TopBar({ sidebarWidth = 280 }: TopBarProps) {
  const { userName, userEmail, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Derivar currentRoute do pathname
  const currentRoute = (() => {
    if (pathname === '/') return 'home';
    return pathname.substring(1);
  })();

  // Atualiza a cada 60s (minuto) em vez de 1s — evita 86.400 re-renders/dia
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const moduleNames: { [key: string]: string } = {
    'gerenciamento-assistencia': 'Assistência Técnica',
    'solicitacao-assistencia-tecnica': 'Nova Solicitação',
    'gerenciamento': 'Gerenciamento',
    'cadastros': 'Cadastros',
    'whatsapp-chats': 'WhatsApp',
    'home': 'Dashboard'
  };

  const displayModuleName = moduleNames[currentRoute] || 'EON Connect';

  // Obter iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    logout().then(() => router.push('/'));
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="hidden md:flex fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-30 items-center justify-between px-8 transition-all duration-300 shadow-sm"
      style={{ left: `${sidebarWidth}px` }}
    >
      {/* Left Section - Module Name */}
      <div className="flex flex-col justify-center">
        <h1 className="text-lg font-semibold text-gray-900 leading-tight">
          {displayModuleName}
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>EON Connect</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span className="capitalize">{formatDate(currentDateTime).split(',')[0]}</span>
        </div>
      </div>

      {/* Right Section - Actions & Profile */}
      <div className="flex items-center gap-6">
        {/* Date & Time - Minimalist */}
        <div className="hidden xl:flex items-center gap-4 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>
              {formatDate(currentDateTime).split(',')[1]?.trim()}
            </span>
          </div>
          <div className="w-px h-3 bg-gray-300" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-mono">
              {formatTime(currentDateTime)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Notifications (Optional placeholder) */}
        <button
          className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-50"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" aria-hidden="true" />
          <span className="sr-only">Notificações pendentes</span>
        </button>

        {/* User Profile Dropdown */}
        <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 pl-2 pr-1 py-1 hover:bg-gray-50 rounded-lg transition-all focus:outline-none group"
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-900 group-hover:bg-gray-200 transition-colors">
                  <span className="text-sm font-semibold">
                    {getInitials(userName)}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              </div>

              {/* User Info */}
              <div className="hidden lg:flex flex-col items-start mr-1">
                <span className="text-sm font-medium text-gray-900 leading-tight">
                  {userName.split(' ')[0]}
                </span>
              </div>

              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-1 bg-white border border-gray-200 shadow-xl rounded-xl">
            {/* Header do dropdown */}
            <div className="px-3 py-3 border-b border-gray-100 mb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-900 font-bold">
                  {getInitials(userName)}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium text-gray-900 text-sm truncate">{userName}</span>
                  <span className="text-xs text-gray-500 truncate">{userEmail}</span>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="px-1 py-1 space-y-0.5">
              <DropdownMenuItem className="cursor-not-allowed text-gray-400" disabled>
                <User className="w-4 h-4 mr-2" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="cursor-not-allowed text-gray-400" disabled>
                <SettingsIcon className="w-4 h-4 mr-2" />
                <span>Configurações</span>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className="bg-gray-100 my-1" />

            {/* Sair */}
            <div className="px-1 py-1">
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                onClick={handleLogout}
              >
                <LogOutIcon className="w-4 h-4 mr-2" />
                Sair do Sistema
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}

function LogOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
