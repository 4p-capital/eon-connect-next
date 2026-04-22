"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Send, MessageCircle, Phone, Clock, CheckCheck, Filter, X, AlertCircle } from 'lucide-react';
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";
import { Alert, AlertDescription } from '@/components/ui/alert';

// 🎨 Mapeamento de cores para empreendimentos
const CORES_EMPREENDIMENTO: Record<string, { bg: string; text: string }> = {
  'Portas ou Janelas': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Elétrica': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Hidráulica': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  'Acabamento': { bg: 'bg-pink-100', text: 'text-pink-700' },
  'Pintura': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'Piso': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Telhado': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Estrutura': { bg: 'bg-slate-100', text: 'text-slate-700' },
  'Outros': { bg: 'bg-gray-100', text: 'text-gray-700' },
};

// 🎨 Cores do Kanban (mesmas do sistema principal)
const CORES_STATUS_KANBAN: Record<string, { bg: string; text: string }> = {
  'Abertos': { bg: 'bg-sky-100', text: 'text-[#0091FF]' },
  'Vistoria agendada': { bg: 'bg-orange-100', text: 'text-[#FF9100]' },
  'Reparo agendado': { bg: 'bg-gray-100', text: 'text-gray-900' },
  'Aguardando assinatura': { bg: 'bg-emerald-100', text: 'text-[#06BF00]' },
};

// Função auxiliar para obter cor do empreendimento
const getCorEmpreendimento = (empreendimento: string) => {
  return CORES_EMPREENDIMENTO[empreendimento] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

// Função auxiliar para obter cor do status
const getCorStatus = (status: string) => {
  return CORES_STATUS_KANBAN[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

interface Contact {
  phone_e164: string;
  display_name: string | null;
}

interface LastMessage {
  body: string;
  type: string;
  direction: 'in' | 'out';
  created_at: string;
}

interface Assistencia {
  proprietario: string;
  empreendimento: string;
  categoria_reparo: string;
  status_chamado: string;
}

interface Conversation {
  id: number;
  contact_id: number;
  id_assistencia: number | null;
  status: string;
  last_message_at: string;
  contact: Contact;
  last_message: LastMessage | null;
  unread_count: number;
  assistencia: Assistencia | null;
}

interface Message {
  id: number;
  conversation_id: number;
  direction: 'in' | 'out';
  from_phone: string | null;
  to_phone: string | null;
  type: string;
  body: string;
  media_url: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  read_at: string | null;
}

// Novo: Interface para contato agrupado
interface GroupedContact {
  phone_e164: string;
  display_name: string | null;
  conversations: Conversation[];
  total_unread: number;
  last_message_at: string;
  last_message: LastMessage | null;
  latest_assistencia: Assistencia | null;
}

export function WhatsAppChats() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupedContacts, setGroupedContacts] = useState<GroupedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<GroupedContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'active' | 'finished'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const conversationsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para verificar se está no final da conversa
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    // Considerar "no final" se estiver a menos de 100px do bottom
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Listener para detectar quando usuário scrola
  const handleScroll = () => {
    setShouldAutoScroll(isAtBottom());
  };

  const scrollToBottom = () => {
    // Só fazer scroll automático se o usuário estava no final
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 🚀 OTIMIZAÇÃO: Carregar conversas com controle de visibilidade da página
  useEffect(() => {
    loadConversations();

    // ⚡ INTERVALO AUMENTADO: 60 segundos (antes era 30s) para reduzir carga
    const setupPolling = () => {
      if (conversationsIntervalRef.current) {
        clearInterval(conversationsIntervalRef.current);
      }
      conversationsIntervalRef.current = setInterval(loadConversations, 60000);
    };

    // Pausar polling quando aba não está visível
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⏸️ Aba inativa - pausando polling de conversas');
        if (conversationsIntervalRef.current) {
          clearInterval(conversationsIntervalRef.current);
          conversationsIntervalRef.current = null;
        }
      } else {
        console.log('▶️ Aba ativa - retomando polling de conversas');
        loadConversations(); // Atualizar imediatamente
        setupPolling();
      }
    };

    setupPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (conversationsIntervalRef.current) {
        clearInterval(conversationsIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🚀 OTIMIZAÇÃO: Recarregar mensagens com intervalo maior e controle de visibilidade
  useEffect(() => {
    if (selectedContact) {
      loadAllMessagesForContact(selectedContact);
      markAllAsRead(selectedContact);

      // ⚡ INTERVALO AUMENTADO: 30 segundos (antes era 10s) para reduzir carga
      const setupMessagesPolling = () => {
        if (messagesIntervalRef.current) {
          clearInterval(messagesIntervalRef.current);
        }
        messagesIntervalRef.current = setInterval(() => {
          if (!document.hidden) { // Só buscar se aba estiver visível
            loadAllMessagesForContact(selectedContact);
          }
        }, 30000);
      };

      setupMessagesPolling();

      return () => {
        if (messagesIntervalRef.current) {
          clearInterval(messagesIntervalRef.current);
          messagesIntervalRef.current = null;
        }
      };
    }
  }, [selectedContact]);

  const loadConversations = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/whatsapp/conversations?status=all`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('❌ Erro na resposta do servidor:', errorData);
        setError('As tabelas do WhatsApp não foram configuradas ainda. Consulte o arquivo INSTRUCOES_WHATSAPP_SETUP.md para criar as tabelas necessárias.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setConversations(data.data || []);
      setError(null); // Limpar erro se carregar com sucesso
    } catch (error: any) {
      console.error('❌ Erro ao carregar conversas:', error);
      if (error.message?.includes('fetch')) {
        setError('Não foi possível conectar ao servidor. Verifique se o servidor Supabase está ativo e se as tabelas do WhatsApp foram criadas.');
      } else {
        setError(`Erro ao conectar: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/whatsapp/conversations/${conversationId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      } else {
        console.error('❌ Erro ao buscar mensagens:', response.status, response.statusText);
        return [];
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar mensagens:', error);
      // Não setar erro global aqui para não sobrescrever outros erros
      return [];
    }
  };

  // Nova função: carregar mensagens de TODAS as conversas do contato
  const loadAllMessagesForContact = async (contact: GroupedContact) => {
    try {
      // Buscar mensagens de todas as conversas
      const allMessagesPromises = contact.conversations.map(conv => loadMessages(conv.id));
      const allMessagesArrays = await Promise.all(allMessagesPromises);

      // Combinar todas as mensagens
      const allMessages = allMessagesArrays.flat();

      // Ordenar por data de criação
      allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setMessages(allMessages);
    } catch (error) {
      console.error('Erro ao carregar mensagens do contato:', error);
      setError('Erro ao carregar mensagens do contato');
    }
  };

  const markAsRead = async (conversationId: number) => {
    try {
      await fetch(
        `${apiBaseUrl}/whatsapp/conversations/${conversationId}/mark-read`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
      setError('Erro ao marcar como lido');
    }
  };

  // Nova função: marcar todas as conversas do contato como lidas
  const markAllAsRead = async (contact: GroupedContact) => {
    try {
      await Promise.all(contact.conversations.map(conv => markAsRead(conv.id)));
      // Recarregar conversas para atualizar contadores
      loadConversations();
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
      setError('Erro ao marcar como lido');
    }
  };

  const sendMessage = async () => {
    if (!selectedContact || !newMessage.trim()) return;

    setSending(true);
    try {
      // Enviar para a conversa mais recente (primeira da lista)
      const response = await fetch(
        `${apiBaseUrl}/whatsapp/conversations/${selectedContact.conversations[0].id}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            message: newMessage,
            type: 'text',
          }),
        }
      );

      if (response.ok) {
        setNewMessage('');
        // Recarregar todas as mensagens do contato
        loadAllMessagesForContact(selectedContact);
        loadConversations();
      } else {
        const error = await response.json();
        alert(`Erro ao enviar: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return `há cerca de ${Math.floor(diffInHours)} horas`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `há ${diffInDays} dia${diffInDays > 1 ? 's' : ''}`;
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getFilteredConversations = () => {
    let filtered = conversations;

    // Filtrar por status
    if (activeFilter === 'unread') {
      filtered = filtered.filter(c => c.unread_count > 0);
    } else if (activeFilter === 'active') {
      filtered = filtered.filter(c => c.status === 'open' && c.unread_count === 0);
    } else if (activeFilter === 'finished') {
      filtered = filtered.filter(c => c.status === 'closed');
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      // Normalizar números: remover caracteres especiais para busca de telefone
      const queryDigitsOnly = query.replace(/\D/g, '');

      filtered = filtered.filter(
        c => {
          // Busca por nome
          const matchName = c.contact.display_name?.toLowerCase().includes(query);
          const matchProprietario = c.assistencia?.proprietario?.toLowerCase().includes(query);

          // Busca por telefone (comparar apenas dígitos)
          const phoneDigitsOnly = c.contact.phone_e164.replace(/\D/g, '');
          const matchPhone = phoneDigitsOnly.includes(queryDigitsOnly);

          return matchName || matchPhone || matchProprietario;
        }
      );
    }

    return filtered;
  };

  const getTotalUnread = () => {
    return conversations.reduce((total, conv) => total + conv.unread_count, 0);
  };

  // Agrupar conversas por contato APLICANDO OS FILTROS
  useEffect(() => {
    // Primeiro aplicar filtros
    const filtered = getFilteredConversations();

    // Depois agrupar
    const grouped: GroupedContact[] = filtered.reduce((acc, conv) => {
      const existing = acc.find(c => c.phone_e164 === conv.contact.phone_e164);
      if (existing) {
        existing.conversations.push(conv);
        existing.total_unread += conv.unread_count;
        if (new Date(conv.last_message_at) > new Date(existing.last_message_at)) {
          existing.last_message_at = conv.last_message_at;
          existing.last_message = conv.last_message;
          existing.latest_assistencia = conv.assistencia;
        }
      } else {
        acc.push({
          phone_e164: conv.contact.phone_e164,
          display_name: conv.contact.display_name,
          conversations: [conv],
          total_unread: conv.unread_count,
          last_message_at: conv.last_message_at,
          last_message: conv.last_message,
          latest_assistencia: conv.assistencia,
        });
      }
      return acc;
    }, [] as GroupedContact[]);

    // Ordenar por última mensagem (mais recente primeiro)
    grouped.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    setGroupedContacts(grouped);
  }, [conversations, activeFilter, searchQuery]);

  const filteredConversations = getFilteredConversations();
  const totalUnread = getTotalUnread();

  return (
    <div className="h-screen flex bg-[#F9FAFB]">
      {/* Sidebar Esquerda */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-xl">
              <MessageCircle className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">WhatsApp Chat</h1>
              <p className="text-xs text-gray-500 mt-0.5">Gerenciamento de Conversas</p>
            </div>
          </div>
        </div>

        {/* Menu Navegação */}
        <div className="p-4 border-b border-gray-200 space-y-2 text-sm">
          <button className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#F3F3F3] text-gray-700 font-medium rounded-xl border border-gray-200 transition-all duration-150 hover:bg-gray-100">
            <MessageCircle className="h-4 w-4 text-gray-900" />
            <span>Caixa de Entrada</span>
            {totalUnread > 0 && (
              <span className="ml-auto bg-[#EF4444] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {totalUnread}
              </span>
            )}
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 bg-black text-white font-medium rounded-xl shadow-sm transition-all duration-150">
            <MessageCircle className="h-4 w-4" />
            <span>Conversas</span>
          </button>
        </div>

        {/* Painel Central - Lista de Conversas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">Conversas</h2>
              <span className="text-xs text-gray-500">
                {groupedContacts.length} contato{groupedContacts.length !== 1 ? 's' : ''} • {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Barra de Busca */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => {
                  console.log('🔍 Busca digitada:', e.target.value);
                  setSearchQuery(e.target.value);
                }}
                className="pl-10 bg-[#F3F3F3] border-gray-200 focus:border-black focus:ring-black rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all duration-150 font-medium ${
                  activeFilter === 'all'
                    ? 'bg-black text-white'
                    : 'bg-[#F3F3F3] text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all duration-150 font-medium ${
                  activeFilter === 'unread'
                    ? 'bg-[#EF4444] text-white'
                    : 'bg-[#F3F3F3] text-gray-600 hover:bg-gray-200'
                }`}
              >
                Não lidas
                {conversations.filter(c => c.unread_count > 0).length > 0 && (
                  <span className="ml-1 bg-white/90 text-[#EF4444] px-1.5 rounded-full">
                    {conversations.filter(c => c.unread_count > 0).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveFilter('active')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all duration-150 font-medium ${
                  activeFilter === 'active'
                    ? 'bg-[#10B981] text-white'
                    : 'bg-[#F3F3F3] text-gray-600 hover:bg-gray-200'
                }`}
              >
                Ativas
              </button>
              <button
                onClick={() => setActiveFilter('finished')}
                className={`px-3 py-1.5 text-xs rounded-full transition-all duration-150 font-medium ${
                  activeFilter === 'finished'
                    ? 'bg-gray-500 text-white'
                    : 'bg-[#F3F3F3] text-gray-600 hover:bg-gray-200'
                }`}
              >
                Finalizadas
              </button>
            </div>
          </div>

          {/* Lista de Conversas */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="p-4">
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    <div className="font-semibold mb-1">Configuração Pendente</div>
                    {error}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-8 w-8 border-3 border-gray-200 border-t-black rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 && !error ? (
              <div className="p-6 text-center text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              groupedContacts.map((contact) => (
                <button
                  key={contact.phone_e164}
                  onClick={() => setSelectedContact(contact)}
                  className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 text-left transition-all duration-150 ${
                    selectedContact?.phone_e164 === contact.phone_e164 ? 'bg-gray-50 border-l-4 border-l-black' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0 h-12 w-12 bg-black rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {contact.latest_assistencia?.proprietario?.[0]?.toUpperCase() ||
                        contact.display_name?.[0]?.toUpperCase() ||
                        'C'}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Nome e Tempo */}
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {contact.latest_assistencia?.proprietario ||
                            contact.display_name ||
                            'Cliente'}
                        </h3>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(contact.last_message_at)}
                        </span>
                      </div>

                      {/* Telefone */}
                      <p className="text-xs text-gray-600 mb-1">
                        {contact.phone_e164}
                      </p>

                      {/* Preview da Mensagem */}
                      {contact.last_message && (
                        <p className="text-sm text-gray-700 truncate">
                          {contact.last_message.body}
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {contact.total_unread > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded-full font-bold">
                            {contact.total_unread} nova{contact.total_unread > 1 ? 's' : ''}
                          </span>
                        )}
                        {contact.latest_assistencia?.empreendimento && (
                          <span className={`text-xs px-2 py-0.5 ${getCorEmpreendimento(contact.latest_assistencia.empreendimento).bg} ${getCorEmpreendimento(contact.latest_assistencia.empreendimento).text} rounded-full font-bold`}>
                            {contact.latest_assistencia.empreendimento}
                          </span>
                        )}
                        {contact.latest_assistencia?.status_chamado && (
                          <span className={`text-xs px-2 py-0.5 ${getCorStatus(contact.latest_assistencia.status_chamado).bg} ${getCorStatus(contact.latest_assistencia.status_chamado).text} rounded-full font-bold`}>
                            {contact.latest_assistencia.status_chamado}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col bg-[#F9FAFB]">
        {selectedContact ? (
          <>
            {/* Header do Chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center text-white font-bold">
                    {selectedContact.latest_assistencia?.proprietario?.[0]?.toUpperCase() ||
                      selectedContact.display_name?.[0]?.toUpperCase() ||
                      'C'}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedContact.latest_assistencia?.proprietario ||
                        selectedContact.display_name ||
                        'Cliente'}
                    </h2>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedContact.phone_e164}
                    </p>
                  </div>
                </div>

                {selectedContact.latest_assistencia && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedContact.latest_assistencia.empreendimento}
                    </p>
                    <p className="text-xs text-gray-600">
                      {selectedContact.latest_assistencia.status_chamado}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md rounded-2xl px-4 py-2 ${
                      message.direction === 'out'
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm break-words">{message.body}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <span className={`text-xs ${message.direction === 'out' ? 'text-green-100' : 'text-gray-500'}`}>
                        {formatMessageTime(message.created_at)}
                      </span>
                      {message.direction === 'out' && (
                        <CheckCheck className="h-3 w-3 text-green-100" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-black hover:bg-gray-800 text-white px-6 transition-all duration-150"
                >
                  {sending ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Estado Vazio
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="bg-gray-50 rounded-2xl p-8 mb-4">
              <MessageCircle className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Selecione uma conversa</h3>
            <p className="text-sm text-gray-500">Escolha uma conversa da lista para começar o atendimento</p>
          </div>
        )}
      </div>
    </div>
  );
}
