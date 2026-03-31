"use client";

import { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  Image as ImageIcon,
  X,
  Check,
  CheckCheck,
  User,
  Bot,
  RefreshCw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

interface ChatMessage {
  id: string;
  conversation_id: string;
  direction: 'in' | 'out';
  from_phone: string;
  to_phone: string | null;
  type: string;
  body: string;
  media_url?: string;
  media_mime_type?: string;
  status?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  received_at?: string;
  source?: string;
  provider_message_id?: string;
  created_at: string;
}

interface ChatWhatsAppProps {
  assistenciaId: number | string; // 🔑 Pode ser number (normal) ou string (finalizadas: "finalizada-123")
  telefoneCliente: string;
  nomeCliente: string;
}

export function ChatWhatsApp({ assistenciaId, telefoneCliente, nomeCliente }: ChatWhatsAppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fotoContato, setFotoContato] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null); // Novo: container para detectar scroll
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false); // Evitar múltiplos fetches simultâneos
  const lastMessageTimestampRef = useRef<string | null>(null); // 🚀 Timestamp da última mensagem para busca incremental
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true); // Novo: controlar scroll automático

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
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 🚀 OTIMIZAÇÃO: CARREGAR MENSAGENS APENAS QUANDO O CHAT ABRIR (não ao montar)
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      console.log('🎬 Chat aberto pela primeira vez - carregando mensagens iniciais');
      loadMessages(false); // false = carregar todas (primeira vez)
    }
  }, [isOpen]); // Roda quando o chat abre

  // 🔄 POLLING EM TEMPO REAL com Page Visibility API
  useEffect(() => {
    // ⚡ OTIMIZAÇÃO: SÓ fazer polling se o chat estiver ABERTO
    if (!isOpen) {
      console.log('⏸️ Chat fechado - polling pausado para economizar recursos');
      return;
    }
    
    // Limpar intervalo anterior se existir
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // ⚡ INTERVALO AUMENTADO: 30 segundos (antes era 10s) para reduzir carga
    const pollingInterval = 30000;
    
    console.log(`⏰ Configurando polling: ABERTO (${pollingInterval/1000}s)`);
    
    const setupPolling = () => {
      pollingIntervalRef.current = setInterval(() => {
        if (!document.hidden) { // Só buscar se aba estiver visível
          console.log(`🔄 Polling automático disparado (chat aberto e aba visível)`);
          loadMessages(true); // 🚀 true = busca incremental (apenas mensagens novas)
        } else {
          console.log(`⏸️ Aba inativa - pulando polling`);
        }
      }, pollingInterval);
    };

    // Pausar/retomar polling quando visibilidade da aba mudar
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⏸️ Aba inativa - pausando polling do chat');
      } else {
        console.log('▶️ Aba ativa - retomando polling do chat');
        loadMessages(true); // Atualizar imediatamente quando voltar
      }
    };

    setupPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen]); // Atualiza o intervalo quando isOpen muda

  // 📷 Carregar foto quando o chat abrir
  useEffect(() => {
    if (isOpen) {
      console.log('✅ Chat aberto - carregando foto do contato');
      loadFotoContato();
    }
  }, [isOpen]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carregar mensagens
  // 🚀 incremental = true: buscar apenas mensagens NOVAS (desde a última)
  // 🚀 incremental = false: buscar TODAS as mensagens (inicial ou refresh completo)
  const loadMessages = async (incremental: boolean = false) => {
    if (isLoadingRef.current) return; // Evitar múltiplos fetches simultâneos
    isLoadingRef.current = true;

    try {
      if (!incremental) setIsLoading(true); // Só mostrar loading na busca completa
      
      // Limpar telefone (remover caracteres especiais)
      const phoneCleaned = telefoneCliente.replace(/\D/g, '');
      
      console.log('🔍 ===== DEBUG TELEFONE =====');
      console.log('   📞 Telefone ORIGINAL:', telefoneCliente);
      console.log('   📞 Telefone LIMPO:', phoneCleaned);
      console.log('   📏 Tamanho:', phoneCleaned.length);
      
      // Criar TODAS as variações possíveis do telefone
      const phoneVariations: string[] = [];
      
      // Remover código do país se existir para normalizar
      let phoneWithoutCountry = phoneCleaned;
      if (phoneCleaned.startsWith('55')) {
        phoneWithoutCountry = phoneCleaned.substring(2);
      }
      
      console.log('   📱 Telefone sem código país:', phoneWithoutCountry);
      
      // Se tem 11 dígitos (DDD + 9 + 8 dígitos), criar variação sem o 9
      if (phoneWithoutCountry.length === 11) {
        const ddd = phoneWithoutCountry.substring(0, 2);
        const withoutNine = phoneWithoutCountry.substring(0, 2) + phoneWithoutCountry.substring(3);
        
        console.log('   🔢 DDD:', ddd);
        console.log('   📞 Com 9:', phoneWithoutCountry);
        console.log('   📞 Sem 9:', withoutNine);
        
        // Variações COM o 9
        phoneVariations.push(`+55${phoneWithoutCountry}`);
        phoneVariations.push(`55${phoneWithoutCountry}`);
        phoneVariations.push(phoneWithoutCountry);
        
        // Variações SEM o 9 (telefones antigos)
        phoneVariations.push(`+55${withoutNine}`);
        phoneVariations.push(`55${withoutNine}`);
        phoneVariations.push(withoutNine);
      } 
      // Se tem 10 dígitos (DDD + 8 dígitos), também criar variação COM o 9
      else if (phoneWithoutCountry.length === 10) {
        const ddd = phoneWithoutCountry.substring(0, 2);
        const withNine = phoneWithoutCountry.substring(0, 2) + '9' + phoneWithoutCountry.substring(2);
        
        console.log('   🔢 DDD:', ddd);
        console.log('   📞 Sem 9:', phoneWithoutCountry);
        console.log('   📞 Com 9:', withNine);
        
        // Variações SEM o 9
        phoneVariations.push(`+55${phoneWithoutCountry}`);
        phoneVariations.push(`55${phoneWithoutCountry}`);
        phoneVariations.push(phoneWithoutCountry);
        
        // Variações COM o 9 (celulares novos)
        phoneVariations.push(`+55${withNine}`);
        phoneVariations.push(`55${withNine}`);
        phoneVariations.push(withNine);
      }
      // Qualquer outro tamanho
      else {
        // Apenas adicionar variações básicas
        phoneVariations.push(`+55${phoneCleaned}`);
        phoneVariations.push(`55${phoneCleaned}`);
        phoneVariations.push(phoneCleaned);
        
        if (phoneCleaned.startsWith('55')) {
          phoneVariations.push(`+${phoneCleaned}`);
          phoneVariations.push(phoneCleaned.substring(2));
        }
      }
      
      // Remover duplicatas
      const uniqueVariations = [...new Set(phoneVariations)];
      
      console.log('   📋 Total de variações:', uniqueVariations.length);
      console.log('   📋 Variações a tentar:', uniqueVariations);
      console.log('================================');
      
      let allMessages: ChatMessage[] = [];
      let foundContact = false;
      let successPhone = '';
      
      // Tentar cada variação até encontrar mensagens
      for (const phoneVariation of uniqueVariations) {
        console.log(`🔍 [${uniqueVariations.indexOf(phoneVariation) + 1}/${uniqueVariations.length}] Tentando: "${phoneVariation}"`);
        
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/whatsapp/messages-by-phone/${encodeURIComponent(phoneVariation)}`;
        
        try {
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
              console.log(`   ✅ ✅ ✅ ENCONTRADO! ${data.data.length} mensagens com "${phoneVariation}"`);
              allMessages = data.data;
              foundContact = true;
              successPhone = phoneVariation;
              break;
            } else {
              console.log(`   ⚠️ Sem mensagens`);
            }
          } else {
            console.log(`   ❌ Erro HTTP: ${response.status}`);
          }
        } catch (err) {
          console.error(`   ❌ Erro:`, err);
        }
      }
      
      if (foundContact && allMessages.length > 0) {
        console.log('🎉 ===== SUCESSO! MENSAGENS ENCONTRADAS =====');
        console.log(`   🎯 Telefone que funcionou: "${successPhone}"`);
        console.log(`   📊 Total: ${allMessages.length} mensagens`);
        
        // LOG DETALHADO DE CADA MENSAGEM
        allMessages.forEach((msg: any, index: number) => {
          console.log(`📝 [${index + 1}/${allMessages.length}]:`, {
            id: msg.id,
            direction: msg.direction === 'in' ? '📥 RECEBIDA' : '📤 ENVIADA',
            type: msg.type,
            body: msg.body?.substring(0, 50) + (msg.body?.length > 50 ? '...' : ''),
            from: msg.from_phone,
            to: msg.to_phone,
            created: msg.created_at,
          });
        });
        
        setMessages(allMessages);
        
        // 🚀 ATUALIZAR timestamp da última mensagem para busca incremental
        if (allMessages.length > 0) {
          const lastMsg = allMessages[allMessages.length - 1];
          lastMessageTimestampRef.current = lastMsg.created_at;
          console.log(`   🕐 Último timestamp salvo: ${lastMsg.created_at}`);
        }
        
        // Contar mensagens não vazias
        const nonEmpty = allMessages.filter((msg: ChatMessage) => msg.body?.trim()).length;
        console.log(`   💬 Com conteúdo: ${nonEmpty}`);
        
        // 🔔 NOVA LÓGICA: Mostrar notificação apenas se a ÚLTIMA mensagem for do CLIENTE
        let shouldShowNotification = 0;
        
        if (allMessages.length > 0) {
          // Pegar a última mensagem (a mais recente)
          const lastMessage = allMessages[allMessages.length - 1];
          
          console.log('🔍 Verificando última mensagem:');
          console.log('   📥 Direction:', lastMessage.direction);
          console.log('   💬 Body:', lastMessage.body?.substring(0, 50));
          console.log('   ⏰ Created at:', lastMessage.created_at);
          
          // Mostrar notificação APENAS se:
          // 1. A última mensagem é RECEBIDA (direction === 'in') = do cliente
          // 2. E ainda não foi lida pelo técnico (!read_at)
          if (lastMessage.direction === 'in' && !lastMessage.read_at) {
            shouldShowNotification = 1; // Mostrar bolinha
            console.log('   ✅ MOSTRAR NOTIFICAÇÃO: Última mensagem é do cliente e não foi lida');
          } else {
            console.log('   ℹ️ SEM NOTIFICAÇÃO: Última mensagem é do técnico ou já foi lida');
          }
        }
        
        setUnreadCount(shouldShowNotification);
        
        console.log(`   🔔 Notificação: ${shouldShowNotification ? 'SIM (1)' : 'NÃO (0)'}`);
        console.log('==========================================');
      } else {
        console.log('ℹ️ ===== NENHUMA MENSAGEM NO BANCO =====');
        console.log('   📞 Telefone:', telefoneCliente);
        console.log('   📋 Variações testadas:', uniqueVariations.length);
        console.log('   ℹ️ Isso é normal se ainda não houve conversa');
        console.log('   💡 Envie a primeira mensagem para iniciar o histórico');
        console.log('==========================================');
        setMessages([]);
        setUnreadCount(0);
      }
      
    } catch (error) {
      console.error('❌ ===== ERRO AO CARREGAR MENSAGENS =====');
      console.error('   Erro:', error);
      console.error('=========================================');
      setMessages([]);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Carregar foto do contato
  const loadFotoContato = async () => {
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/whatsapp/contact-photo/${encodeURIComponent(telefoneCliente)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data && data.data.photo_url) {
          console.log(`   ✅ ✅ ✅ FOTO ENCONTRADA para "${telefoneCliente}"`);
          setFotoContato(data.data.photo_url);
        } else {
          console.log(`   ⚠️ Sem foto disponível`);
        }
      } else {
        console.log(`   ❌ Erro HTTP: ${response.status}`);
      }
    } catch (err) {
      console.error(`   ❌ Erro ao carregar foto:`, err);
    }
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    try {
      setIsSending(true);

      console.log('📤 Enviando mensagem:', {
        assistencia_id: assistenciaId,
        phone_number: telefoneCliente,
        message: newMessage,
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/chat/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            assistencia_id: assistenciaId,
            phone_number: telefoneCliente,
            message: newMessage,
          }),
        }
      );

      // Parse seguro da resposta (pode ter texto antes do JSON)
      let data;
      try {
        const responseText = await response.text();
        console.log('📥 Resposta raw do servidor (primeiros 200 chars):', responseText.substring(0, 200));
        
        // Limpar BOM e espaços
        let cleanedText = responseText.trim().replace(/^\uFEFF/, '');
        
        // Se não começa com { ou [, procurar JSON
        if (!cleanedText.startsWith('{') && !cleanedText.startsWith('[')) {
          console.log('⚠️ Resposta não começa com JSON, procurando...');
          const jsonStartIndex = Math.min(
            cleanedText.indexOf('{') !== -1 ? cleanedText.indexOf('{') : Infinity,
            cleanedText.indexOf('[') !== -1 ? cleanedText.indexOf('[') : Infinity
          );
          
          if (jsonStartIndex !== Infinity && jsonStartIndex > 0) {
            const textBefore = cleanedText.substring(0, jsonStartIndex);
            console.log(`   Texto antes do JSON: "${textBefore}"`);
            cleanedText = cleanedText.substring(jsonStartIndex);
          }
        }
        
        data = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse da resposta:', parseError);
        throw new Error('Resposta inválida do servidor');
      }
      console.log('📥 Resposta do servidor:', data);
      console.log('📊 Status HTTP:', response.status);
      console.log('📊 Response OK?', response.ok);

      if (!response.ok) {
        console.error('❌ Erro HTTP:', response.status, data);
        console.error('❌ Detalhes completos:', JSON.stringify(data, null, 2));
        throw new Error(data.error || data.details || 'Erro ao enviar mensagem');
      }

      // Verificar se há erro na resposta mesmo com status 200
      if (data.error) {
        console.error('❌ Erro retornado pelo servidor:', data.error);
        console.error('❌ Detalhes:', data.details);
        throw new Error(data.details || data.error || 'Erro ao enviar mensagem');
      }

      if (data.success) {
        console.log('✅ Mensagem enviada com sucesso!', data.data);
        // Adicionar mensagem à lista
        setMessages(prev => [...prev, data.data]);
        setNewMessage('');
        toast.success('Mensagem enviada via WhatsApp!');
      } else {
        console.error('❌ Resposta sem sucesso:', data);
        
        // 🔧 TRATAMENTO MELHORADO DE ERROS
        let errorMsg = 'Erro ao enviar mensagem';
        
        // Se tem detalhes do erro, mostrar de forma amigável
        if (data.details) {
          console.error('   Detalhes do erro:', data.details);
          
          // Mensagens amigáveis baseadas nos erros
          if (data.details.includes('TIMEOUT')) {
            errorMsg = 'Tempo limite excedido. Verifique sua conexão e tente novamente.';
          } else if (data.details.includes('não encontrado') || data.details.includes('NOT_FOUND')) {
            errorMsg = 'Número do WhatsApp inválido ou não encontrado.';
          } else if (data.details.includes('desconectada') || data.details.includes('DISCONNECTED')) {
            errorMsg = 'WhatsApp desconectado. Entre em contato com o suporte.';
          } else if (data.details.includes('Client-Token')) {
            errorMsg = 'Configuração do WhatsApp incompleta. Entre em contato com o suporte.';
          } else if (data.details.includes('Credenciais')) {
            errorMsg = 'Erro de autenticação WhatsApp. Entre em contato com o suporte.';
          } else {
            // Usar a mensagem de detalhe, mas ocultando informações técnicas sensíveis
            errorMsg = data.details.replace(/https?:\/\/[^\s]+/g, '[URL]');
          }
        } else if (data.error) {
          errorMsg = data.error;
        } else if (data.message) {
          errorMsg = data.message;
        }
        
        console.error('   📢 Mensagem de erro amigável:', errorMsg);
        toast.error(errorMsg, { duration: 5000 });
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);

      // Mensagem amigável sem expor detalhes técnicos
      let errorMsg = 'Erro ao enviar mensagem. Tente novamente.';
      if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        errorMsg = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('timeout')) {
        errorMsg = 'Tempo limite excedido. Tente novamente.';
      }
      
      toast.error(errorMsg, { duration: 5000 });
    } finally {
      setIsSending(false);
    }
  };

  // Formatar timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === today.toDateString()) {
      return time;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Ontem ${time}`;
    } else {
      return `${date.toLocaleDateString('pt-BR')} ${time}`;
    }
  };

  // Renderizar ícone de status
  const renderStatusIcon = (status?: ChatMessage['status']) => {
    switch (status) {
      case 'sending':
        return <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />;
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Botão de Chat */}
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="relative h-7 px-2 text-xs border-teal-600 text-teal-700 hover:bg-teal-50"
      >
        <MessageCircle className="w-3 h-3 mr-1" />
        WhatsApp
        {unreadCount > 0 && (
          <Badge className="absolute -top-1.5 -right-1.5 bg-red-500 text-white px-1 py-0 text-[9px] h-4 min-w-4 flex items-center justify-center">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Modal do Chat */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] p-0 flex flex-col gap-0 overflow-hidden !max-h-[90vh] bg-[#f0f2f5]">
          {/* Header Estilo WhatsApp Web Moderno */}
          <DialogHeader className="p-3 sm:p-4 bg-[#008069] shadow-md flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {/* Avatar com foto real do cliente */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden ring-2 ring-white/30">
                  {fotoContato ? (
                    <img 
                      src={fotoContato} 
                      alt={nomeCliente}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback para ícone se a imagem falhar
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <User className={`w-5 h-5 sm:w-6 sm:h-6 text-white ${fotoContato ? 'hidden' : ''}`} />
                </div>
                
                {/* Info do Cliente */}
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-white text-sm sm:text-base truncate font-medium">
                    {nomeCliente}
                  </DialogTitle>
                  <DialogDescription className="text-teal-100 text-xs truncate font-normal">
                    {telefoneCliente}
                  </DialogDescription>
                </div>
              </div>
              
              {/* Botão de atualização */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  console.log('🔄 FORÇANDO ATUALIZAÇÃO MANUAL...');
                  loadMessages();
                  loadFotoContato();
                }}
                className="text-white hover:bg-white/10 flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 sm:px-2 rounded-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </DialogHeader>

          {/* Área de mensagens com fundo WhatsApp autêntico */}
          <div 
            className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 min-h-0" 
            style={{
              backgroundColor: '#e5ddd5',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='%23ccc8c0' fill-opacity='0.08'%3E%3Cpath d='M769 229L1037 260.9M927 880L731 737 520 660 309 538 40 599 295 764 126.5 879.5 40 599-197 493 102 382-31 229 126.5 79.5-69-63'/%3E%3Cpath d='M-31 229L237 261 390 382 603 493 308.5 537.5 101.5 381.5M370 905L295 764'/%3E%3Cpath d='M520 660L578 842 731 737 840 599 603 493 520 660 295 764 309 538 390 382 539 269 769 229 577.5 41.5 370 105 295 -36 126.5 79.5 237 261 102 382 40 599 -69 737 127 880'/%3E%3Cpath d='M520-140L578.5 42.5 731-63M603 493L539 269 237 261 370 105M902 382L539 269M390 382L102 382'/%3E%3Cpath d='M-222 42L126.5 79.5 370 105 539 269 577.5 41.5 927 80 769 229 902 382 603 493 731 737M295-36L577.5 41.5M578 842L295 764M40-201L127 80M102 382L-261 269'/%3E%3C/g%3E%3Cg fill='%23d9d6cf' fill-opacity='0.05'%3E%3Ccircle cx='769' cy='229' r='5'/%3E%3Ccircle cx='539' cy='269' r='5'/%3E%3Ccircle cx='603' cy='493' r='5'/%3E%3Ccircle cx='731' cy='737' r='5'/%3E%3Ccircle cx='520' cy='660' r='5'/%3E%3Ccircle cx='309' cy='538' r='5'/%3E%3Ccircle cx='295' cy='764' r='5'/%3E%3Ccircle cx='40' cy='599' r='5'/%3E%3Ccircle cx='102' cy='382' r='5'/%3E%3Ccircle cx='127' cy='80' r='5'/%3E%3Ccircle cx='370' cy='105' r='5'/%3E%3Ccircle cx='578' cy='42' r='5'/%3E%3Ccircle cx='237' cy='261' r='5'/%3E%3Ccircle cx='390' cy='382' r='5'/%3E%3C/g%3E%3C/svg%3E")`
            }}
            ref={messagesContainerRef}
            onScroll={handleScroll}
          >
            {isLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-600">Carregando mensagens...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center px-4">
                <div className="bg-white rounded-full p-5 sm:p-7 mb-4 shadow-md">
                  <MessageCircle className="w-12 h-12 sm:w-14 sm:h-14 text-gray-400" />
                </div>
                <p className="text-base sm:text-lg font-medium text-gray-700 mb-2">
                  Sem histórico de mensagens
                </p>
                <p className="text-xs sm:text-sm text-gray-600 mb-4 max-w-sm">
                  Não foram encontradas mensagens para <span className="font-medium">{telefoneCliente}</span>
                </p>
                <div className="bg-white/80 border border-gray-200 rounded-xl p-3 sm:p-4 max-w-md shadow-sm">
                  <p className="text-xs sm:text-sm text-gray-700 mb-2 flex items-center gap-2 justify-center">
                    <span className="text-lg">💬</span> <strong>Como funciona</strong>
                  </p>
                  <ul className="text-xs text-gray-600 text-left space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 mt-0.5">•</span>
                      <span>Mensagens aparecem após serem enviadas/recebidas via n8n</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 mt-0.5">•</span>
                      <span>Configure o workflow n8n para integração automática</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 mt-0.5">•</span>
                      <span>Ou envie a primeira mensagem abaixo</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2 pb-4">
                {messages.map((msg) => {
                  const isFromTecnico = msg.direction === 'out';
                  const isSystem = msg.type === 'system';

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isFromTecnico ? 'justify-end' : 'justify-start'} items-end gap-1.5`}
                    >
                      {/* Avatar do cliente nas mensagens recebidas */}
                      {!isFromTecnico && !isSystem && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-white/50 mb-0.5">
                          {fotoContato ? (
                            <img 
                              src={fotoContato} 
                              alt={nomeCliente}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <User className={`w-3 h-3 text-white ${fotoContato ? 'hidden' : ''}`} />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] sm:max-w-[70%] px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm ${
                          isSystem
                            ? 'bg-[#fef4e6] text-amber-900 text-center mx-auto text-xs sm:text-sm border border-amber-200 rounded-lg'
                            : isFromTecnico
                            ? 'bg-[#d9fdd3] text-gray-900 rounded-tl-lg rounded-tr-lg rounded-bl-lg rounded-br-sm'
                            : 'bg-white text-gray-900 rounded-tl-sm rounded-tr-lg rounded-br-lg rounded-bl-lg'
                        }`}
                      >
                        {/* Badge do tipo de remetente */}
                        {isSystem && (
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Bot className="w-3 h-3" />
                            <span className="text-xs font-medium">Sistema</span>
                          </div>
                        )}

                        {/* Mensagem */}
                        <div className="break-words whitespace-pre-wrap text-sm leading-snug">
                          {msg.body}
                        </div>

                        {/* Imagem se houver */}
                        {msg.media_url && msg.media_mime_type?.startsWith('image') && (
                          <div className="mt-1.5 rounded-md overflow-hidden">
                            <img 
                              src={msg.media_url} 
                              alt="Imagem enviada" 
                              className="rounded-md max-w-full cursor-pointer hover:opacity-90 transition"
                              onClick={() => window.open(msg.media_url, '_blank')}
                            />
                          </div>
                        )}

                        {/* Timestamp e status */}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-gray-500">
                            {formatTimestamp(msg.created_at)}
                          </span>
                          {isFromTecnico && renderStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input de mensagem - Estilo WhatsApp Web */}
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#f0f2f5] flex-shrink-0 border-t border-gray-200">
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Mensagem"
                className="flex-1 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
                disabled={isSending}
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                size="icon"
                className="bg-[#008069] hover:bg-[#017561] rounded-full h-9 w-9 flex-shrink-0 shadow-md hover:shadow-lg transition-all"
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2 text-center">
              As mensagens serão enviadas via WhatsApp para {telefoneCliente}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}