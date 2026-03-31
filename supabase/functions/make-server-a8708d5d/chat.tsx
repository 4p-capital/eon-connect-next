import { Hono } from "npm:hono@4";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

// 🔥 OTIMIZAÇÃO: Singleton do Supabase client
let _chatSupabase: ReturnType<typeof createClient> | null = null;
function getChatSupabase() {
  if (!_chatSupabase) {
    _chatSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }
  return _chatSupabase;
}

// Tipos
interface ChatMessage {
  id: string;
  assistencia_id: number;
  sender: 'system' | 'tecnico' | 'cliente';
  message: string;
  media_url?: string;
  media_type?: 'image' | 'document' | 'audio' | 'video';
  phone_number: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  z_api_message_id?: string;
}

interface ZApiSendMessageParams {
  phone: string;
  message: string;
}

// Função helper para parsear JSON de forma segura
async function safeJsonParse(response: Response): Promise<any> {
  const responseText = await response.text();
  
  // Log detalhado da resposta
  console.log(`📥 Resposta da Z-API (status ${response.status}):`);
  console.log(`   Tamanho: ${responseText.length} bytes`);
  console.log(`   Primeiros 100 chars:`, responseText.substring(0, 100));
  
  // Verificar se a resposta está vazia
  if (!responseText || responseText.trim().length === 0) {
    console.error('❌ Resposta vazia da Z-API!');
    throw new Error('Resposta vazia da Z-API');
  }
  
  // Verificar se é HTML (erro comum)
  if (responseText.trim().startsWith('<')) {
    console.error('❌ Resposta é HTML, não JSON!');
    console.error('   HTML completo:', responseText.substring(0, 500));
    throw new Error('Z-API retornou HTML ao invés de JSON');
  }
  
  try {
    // Limpar a resposta removendo BOM, espaços extras, etc.
    let cleanedText = responseText.trim().replace(/^\uFEFF/, '');
    
    // 🔧 CORREÇÃO AGRESSIVA v4: Forçar extração do JSON
    console.log(`🔍 Verificando início da resposta...`);
    console.log(`   Primeiro caractere: "${cleanedText[0]}" (código: ${cleanedText.charCodeAt(0)})`);
    console.log(`   Primeiros 10 caracteres em HEX: ${Array.from(cleanedText.substring(0, 10)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);
    
    // Se não começa com { ou [, tentar encontrar o início do JSON
    if (!cleanedText.startsWith('{') && !cleanedText.startsWith('[')) {
      console.log(`⚠️ Resposta não começa com { ou [ - procurando JSON...`);
      
      // Procurar primeira ocorrência de { ou [
      const jsonStartIndex = Math.min(
        cleanedText.indexOf('{') !== -1 ? cleanedText.indexOf('{') : Infinity,
        cleanedText.indexOf('[') !== -1 ? cleanedText.indexOf('[') : Infinity
      );
      
      if (jsonStartIndex !== Infinity && jsonStartIndex > 0) {
        const textBefore = cleanedText.substring(0, jsonStartIndex);
        console.log(`   ✅ JSON encontrado na posição ${jsonStartIndex}!`);
        console.log(`   Texto antes do JSON: "${textBefore}"`);
        console.log(`   Bytes em HEX: ${Array.from(textBefore).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);
        
        // Remover texto antes do JSON
        cleanedText = cleanedText.substring(jsonStartIndex);
        console.log(`   ✅ JSON extraído (100 chars): ${cleanedText.substring(0, 100)}...`);
      } else if (jsonStartIndex === Infinity) {
        console.error(`   ❌ Nenhum JSON encontrado na resposta!`);
        console.error(`   Resposta completa (500 chars): ${cleanedText.substring(0, 500)}`);
      }
    } else {
      console.log(`✅ Resposta já começa com JSON válido`);
    }
    
    // Log do texto limpo para debug
    console.log(`   Texto limpo (100 chars):`, cleanedText.substring(0, 100));
    
    const parsed = JSON.parse(cleanedText);
    console.log(`✅ JSON parseado com sucesso`);
    return parsed;
  } catch (parseError) {
    console.error('❌ Erro ao parsear resposta como JSON:', parseError);
    console.error('   Mensagem do erro:', parseError.message);
    console.error('   Resposta completa:', responseText);
    console.error('   Bytes em HEX (primeiros 50):');
    const hexBytes = Array.from(responseText.substring(0, 50))
      .map(c => `${c.charCodeAt(0).toString(16).padStart(2, '0')}(${c})`)
      .join(' ');
    console.error(`   ${hexBytes}`);
    
    throw new Error(`Resposta inválida (não é JSON): ${parseError.message}`);
  }
}

// Função para formatar número de telefone para o padrão Z-API
function formatPhoneForZApi(phone: string): string {
  // ✅ Se for um grupo (termina com "-group"), retornar sem formatar
  if (phone.includes('-group') || phone.includes('@g.us')) {
    console.log(`📞 ID de grupo detectado: ${phone} (sem formatação)`);
    return phone;
  }
  
  // Remover todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Se não começar com 55 (Brasil), adicionar
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  // Garantir que tem 13 dígitos (55 + DDD de 2 dígitos + 9 dígitos do celular)
  // ou 12 dígitos (55 + DDD de 2 dígitos + 8 dígitos do fixo)
  if (cleaned.length >= 12 && cleaned.length <= 13) {
    console.log(`📞 Telefone formatado: ${phone} -> ${cleaned}`);
    return cleaned;
  }
  
  console.warn(`⚠️ Telefone em formato inválido: ${phone} (${cleaned.length} dígitos)`);
  return cleaned;
}

// Tipos para WhatsApp via Z-API
interface ZApiSendFileParams {
  phone: string;
  image?: string; // base64
  document?: string; // base64
  caption?: string;
  filename?: string;
}

// Cliente Z-API
export class ZApiClient {
  private instanceId: string;
  private token: string;
  private clientToken: string; // Token de segurança da conta (diferente do token da URL)
  private baseUrl: string;

  constructor() {
    this.instanceId = '';
    this.token = '';
    this.clientToken = '';
    this.baseUrl = '';
  }

  // Carregar credenciais (do KV Store ou variáveis de ambiente)
  private async loadCredentials() {
    // Tentar carregar do KV Store primeiro
    const config = await kv.get('zapi_config');
    
    if (config) {
      this.instanceId = config.instance_id;
      this.token = config.token;
      this.clientToken = config.client_token || '';
      // Limpar base_url para ter apenas o domínio
      this.baseUrl = this.normalizeBaseUrl(config.base_url);
      console.log('✅ Credenciais Z-API carregadas do KV Store');
      console.log('   → Instance ID:', this.instanceId);
      // 🔒 SEGURANÇA: Não logar tokens completos ou parciais em produção
      // console.log('   → Token (10 chars):', this.token.substring(0, 10) + '...');
      // console.log('   → Client-Token (10 chars):', this.clientToken ? this.clientToken.substring(0, 10) + '...' : 'NÃO CONFIGURADO');
      console.log('   → Base URL:', this.baseUrl);
    } else {
      // Fallback para variáveis de ambiente
      this.instanceId = Deno.env.get('ZAPI_INSTANCE_ID') ?? '';
      this.token = Deno.env.get('ZAPI_TOKEN') ?? '';
      this.clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
      this.baseUrl = this.normalizeBaseUrl(Deno.env.get('ZAPI_URL') ?? 'https://api.z-api.io');
      console.log('✅ Credenciais Z-API carregadas das variáveis de ambiente');
      console.log('   → Instance ID:', this.instanceId);
      // 🔒 SEGURANÇA: Não logar tokens
      // console.log('   → Token (10 chars):', this.token ? this.token.substring(0, 10) + '...' : 'VAZIO');
      // console.log('   → Client-Token (10 chars):', this.clientToken ? this.clientToken.substring(0, 10) + '...' : 'NÃO CONFIGURADO');
      console.log('   → Base URL:', this.baseUrl);
    }
    
    console.log('🔍 Base URL normalizada:', this.baseUrl);
    
    if (!this.instanceId || !this.token) {
      console.warn('⚠️ Z-API credentials not configured');
    }
  }
  
  // Normalizar Base URL para evitar duplicação de paths
  private normalizeBaseUrl(url: string): string {
    if (!url) return 'https://api.z-api.io';
    
    // Remover trailing slash
    url = url.trim().replace(/\/$/, '');
    
    // Se a URL contém /instances/, extrair apenas a parte base
    const match = url.match(/^(https?:\/\/[^\/]+)/);
    if (match) {
      return match[1];
    }
    
    return url;
  }

  // Headers padrão para requisições Z-API
  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // ⚠️ IMPORTANTE: Client-Token só deve ser enviado se:
    // 1. Estiver configurado no nosso sistema E
    // 2. Estiver configurado no painel da Z-API
    // 
    // Se você receber erro "your client-token is not configured":
    // - Acesse o painel Z-API
    // - Vá em Settings > Security
    // - Ative "Client Token" e copie o valor
    // - Cole esse valor nas variáveis de ambiente do sistema (ZAPI_CLIENT_TOKEN)
    
    if (this.clientToken) {
      headers['Client-Token'] = this.clientToken;
      console.log(`✅ Enviando Client-Token nos headers (10 chars): ${this.clientToken.substring(0, 10)}...`);
    } else {
      console.log('ℹ️ Client-Token não configurado - enviando requisição sem ele');
      console.log('   Se receber erro "client-token is not configured", configure-o em:');
      console.log('   1. Painel Z-API > Settings > Security > Client Token');
      console.log('   2. Variáveis de ambiente > ZAPI_CLIENT_TOKEN');
    }
    
    return headers;
  }

  // Testar conexão com Z-API
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      await this.loadCredentials();
      
      if (!this.instanceId || !this.token || !this.baseUrl) {
        return { 
          success: false, 
          error: 'Credenciais não configuradas',
          details: {
            hasInstanceId: !!this.instanceId,
            hasToken: !!this.token,
            hasBaseUrl: !!this.baseUrl,
          }
        };
      }
      
      // Testar endpoint de status da instância
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/status`;
      
      console.log(`🔍 Testando conexão Z-API: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
      });
      
      const data = await safeJsonParse(response);
      
      console.log(`📊 Resposta do teste:`, { status: response.status, data });
      
      if (response.ok && !data.error) {
        return { success: true, details: data };
      } else {
        return { success: false, error: data.message || data.error, details: data };
      }
      
    } catch (error) {
      console.error('❌ Erro ao testar conexão:', error);
      return { success: false, error: error.message };
    }
  }

  // Enviar mensagem de texto
  async sendMessage(params: ZApiSendMessageParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.loadCredentials();
      
      if (!this.instanceId || !this.token || !this.baseUrl) {
        console.error('❌ Credenciais Z-API não configuradas!');
        return { success: false, error: 'Credenciais Z-API não configuradas' };
      }
      
      const phoneFormatted = formatPhoneForZApi(params.phone);
      
      // URL correta da Z-API (formato atualizado)
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`;
      
      console.log(`📤 Enviando mensagem via Z-API`);
      console.log(`   → Telefone original: ${params.phone}`);
      console.log(`   → Telefone formatado: ${phoneFormatted}`);
      console.log(`   → URL completa: ${url}`);
      console.log(`   → Base URL: ${this.baseUrl}`);
      console.log(`   → Instance ID: ${this.instanceId}`);
      console.log(`   → Token (primeiros 10 chars): ${this.token.substring(0, 10)}...`);
      console.log(`   → Mensagem (primeiros 100 chars): ${params.message.substring(0, 100)}...`);
      
      // Body no formato correto da Z-API
      const requestBody = {
        phone: phoneFormatted,
        message: params.message,
      };
      
      console.log(`   → Body da requisição:`, JSON.stringify(requestBody, null, 2));
      
      // 🔧 Adicionar timeout de 30 segundos para evitar requisições travadas
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
      
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('❌ Timeout ao enviar mensagem para Z-API (30s)');
          return { success: false, error: 'TIMEOUT: Tempo limite excedido ao enviar mensagem' };
        }
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

      // Usar a função segura de parsing
      const data = await safeJsonParse(response);
      
      console.log(`📊 Resposta parseada da Z-API:`, {
        status: response.status,
        ok: response.ok,
        data: data
      });
      
      // ⚠️ Z-API pode retornar status 200 mas com erro no body!
      if (data.error || !response.ok) {
        console.error('❌ Erro ao enviar mensagem via Z-API:');
        console.error('   Status:', response.status);
        console.error('   Erro Z-API:', data.error);
        console.error('   Mensagem:', data.message);
        console.error('   Resposta completa:', JSON.stringify(data, null, 2));
        
        // Retornar mensagem de erro mais descritiva
        let errorMsg = data.message || data.error || 'Erro desconhecido';
        let isCritical = false; // Flag para alertas críticos
        
        if (data.error === 'NOT_FOUND') {
          errorMsg = 'Número não encontrado. Verifique se: 1) A instância Z-API está conectada, 2) O número tem WhatsApp ativo, 3) O número está correto';
        } else if (data.error === 'BANNED' || data.error === 'RESTRICTED' || 
                   data.message?.toLowerCase().includes('banned') ||
                   data.message?.toLowerCase().includes('restricted') ||
                   data.message?.toLowerCase().includes('bloqueado') ||
                   data.message?.toLowerCase().includes('restringido')) {
          errorMsg = '🚨 ALERTA CRÍTICO: Número do WhatsApp foi RESTRINGIDO ou BANIDO pelo WhatsApp. Entre em contato urgente com o suporte para regularizar.';
          isCritical = true;
          console.error('🚨🚨🚨 NÚMERO RESTRINGIDO/BANIDO - AÇÃO URGENTE NECESSÁRIA 🚨🚨🚨');
        } else if (data.error === 'RATE_LIMIT' || data.message?.toLowerCase().includes('rate limit')) {
          errorMsg = '⚠️ Limite de envio atingido. Aguarde alguns minutos antes de enviar mais mensagens.';
          console.warn('⚠️ Rate limit atingido - pausar envios temporariamente');
        }
        
        // Salvar alerta crítico no KV Store para dashboard
        if (isCritical) {
          try {
            await kv.set('whatsapp_critical_alert', {
              type: 'BANNED_OR_RESTRICTED',
              timestamp: new Date().toISOString(),
              error: data.error,
              message: data.message,
              phone: params.phone,
            });
            console.log('💾 Alerta crítico salvo no KV Store');
          } catch (kvError) {
            console.error('❌ Erro ao salvar alerta no KV:', kvError);
          }
        }
        
        return { success: false, error: errorMsg, isCritical };
      }

      console.log('✅ Mensagem enviada com sucesso via Z-API');
      console.log('   → Message ID:', data.messageId);
      return { success: true, messageId: data.messageId };
      
    } catch (error) {
      console.error('❌ Erro na comunicação com Z-API:', error);
      console.error('   Tipo do erro:', error.constructor.name);
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
      
      // Se for erro de JSON parsing, fornecer mais contexto
      if (error.message.includes('JSON') || error.message.includes('Resposta inválida')) {
        return { 
          success: false, 
          error: `Erro ao processar resposta da Z-API: ${error.message}. Verifique: 1) URL da Z-API está correta, 2) Instância está ativa, 3) Credenciais estão corretas.` 
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Enviar imagem
  async sendImage(phone: string, imageBase64: string, caption?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.loadCredentials();
      
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-image`;
      
      console.log(`📤 Enviando imagem via Z-API para ${phone}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phone: formatPhoneForZApi(phone),
          image: imageBase64,
          caption: caption || '',
        }),
      });

      const data = await safeJsonParse(response);
      
      if (!response.ok) {
        console.error('❌ Erro ao enviar imagem via Z-API:', data);
        return { success: false, error: data.message || 'Erro desconhecido' };
      }

      console.log('✅ Imagem enviada com sucesso via Z-API');
      return { success: true, messageId: data.messageId };
      
    } catch (error) {
      console.error('❌ Erro ao enviar imagem via Z-API:', error);
      return { success: false, error: error.message };
    }
  }

  // Enviar documento
  async sendDocument(phone: string, documentBase64: string, filename: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.loadCredentials();
      
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-document`;
      
      console.log(`📤 Enviando documento via Z-API para ${phone}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phone: formatPhoneForZApi(phone),
          document: documentBase64,
          fileName: filename,
        }),
      });

      const data = await safeJsonParse(response);
      
      if (!response.ok) {
        console.error('❌ Erro ao enviar documento via Z-API:', data);
        return { success: false, error: data.message || 'Erro desconhecido' };
      }

      console.log('✅ Documento enviado com sucesso via Z-API');
      return { success: true, messageId: data.messageId };
      
    } catch (error) {
      console.error('❌ Erro ao enviar documento via Z-API:', error);
      return { success: false, error: error.message };
    }
  }

  // Enviar imagem para GRUPO (sem formatação de telefone)
  async sendImageToGroup(groupId: string, imageBase64: string, caption?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.loadCredentials();
      
      if (!this.instanceId || !this.token || !this.baseUrl) {
        console.error('❌ Credenciais Z-API não configuradas!');
        return { success: false, error: 'Credenciais Z-API não configuradas' };
      }
      
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-image`;
      
      console.log(`📤 Enviando imagem via Z-API para GRUPO: ${groupId}`);
      console.log(`   URL: ${url}`);
      console.log(`   Caption (100 chars): ${caption?.substring(0, 100)}...`);
      
      const payload = {
        phone: groupId,  // Para grupos, enviar o ID direto sem formatação
        image: imageBase64,
        caption: caption || '',
      };
      
      console.log(`   Payload (sem base64): phone=${payload.phone}, image=<base64>, caption length=${payload.caption.length}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await safeJsonParse(response);
      
      console.log(`📊 Resposta da Z-API:`, { 
        status: response.status, 
        ok: response.ok,
        data: data 
      });
      
      if (!response.ok) {
        console.error('❌ Erro ao enviar imagem para grupo via Z-API:', data);
        return { success: false, error: data.message || JSON.stringify(data) };
      }

      console.log('✅ Imagem enviada para GRUPO com sucesso via Z-API');
      console.log(`   Message ID: ${data.messageId}`);
      return { success: true, messageId: data.messageId };
      
    } catch (error) {
      console.error('❌ Erro ao enviar imagem para grupo via Z-API:', error);
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // Enviar mensagem para GRUPO (sem formatação de telefone)
  async sendMessageToGroup(groupId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.loadCredentials();
      
      if (!this.instanceId || !this.token || !this.baseUrl) {
        console.error('❌ Credenciais Z-API não configuradas!');
        return { success: false, error: 'Credenciais Z-API não configuradas' };
      }
      
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`;
      
      console.log(`📤 Enviando mensagem via Z-API para GRUPO: ${groupId}`);
      console.log(`   URL: ${url}`);
      console.log(`   Mensagem (100 chars): ${message.substring(0, 100)}...`);
      
      const payload = {
        phone: groupId,  // Para grupos, enviar o ID direto sem formatação
        message: message,
      };
      
      console.log(`   Payload: phone=${payload.phone}, message length=${payload.message.length}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await safeJsonParse(response);
      
      console.log(`📊 Resposta da Z-API:`, { 
        status: response.status, 
        ok: response.ok,
        data: data 
      });
      
      if (!response.ok) {
        console.error('❌ Erro ao enviar mensagem para grupo via Z-API:', data);
        return { success: false, error: data.message || JSON.stringify(data) };
      }

      console.log('✅ Mensagem enviada para GRUPO com sucesso via Z-API');
      console.log(`   Message ID: ${data.messageId}`);
      return { success: true, messageId: data.messageId };
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem para grupo via Z-API:', error);
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // Enviar mensagem com IMAGEM e BOTÕES para GRUPO
  async sendImageWithButtonsToGroup(
    groupId: string, 
    imageUrl: string, 
    message: string,
    buttonActions: Array<{ id: string; type: string; url: string; label: string }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      await this.loadCredentials();
      
      if (!this.instanceId || !this.token || !this.baseUrl) {
        console.error('❌ Credenciais Z-API não configuradas!');
        return { success: false, error: 'Credenciais Z-API não configuradas' };
      }
      
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-image`;
      
      console.log(`📤 Enviando imagem com botões via Z-API para GRUPO: ${groupId}`);
      console.log(`   URL: ${url}`);
      console.log(`   Imagem: ${imageUrl.substring(0, 100)}...`);
      console.log(`   Botões: ${buttonActions.length} botão(ões)`);
      
      const payload = {
        phone: groupId,
        image: imageUrl,
        message: message,
        buttonActions: buttonActions,
      };
      
      console.log(`   Payload completo:`, JSON.stringify(payload).substring(0, 200));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await safeJsonParse(response);
      
      console.log(`📊 Resposta da Z-API:`, { 
        status: response.status, 
        ok: response.ok,
        data: data 
      });
      
      if (!response.ok) {
        console.error('❌ Erro ao enviar imagem com botões via Z-API:', data);
        return { success: false, error: data.message || JSON.stringify(data) };
      }

      console.log('✅ Imagem com botões enviada para GRUPO com sucesso via Z-API');
      console.log(`   Message ID: ${data.messageId}`);
      return { success: true, messageId: data.messageId };
      
    } catch (error) {
      console.error('❌ Erro ao enviar imagem com botões via Z-API:', error);
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      return { success: false, error: error.message };
    }
  }
}

// Funções auxiliares para gerenciar mensagens no KV Store
export const ChatService = {
  // Salvar mensagem no KV Store (agora indexado por telefone!)
  async saveMessage(message: ChatMessage): Promise<void> {
    // NOVA ESTRUTURA: chat:{telefone}:{messageId}
    // Isso mantém todo histórico do cliente em um único chat
    const key = `chat:${message.phone_number}:${message.id}`;
    await kv.set(key, message);
    console.log(`💾 Mensagem salva: ${key} (assistência #${message.assistencia_id})`);
  },

  // Buscar todas as mensagens de um TELEFONE (histórico completo do cliente)
  async getMessagesByPhone(phoneNumber: string): Promise<ChatMessage[]> {
    const prefix = `chat:${phoneNumber}:`;
    const messages = await kv.getByPrefix(prefix);
    
    // Ordenar por timestamp
    return messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  // MANTER para compatibilidade: Buscar mensagens de uma assistência específica
  async getMessages(assistenciaId: number): Promise<ChatMessage[]> {
    // Buscar TODAS as mensagens e filtrar por assistencia_id
    const allMessages = await kv.getByPrefix('chat:');
    
    return allMessages
      .filter((msg: ChatMessage) => msg.assistencia_id === assistenciaId)
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  },

  // Atualizar status da mensagem
  async updateMessageStatus(phoneNumber: string, messageId: string, status: ChatMessage['status']): Promise<void> {
    const key = `chat:${phoneNumber}:${messageId}`;
    const message = await kv.get(key);
    
    if (message) {
      message.status = status;
      await kv.set(key, message);
      console.log(`✓ Status da mensagem ${messageId} atualizado para: ${status}`);
    }
  },

  // Gerar ID único para mensagem
  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  },
};

// Criar rotas de chat
export function createChatRoutes() {
  const app = new Hono();
  const zapiClient = new ZApiClient();

  // 📤 Enviar mensagem do técnico para o cliente
  app.post('/send', async (c) => {
    try {
      console.log('🔥🔥🔥 ===== ENDPOINT /chat/send CHAMADO =====');
      
      const body = await c.req.json();
      console.log('📦 Body recebido:', JSON.stringify(body, null, 2));
      
      let { assistencia_id, message, phone_number, media_url, media_type } = body;

      // 🔑 Se assistencia_id for string composta "finalizada-X", resolver o id_assistencia real
      let assistencia_id_real = null;
      if (typeof assistencia_id === 'string' && assistencia_id.startsWith('finalizada-')) {
        // 🔧 FIX v9: Extrair ID de finalizacao e buscar id_assistencia real
        const finalizacaoId = parseInt(assistencia_id.replace('finalizada-', ''));
        console.log(`🔍 ID composto detectado: ${assistencia_id} → buscando id_assistencia real da finalizacao #${finalizacaoId}...`);
        
        if (!isNaN(finalizacaoId)) {
          try {
            const { data: finData } = await getChatSupabase()
              .from('assistencia_finalizada')
              .select('id_assistencia')
              .eq('id', finalizacaoId)
              .single();
            
            if (finData?.id_assistencia) {
              assistencia_id_real = finData.id_assistencia;
              console.log(`✅ id_assistencia real encontrado: ${assistencia_id_real} (via finalizacao #${finalizacaoId})`);
            } else {
              console.warn(`⚠️ Finalizacao #${finalizacaoId} não encontrada ou sem id_assistencia`);
            }
          } catch (lookupErr) {
            console.error(`❌ Erro ao buscar id_assistencia da finalizacao #${finalizacaoId}:`, lookupErr);
          }
        }
      } else {
        assistencia_id_real = assistencia_id;
      }

      // Validações
      if (!assistencia_id || !phone_number) {
        console.error('❌ Validação falhou: campos obrigatórios ausentes');
        console.error('   assistencia_id:', assistencia_id);
        console.error('   phone_number:', phone_number);
        return c.json({ error: 'assistencia_id e phone_number são obrigatórios' }, 400);
      }

      if (!message && !media_url) {
        console.error('❌ Validação falhou: nenhum conteúdo fornecido');
        return c.json({ error: 'É necessário fornecer message ou media_url' }, 400);
      }

      if (media_url && !media_type) {
        console.error('❌ Validação falhou: media_type ausente quando media_url fornecida');
        return c.json({ error: 'media_type é obrigatório quando media_url é fornecida' }, 400);
      }

      console.log(`📤 Enviando mensagem para assistência #${assistencia_id}`);
      console.log(`   Telefone: ${phone_number}`);
      console.log(`   Mensagem: ${message?.substring(0, 100)}`);
      console.log(`   Mídia URL: ${media_url || 'N/A'}`);
      console.log(`   Tipo Mídia: ${media_type || 'N/A'}`);

      let zapiResult;
      
      // 🔁 SISTEMA DE RETRY: Tentar até 3 vezes em caso de erro temporário
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000; // 2 segundos entre tentativas
      
      let lastError = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`🔄 Tentativa ${attempt}/${MAX_RETRIES} de envio via Z-API...`);
        
        try {
          // Se tem mídia, enviar como imagem/documento
          if (media_url && media_type) {
            console.log(`📎 Enviando com mídia: ${media_type}`);
            if (media_type === 'image') {
              console.log(`🖼️ Enviando imagem via Z-API`);
              zapiResult = await zapiClient.sendImage(phone_number, media_url, message);
            } else if (media_type === 'document') {
              console.log(`📄 Enviando documento via Z-API`);
              zapiResult = await zapiClient.sendDocument(phone_number, media_url, message || 'Documento');
            } else {
              console.error(`❌ Tipo de mídia não suportado: ${media_type}`);
              return c.json({ error: `Tipo de mídia não suportado: ${media_type}` }, 400);
            }
          } else if (message) {
            // Enviar apenas texto
            console.log(`💬 Enviando mensagem de texto via Z-API`);
            zapiResult = await zapiClient.sendMessage({ phone: phone_number, message });
            console.log(`📊 Resultado Z-API:`, zapiResult);
          } else {
            console.error('❌ Nem mensagem nem mídia fornecida');
            return c.json({ error: 'É necessário fornecer message ou media_url' }, 400);
          }
          
          // Se sucesso, sair do loop de retry
          if (zapiResult.success) {
            console.log(`✅ Mensagem enviada com sucesso na tentativa ${attempt}`);
            break;
          }
          
          // Se falhou, verificar se deve tentar novamente
          lastError = zapiResult.error;
          const shouldRetry = (
            lastError?.includes('TIMEOUT') || 
            lastError?.includes('timeout') ||
            lastError?.includes('network') ||
            lastError?.includes('ECONNREFUSED') ||
            lastError?.includes('ENOTFOUND')
          );
          
          if (!shouldRetry) {
            console.log(`❌ Erro não recuperável: ${lastError} - parando retries`);
            break;
          }
          
          if (attempt < MAX_RETRIES) {
            console.log(`⏳ Aguardando ${RETRY_DELAY_MS}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
          
        } catch (retryError) {
          console.error(`❌ Erro na tentativa ${attempt}:`, retryError.message);
          lastError = retryError.message;
          
          if (attempt < MAX_RETRIES) {
            console.log(`⏳ Aguardando ${RETRY_DELAY_MS}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }
      
      // Se todas as tentativas falharam
      if (!zapiResult) {
        zapiResult = { success: false, error: lastError || 'Todas as tentativas falharam' };
      }

      if (!zapiResult.success) {
        console.error('❌ Z-API retornou erro:', zapiResult.error);
        
        // 🔧 TRATAMENTO MELHORADO DE ERROS
        // Não falhar silenciosamente - retornar erro específico
        let errorMessage = zapiResult.error || 'Erro desconhecido ao enviar via Z-API';
        
        // Erros comuns e suas soluções
        const errorSolutions = {
          'NOT_FOUND': 'Número do WhatsApp não encontrado ou inválido',
          'DISCONNECTED': 'Instância Z-API desconectada. Reconecte pelo painel Z-API',
          'UNAUTHORIZED': 'Credenciais Z-API inválidas. Verifique Token e Client-Token',
          'TIMEOUT': 'Timeout ao enviar mensagem. Tente novamente',
          'client-token': 'Client-Token não configurado. Configure a variável de ambiente ZAPI_CLIENT_TOKEN',
          'RATE_LIMIT': 'Limite de mensagens atingido. Aguarde alguns minutos',
        };
        
        // Verificar se é um erro conhecido
        for (const [key, solution] of Object.entries(errorSolutions)) {
          if (errorMessage.includes(key)) {
            errorMessage = solution;
            break;
          }
        }
        
        console.error('❌ Erro amigável:', errorMessage);
        return c.json({ 
          success: false,
          error: 'Falha ao enviar mensagem WhatsApp', 
          details: errorMessage 
        }, 500);
      }

      console.log(`✅ Mensagem enviada via Z-API com sucesso! MessageID: ${zapiResult.messageId}`);

      // Salvar mensagem no histórico (KV Store - Legacy)
      console.log('💾 Iniciando salvamento no KV Store...');
      const chatMessage: ChatMessage = {
        id: ChatService.generateMessageId(),
        assistencia_id,
        sender: 'tecnico',
        message: message || '',
        media_url,
        media_type,
        phone_number,
        timestamp: new Date().toISOString(),
        status: 'sent',
        z_api_message_id: zapiResult.messageId,
      };

      await ChatService.saveMessage(chatMessage);
      console.log('✅ Mensagem salva no KV Store');

      // 🆕 Salvar TAMBÉM na tabela whats_messages (novo sistema)
      console.log('🗄️ Iniciando salvamento na tabela whats_messages...');
      // 🔥 OTIMIZAÇÃO: Usar singleton em vez de criar novo client
      const supabase = getChatSupabase();

      // Garantir que o contato existe
      // Formatar telefone para Z-API (sem +) e E.164 (com +)
      const phoneForZApi = formatPhoneForZApi(phone_number);
      const phone_e164 = phoneForZApi.startsWith('+') ? phoneForZApi : `+${phoneForZApi}`;
      console.log(`📞 Telefone formatado Z-API: ${phoneForZApi}`);
      console.log(`📞 Telefone formatado E.164: ${phone_e164}`);
      
      // Buscar ou criar contato
      console.log('🔍 Buscando contato no banco...');
      let { data: contact, error: contactError } = await supabase
        .from('whats_contacts')
        .select('*')
        .eq('phone_e164', phone_e164)
        .maybeSingle();
      
      if (contactError) {
        console.error('❌ Erro ao buscar contato:', contactError);
      }
      
      if (!contact) {
        console.log('➕ Contato não existe. Criando novo...');
        const { data: newContact, error: insertError } = await supabase
          .from('whats_contacts')
          .insert({ phone_e164 })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Erro ao criar contato:', insertError);
          throw new Error(`Erro ao criar contato: ${insertError.message}`);
        }
        
        contact = newContact;
        console.log(`✅ Contato criado com ID: ${contact.id}`);
      } else {
        console.log(`✅ Contato encontrado com ID: ${contact.id}`);
      }

      // Buscar ou criar conversa
      console.log('🔍 Buscando conversa no banco...');
      let conversationQuery = supabase
        .from('whats_conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Só filtrar por id_assistencia se for um ID real (não composto)
      if (assistencia_id_real !== null) {
        conversationQuery = conversationQuery.eq('id_assistencia', assistencia_id_real);
      }
      
      let { data: conversation, error: convError } = await conversationQuery.maybeSingle();
      
      if (convError) {
        console.error('❌ Erro ao buscar conversa:', convError);
      }
      
      if (!conversation) {
        // 🔧 FIX v9: Garantir que id_assistencia nunca é null (NOT NULL constraint)
        if (assistencia_id_real === null || assistencia_id_real === undefined) {
          console.error(`❌ id_assistencia é null - não é possível criar conversa. assistencia_id original: ${assistencia_id}`);
          throw new Error(`Não foi possível resolver o ID da assistência (${assistencia_id}). Verifique se o chamado existe.`);
        }
        
        console.log(`➕ Conversa não existe. Criando nova com id_assistencia=${assistencia_id_real}...`);
        const { data: newConversation, error: insertConvError } = await supabase
          .from('whats_conversations')
          .insert({
            contact_id: contact.id,
            id_assistencia: assistencia_id_real,
            channel: 'zapi_main',
            status: 'open',
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (insertConvError) {
          console.error('❌ Erro ao criar conversa:', insertConvError);
          throw new Error(`Erro ao criar conversa: ${insertConvError.message}`);
        }
        
        conversation = newConversation;
        console.log(`✅ Conversa criada com ID: ${conversation.id}`);
      } else {
        console.log(`✅ Conversa encontrada com ID: ${conversation.id}`);
      }

      // Salvar mensagem na tabela whats_messages com direction: 'out'
      console.log('💬 Salvando mensagem na tabela whats_messages...');
      const messagePayload = {
        conversation_id: conversation.id,
        direction: 'out', // ✅ Mensagem SAINDO do técnico
        from_phone: null, // Sistema/técnico não tem número
        to_phone: phone_e164, // ✅ Indo PARA o cliente
        type: media_type === 'image' ? 'image' : (media_type ? media_type : 'text'),
        body: message || '',
        media_url: media_url,
        sent_at: new Date().toISOString(),
        source: 'edge_function',
        provider_message_id: zapiResult.messageId || null,
        // ❌ REMOVIDO: status - coluna não existe na tabela
      };
      
      console.log('📦 Payload da mensagem:', JSON.stringify(messagePayload, null, 2));
      
      const { data: savedMessage, error: msgError } = await supabase
        .from('whats_messages')
        .insert(messagePayload)
        .select()
        .single();
      
      if (msgError) {
        console.error('❌ Erro ao salvar mensagem:', msgError);
        throw new Error(`Erro ao salvar mensagem: ${msgError.message}`);
      }
      
      console.log(`✅ Mensagem salva no banco com ID: ${savedMessage.id}`);

      // Atualizar timestamp da conversa
      console.log('⏰ Atualizando timestamp da conversa...');
      const { error: updateError } = await supabase
        .from('whats_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
      
      if (updateError) {
        console.error('⚠️ Erro ao atualizar timestamp (não crítico):', updateError);
      } else {
        console.log('✅ Timestamp da conversa atualizado');
      }

      console.log(`✅✅✅ Mensagem enviada e salva com sucesso (KV + whats_messages)`);

      // Retornar os dados da mensagem salva no banco (mais completo)
      return c.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: {
          // Dados do KV Store (compatibilidade com código antigo)
          ...chatMessage,
          // Dados do banco (mais completos)
          db_message_id: savedMessage.id,
          conversation_id: conversation.id,
          contact_id: contact.id,
        },
      });

    } catch (error) {
      console.error('❌❌❌ ERRO CRÍTICO ao enviar mensagem ❌❌❌');
      console.error('   Tipo do erro:', error.constructor?.name || 'Unknown');
      console.error('   Mensagem:', error.message);
      console.error('   Stack trace:', error.stack);
      
      // 🔒 SEGURANÇA: Ocultar detalhes técnicos sensíveis do usuário final
      // Apenas logar no servidor, retornar mensagem genérica
      let userMessage = 'Erro ao processar envio da mensagem';
      
      // Identificar tipo de erro para mensagem mais específica (mas sem expor dados sensíveis)
      if (error.message?.includes('Supabase') || error.message?.includes('database')) {
        userMessage = 'Erro ao salvar mensagem no banco de dados';
        console.error('   🔍 Tipo: Erro de banco de dados');
      } else if (error.message?.includes('Z-API') || error.message?.includes('fetch')) {
        userMessage = 'Erro ao comunicar com serviço de WhatsApp';
        console.error('   🔍 Tipo: Erro de comunicação Z-API');
      } else if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
        userMessage = 'Tempo limite excedido ao enviar mensagem';
        console.error('   🔍 Tipo: Timeout');
      }
      
      return c.json({ 
        success: false,
        error: userMessage, 
        details: error.message // Detalhes para debug (frontend deve ocultar do usuário)
      }, 500);
    }
  });

  // 📥 Webhook para receber mensagens do cliente via Z-API
  app.all('/webhook', async (c) => {  // Mudado para app.all() para aceitar qualquer método
    try {
      // ✅ PRIMEIRO: Logar TUDO antes de processar
      console.log('🔥🔥🔥 ===== WEBHOOK RECEBEU UMA REQUISIÇÃO =====');
      console.log('⏰ Timestamp:', new Date().toISOString());
      console.log('📍 URL:', c.req.url);
      console.log('🌐 Method:', c.req.method);
      console.log('📨 Headers:', JSON.stringify(Object.fromEntries(c.req.raw.headers.entries()), null, 2));
      
      // Salvar LOG imediatamente para debug
      const logId = `webhook_log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Tentar ler o body
      let body;
      let bodyRaw = '';
      try {
        bodyRaw = await c.req.text();
        console.log('📄 Body RAW:', bodyRaw);
        
        if (bodyRaw) {
          body = JSON.parse(bodyRaw);
          console.log('📦 Body parseado com sucesso:', JSON.stringify(body, null, 2));
        } else {
          console.log('⚠️ Body vazio');
          body = {};
        }
      } catch (e) {
        console.error('❌ Erro ao parsear body JSON:', e.message);
        console.log('📄 Body como texto:', bodyRaw);
        body = { raw_text: bodyRaw };
      }
      
      // SALVAR LOG NO KV STORE (para debug posterior)
      await kv.set(logId, {
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        method: c.req.method,
        url: c.req.url,
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        body: body,
        body_raw: bodyRaw,
      });
      
      console.log(`💾 Log salvo com ID: ${logId}`);
      console.log('🔥🔥🔥 ===== FIM DO LOG INICIAL =====');
      
      // ✅ DETECTAR SE É UM TESTE MANUAL (não vem do Z-API)
      if (body.test === true || body.from === 'TestWebhook Component') {
        console.log('🧪 ===== REQUISIÇÃO DE TESTE DETECTADA =====');
        console.log('   Respondendo com sucesso sem processar...');
        return c.json({ 
          success: true, 
          message: 'Teste recebido com sucesso! Este é o endpoint real de webhook.',
          log_id: logId,
          note: 'Esta era uma requisição de teste. Mensagens reais do Z-API serão processadas normalmente.'
        }, 200);
      }
      
      console.log('📥 ===== PROCESSANDO WEBHOOK Z-API =====');
      
      // Tentar múltiplos formatos de dados que a Z-API pode enviar
      // Formato pode variar: direto no body, ou dentro de "data", "message", etc
      const messageData = body.data || body.message || body;
      
      console.log('📦 Dados da mensagem extraídos:', JSON.stringify(messageData, null, 2));

      // Extrair campos com fallbacks para diferentes formatos
      const phone = messageData.phone || messageData.from || messageData.remoteJid || '';
      const messageId = messageData.messageId || messageData.id || messageData.key?.id || '';
      const fromMe = messageData.fromMe || messageData.isFromMe || false;
      
      // IMPORTANTE: Z-API envia texto em text.message (objeto aninhado)
      let text = '';
      if (messageData.text) {
        if (typeof messageData.text === 'object' && messageData.text.message) {
          text = messageData.text.message; // Formato Z-API oficial
        } else if (typeof messageData.text === 'string') {
          text = messageData.text; // Formato alternativo
        }
      } else {
        text = messageData.body || messageData.content || '';
      }
      
      const image = messageData.image || messageData.imageMessage;
      const document = messageData.document || messageData.documentMessage;
      const timestamp = messageData.timestamp || messageData.messageTimestamp || messageData.momment || Date.now();
      const chatName = messageData.chatName || messageData.notifyName || messageData.pushName || '';

      console.log('📱 CAMPOS EXTRAÍDOS:');
      console.log(`   - phone: ${phone}`);
      console.log(`   - messageId: ${messageId}`);
      console.log(`   - fromMe: ${fromMe}`);
      console.log(`   - text: ${text}`);
      console.log(`   - chatName: ${chatName}`);
      console.log(`   - timestamp: ${timestamp}`);

      // Validação básica
      if (!phone) {
        console.error('❌ ERRO: Telefone não encontrado no webhook!');
        console.error('   Body completo:', JSON.stringify(body, null, 2));
        return c.json({ error: 'Phone number not found in webhook data' }, 400);
      }

      // Ignorar mensagens enviadas por nós
      if (fromMe) {
        console.log('⏭️ Mensagem ignorada (enviada por nós)');
        return c.json({ success: true, message: 'Mensagem própria ignorada' });
      }

      console.log(`📱 Processando mensagem de ${phone}: ${text || '[mídia]'}`);
      console.log(`   Nome do contato: ${chatName || 'Desconhecido'}`);

      // 🔍 Buscar assistência relacionada ao telefone no Supabase
      // 🔥 OTIMIZAÇÃO: Usar singleton em vez de criar novo client
      const supabase = getChatSupabase();

      // Limpar telefone para comparação (remover caracteres especiais)
      const phoneCleaned = phone.replace(/\D/g, '');
      console.log(`🔍 ===== DEBUG WEBHOOK TELEFONE =====`);
      console.log(`   📞 Telefone recebido da Z-API: ${phone}`);
      console.log(`   📞 Telefone limpo: ${phoneCleaned}`);
      console.log(`   📏 Tamanho: ${phoneCleaned.length} dígitos`);
      console.log(`   🔍 Buscando assistência com este telefone...`);
      console.log(`==========================================`);

      // 🎯 SOLUÇÃO: Criar TODAS as variações possíveis do telefone
      // Problema: Z-API envia sem o "9", mas banco pode ter com o "9" (ou vice-versa)
      const phoneVariations: string[] = [phoneCleaned];
      
      // Extrair parte sem o código do país para análise
      let phoneWithoutCountry = phoneCleaned;
      if (phoneCleaned.startsWith('55')) {
        phoneWithoutCountry = phoneCleaned.substring(2);
      }
      
      console.log(`   📱 Telefone base: ${phoneCleaned}`);
      console.log(`   📱 Sem código país: ${phoneWithoutCountry}`);
      console.log(`   📏 Tamanho: ${phoneWithoutCountry.length} dígitos`);
      
      // Se tem 11 dígitos (DDD + 9 + 8 dígitos) - criar variação SEM o 9
      if (phoneWithoutCountry.length === 11) {
        const ddd = phoneWithoutCountry.substring(0, 2);
        const withoutNine = ddd + phoneWithoutCountry.substring(3); // Remove o 9
        
        // Adicionar variações SEM o 9
        phoneVariations.push(withoutNine);
        if (phoneCleaned.startsWith('55')) {
          phoneVariations.push('55' + withoutNine);
        }
        
        console.log(`   ✅ Variação criada SEM o 9: ${withoutNine}`);
      }
      // Se tem 10 dígitos (DDD + 8 dígitos) - criar variação COM o 9
      else if (phoneWithoutCountry.length === 10) {
        const ddd = phoneWithoutCountry.substring(0, 2);
        const withNine = ddd + '9' + phoneWithoutCountry.substring(2); // Adiciona o 9
        
        // Adicionar variações COM o 9
        phoneVariations.push(withNine);
        if (phoneCleaned.startsWith('55')) {
          phoneVariations.push('55' + withNine);
        }
        
        console.log(`   ✅ Variação criada COM o 9: ${withNine}`);
      }
      
      // Remover duplicatas
      const uniquePhones = [...new Set(phoneVariations)];
      console.log(`   📋 Total de variações: ${uniquePhones.length}`);
      console.log(`   📋 Variações a buscar:`, uniquePhones);

      // Tentar buscar com TODAS as variações
      let assistencia_id = 0;
      let foundPhone = '';
      
      for (const phoneVar of uniquePhones) {
        console.log(`   🔍 Tentando buscar com: "${phoneVar}"`);
        
        // 🔧 NORMALIZADO: Buscar telefone na tabela clientes (source of truth) via JOIN
        const { data: clientesComTelefone } = await supabase
          .from('clientes')
          .select('id, proprietario, telefone')
          .eq('telefone', phoneVar)
          .limit(1);

        if (clientesComTelefone && clientesComTelefone.length > 0) {
          const clienteEncontrado = clientesComTelefone[0];
          // Buscar assistência mais recente deste cliente
          const { data: assistencias } = await supabase
            .from('Assistência Técnica')
            .select('id, status_chamado')
            .eq('id_cliente', clienteEncontrado.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (assistencias && assistencias.length > 0) {
            assistencia_id = assistencias[0].id;
          }
          foundPhone = phoneVar;
          console.log(`   ✅ ✅ ✅ ENCONTRADO com "${phoneVar}"!`);
          console.log(`   ✅ Cliente: ${clienteEncontrado.proprietario}, Assistência #${assistencia_id}`);
          break;
        } else {
          console.log(`   ⚠️ Não encontrado com "${phoneVar}"`);
        }
      }

      if (!assistencia_id) {
        console.log(`⚠️ Nenhuma assistência encontrada após tentar ${uniquePhones.length} variações`);
      }

      // Salvar mensagem
      const chatMessage: ChatMessage = {
        id: ChatService.generateMessageId(),
        assistencia_id,
        sender: 'cliente',
        message: text || '',
        media_url: image?.url || document?.url,
        media_type: image ? 'image' : document ? 'document' : undefined,
        phone_number: phoneCleaned,
        timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : 
                   momment ? new Date(momment * 1000).toISOString() : 
                   new Date().toISOString(),
        status: 'delivered',
        z_api_message_id: messageId,
      };

      // Salvar mensagem (SEMPRE, independente de ter assistência ou não)
      await ChatService.saveMessage(chatMessage);
      
      console.log('✅ ===== MENSAGEM SALVA =====');
      console.log(`   📞 Telefone: ${phoneCleaned}`);
      console.log(`   🔑 Chave: chat:${phoneCleaned}:${chatMessage.id}`);
      console.log(`   🆔 Assistência: #${assistencia_id || 'não associada'}`);
      console.log(`   💬 Mensagem: ${text}`);
      console.log(`   👤 Sender: ${chatMessage.sender}`);
      console.log('=============================');

      console.log('✅ ===== WEBHOOK PROCESSADO COM SUCESSO =====');

      return c.json({ success: true, message: 'Webhook processado' });

    } catch (error) {
      console.error('❌ ===== ERRO AO PROCESSAR WEBHOOK =====');
      console.error('   Tipo:', error.constructor.name);
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
      console.error('===== FIM DO ERRO =====');
      return c.json({ error: 'Erro ao processar webhook', details: error.message }, 500);
    }
  });

  // 📥 NOVO: Webhook otimizado para receber do n8n
  app.post('/webhook-n8n', async (c) => {
    try {
      console.log('⚡ ===== WEBHOOK N8N RECEBEU REQUISIÇÃO =====');
      console.log('⏰ Timestamp:', new Date().toISOString());
      
      // 🔒 SEGURANÇA: Validar Bearer token
      const authHeader = c.req.header('Authorization');
      const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');
      
      if (n8nToken) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          console.error('❌ SEGURANÇA: Authorization header ausente ou inválido');
          return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401);
        }
        
        const token = authHeader.substring(7); // Remove "Bearer "
        if (token !== n8nToken) {
          console.error('❌ SEGURANÇA: Token inválido');
          return c.json({ error: 'Unauthorized: Invalid token' }, 401);
        }
        
        console.log('✅ SEGURANÇA: Token validado com sucesso');
      } else {
        console.warn('⚠️ SEGURANÇA: N8N_WEBHOOK_TOKEN não configurado - webhook sem autenticação!');
      }
      
      const body = await c.req.json();
      console.log('📦 Body recebido (tamanho):', JSON.stringify(body).length, 'caracteres');
      
      // ✅ DETECTAR REQUISIÇÃO DE TESTE
      if (body.test === true) {
        console.log('🧪 ===== REQUISIÇÃO DE TESTE DETECTADA =====');
        console.log('   Respondendo com sucesso sem processar...');
        return c.json({ 
          success: true, 
          message: 'Webhook n8n está online e funcionando!',
          timestamp: new Date().toISOString(),
          note: 'Esta era uma requisição de teste. Mensagens reais do Z-API/n8n serão processadas normalmente.'
        }, 200);
      }
      
      // Salvar LOG
      const logId = `webhook_n8n_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await kv.set(logId, {
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        source: 'n8n',
        body: body,
      });
      
      console.log(`💾 Log salvo: ${logId}`);
      
      // Extrair dados - tentar múltiplos níveis de aninhamento
      // Z-API pode enviar em diferentes formatos: direto, dentro de "data", "message", etc
      let messageData = body;
      
      // Se tiver "data", usar ele
      if (body.data) {
        console.log('📂 Encontrado "data" no body');
        messageData = body.data;
      }
      // Se tiver "message", usar ele
      else if (body.message) {
        console.log('📂 Encontrado "message" no body');
        messageData = body.message;
      }
      // Se tiver "body", usar ele
      else if (body.body && typeof body.body === 'object') {
        console.log('📂 Encontrado "body" no body');
        messageData = body.body;
      }
      
      console.log('📦 MessageData extraído:', JSON.stringify(messageData, null, 2));
      
      // Extrair telefone com MÚLTIPLOS fallbacks
      let phone = '';
      
      // Tentar diferentes campos onde o telefone pode estar
      const phoneCandidates = [
        messageData.phone,
        messageData.from,
        messageData.remoteJid,
        messageData.chatId,
        messageData.sender,
        messageData.key?.remoteJid,
        messageData.instanceId,
        // Alguns provedores colocam dentro de "chat"
        messageData.chat?.id,
        messageData.chat?.phone,
        // Alguns colocam dentro de "contact"
        messageData.contact?.id,
        messageData.contact?.phone,
      ];
      
      console.log('🔍 Candidatos a telefone:', phoneCandidates);
      
      // Pegar o primeiro que não for undefined/null/vazio
      for (const candidate of phoneCandidates) {
        if (candidate && String(candidate).trim()) {
          phone = String(candidate).trim();
          console.log(`✅ Telefone encontrado em: ${candidate}`);
          break;
        }
      }
      
      const messageId = messageData.messageId || messageData.id || messageData.key?.id || '';
      const fromMe = messageData.fromMe || messageData.isFromMe || false;
      
      // Extrair texto com múltiplos fallbacks
      let text = '';
      if (messageData.text) {
        if (typeof messageData.text === 'object' && messageData.text.message) {
          text = messageData.text.message;
        } else if (typeof messageData.text === 'string') {
          text = messageData.text;
        }
      } else {
        text = messageData.body || messageData.content || messageData.message || '';
      }
      
      const image = messageData.image || messageData.imageMessage;
      const document = messageData.document || messageData.documentMessage;
      const timestamp = messageData.timestamp || messageData.messageTimestamp || messageData.momment || Date.now();
      const chatName = messageData.chatName || messageData.notifyName || messageData.pushName || '';

      console.log('📱 ===== DADOS EXTRAÍDOS =====');
      console.log(`   📞 Phone: "${phone}"`);
      console.log(`   💬 Text: "${text}"`);
      console.log(`   👤 Name: "${chatName}"`);
      console.log(`   🆔 MessageId: "${messageId}"`);
      console.log(`   🤖 FromMe: ${fromMe}`);
      console.log(`   ⏰ Timestamp: ${timestamp}`);
      console.log('==============================');

      if (!phone) {
        console.error('❌ ===== TELEFONE NÃO ENCONTRADO =====');
        console.error('Body completo:', JSON.stringify(body, null, 2));
        console.error('MessageData:', JSON.stringify(messageData, null, 2));
        console.error('=======================================');
        return c.json({ 
          error: 'Phone number required',
          debug: {
            body_received: body,
            message_data: messageData,
            log_id: logId,
          }
        }, 400);
      }

      if (fromMe) {
        console.log('️ Mensagem própria ignorada');
        return c.json({ success: true, message: 'Own message ignored' });
      }

      // Buscar assistência
      // 🔥 OTIMIZAÇÃO: Usar singleton em vez de criar novo client
      const supabase = getChatSupabase();

      const phoneCleaned = phone.replace(/\D/g, '');
      console.log(`🔍 Buscando assistência para: ${phoneCleaned}`);

      // 🔧 NORMALIZADO: Buscar telefone na tabela clientes (source of truth)
      const { data: clientesMatch } = await supabase
        .from('clientes')
        .select('id, proprietario')
        .eq('telefone', phoneCleaned)
        .limit(1);

      let assistencia_id = 0;
      if (clientesMatch && clientesMatch.length > 0) {
        const { data: assistencias } = await supabase
          .from('Assistência Técnica')
          .select('id, status_chamado')
          .eq('id_cliente', clientesMatch[0].id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (assistencias && assistencias.length > 0) {
          assistencia_id = assistencias[0].id;
        }
        console.log(`✅ Cliente ${clientesMatch[0].proprietario} encontrado, Assistência #${assistencia_id}`);
      } else {
        console.log(`⚠️ Nenhum cliente com telefone ${phoneCleaned}`);
      }

      // Salvar mensagem
      const chatMessage: ChatMessage = {
        id: ChatService.generateMessageId(),
        assistencia_id,
        sender: 'cliente',
        message: text || '',
        media_url: image?.url || document?.url,
        media_type: image ? 'image' : document ? 'document' : undefined,
        phone_number: phoneCleaned,
        timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
        status: 'delivered',
        z_api_message_id: messageId,
      };

      await ChatService.saveMessage(chatMessage);
      
      console.log('✅ Mensagem salva com sucesso!');
      console.log(`   🔑 Key: chat:${phoneCleaned}:${chatMessage.id}`);
      console.log(`   🆔 Assistência: #${assistencia_id || 'N/A'}`);
      console.log('⚡ ===== FIM WEBHOOK N8N =====');

      return c.json({ 
        success: true, 
        message: 'Mensagem recebida e salva',
        assistencia_id,
        log_id: logId,
        debug: {
          phone_extracted: phoneCleaned,
          text_extracted: text,
        }
      });

    } catch (error) {
      console.error('❌ ===== ERRO NO WEBHOOK N8N =====');
      console.error('Erro:', error);
      console.error('Stack:', error.stack);
      console.error('===================================');
      return c.json({ 
        error: error.message,
        stack: error.stack,
      }, 500);
    }
  });

  // 📜 Buscar histórico de mensagens de uma assistência
  app.get('/:assistencia_id', async (c) => {
    try {
      const assistencia_id = parseInt(c.req.param('assistencia_id'));

      if (!assistencia_id) {
        return c.json({ error: 'assistencia_id inválido' }, 400);
      }

      console.log(`📜 Buscando mensagens da assistência #${assistencia_id}`);
      console.log(`🔍 Prefix usado: chat:${assistencia_id}:`);

      const messages = await ChatService.getMessages(assistencia_id);

      console.log(`✅ ${messages.length} mensagens encontradas`);
      console.log(`📊 Detalhes das mensagens:`, JSON.stringify(messages, null, 2));
      
      // Log individual de cada mensagem
      messages.forEach((msg, index) => {
        console.log(`   [${index}] ID: ${msg.id}, Sender: ${msg.sender}, Message: ${msg.message.substring(0, 50)}...`);
      });

      return c.json({
        success: true,
        data: messages,
      });

    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return c.json({ error: 'Erro ao buscar mensagens', details: error.message }, 500);
    }
  });

  // 📞 NOVO: Buscar histórico de mensagens por TELEFONE (histórico completo do cliente)
  app.get('/phone/:phone_number', async (c) => {
    try {
      const phone_number = c.req.param('phone_number');

      if (!phone_number) {
        return c.json({ error: 'phone_number inválido' }, 400);
      }

      console.log('🔍 ===== DEBUG BUSCA POR TELEFONE =====');
      console.log(`   📞 Parâmetro recebido: "${phone_number}"`);
      console.log(`   📏 Tamanho: ${phone_number.length} caracteres`);
      console.log(`   🔤 Tipo: ${typeof phone_number}`);
      console.log(`   🔢 Código do país (primeiros 2): ${phone_number.substring(0, 2)}`);
      console.log(`   🔍 Prefix que será usado: chat:${phone_number}:`);
      console.log('==========================================');

      const messages = await ChatService.getMessagesByPhone(phone_number);

      console.log(`✅ ${messages.length} mensagens encontradas`);
      
      // Log das assistências envolvidas
      const assistencias = [...new Set(messages.map(m => m.assistencia_id).filter(id => id > 0))];
      console.log(`📋 Assistências relacionadas: ${assistencias.join(', ')}`);

      return c.json({
        success: true,
        data: messages,
        meta: {
          total: messages.length,
          assistencias,
        },
      });

    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return c.json({ error: 'Erro ao buscar mensagens', details: error.message }, 500);
    }
  });

  // 🔔 Enviar notificação automática (usado internamente)
  app.post('/notify', async (c) => {
    try {
      const body = await c.req.json();
      const { assistencia_id, phone_number, event_type, data } = body;

      if (!assistencia_id || !phone_number || !event_type) {
        return c.json({ error: 'Campos obrigatórios: assistencia_id, phone_number, event_type' }, 400);
      }

      // 🌎 Função para determinar período do dia baseado na hora
      const obterPeriodo = (dataISO: string): string => {
        if (!dataISO) return '';
        
        try {
          const data = new Date(dataISO);
          const hora = data.getHours();
          const minuto = data.getMinutes();
          const totalMinutos = hora * 60 + minuto;
          
          // Noite: 00:00 - 04:01 ou 18:02 - 23:59
          if (totalMinutos <= 4 * 60 + 1 || totalMinutos >= 18 * 60 + 2) {
            return 'Noite';
          }
          // Manhã: 04:02 - 12:01
          else if (totalMinutos <= 12 * 60 + 1) {
            return 'Manhã';
          }
          // Tarde: 12:02 - 18:01
          else {
            return 'Tarde';
          }
        } catch (error) {
          console.error('Erro ao determinar período:', error);
          return '';
        }
      };

      // 🌎 Função para formatar data com período no fuso horário de São Paulo (UTC-3)
      const formatarDataComPeriodo = (dataISO: string): string => {
        if (!dataISO) return '';
        
        try {
          const data = new Date(dataISO);
          
          // Formatar no fuso horário de São Paulo (America/Sao_Paulo)
          const opcoes: Intl.DateTimeFormatOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
          };
          
          const dataFormatada = new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
          const periodo = obterPeriodo(dataISO);
          
          return `${dataFormatada} - ${periodo}`;
        } catch (error) {
          console.error('Erro ao formatar data:', error);
          return dataISO;
        }
      };

      // Templates de mensagens por evento
      const templates: Record<string, (data: any) => string> = {
        'chamado_aberto': (d) => 
          `🔧 *Chamado #${d.id} Aberto*

Olá ${d.nome}!

Sua solicitação foi registrada com sucesso.

📋 *Detalhes:*
• Categoria: ${d.categoria}
• Empreendimento: ${d.empreendimento}
• Unidade: Bloco ${d.bloco}, Apto ${d.apartamento}

Em breve entraremos em contato para agendar a vistoria\\n\\nOlá ${d.nome}!\\n\\nSua solicitação foi registrada com sucesso.\\n\\n📋 *Detalhes:*\\n• Categoria: ${d.categoria}\\n• Empreendimento: ${d.empreendimento}\\n• Unidade: Bloco ${d.bloco}, Apto ${d.apartamento}\\n\\nEm breve entraremos em contato para agendar a vistoria.`,
        
        'vistoria_agendada': (d) =>
          `📅 *Vistoria Agendada - Chamado #${d.id}*

Olá ${d.nome}!

Sua vistoria foi agendada:

🗓️ *Data:* ${formatarDataComPeriodo(d.data_vistoria)}
📍 *Local:* Bloco ${d.bloco}, Apto ${d.apartamento}

Por favor, esteja presente no local na data e período marcados\\n\\nOlá ${d.nome}!\\n\\nSua vistoria foi agendada:\\n\\n🗓️ *Data:* ${formatarDataComPeriodo(d.data_vistoria)}\\n📍 *Local:* Bloco ${d.bloco}, Apto ${d.apartamento}\\n\\nPor favor, esteja presente no local na data e período marcados.`,
        
        'reparo_agendado': (d) =>
          `🔨 *Reparo Agendado - Chamado #${d.id}*

Olá ${d.nome}!

O reparo foi agendado:

🗓️ *Data:* ${formatarDataComPeriodo(d.data_reparo)}
📍 *Local:* Bloco ${d.bloco}, Apto ${d.apartamento}

Nossa equipe estará presente para realizar o serviço\\n\\nOlá ${d.nome}!\\n\\nO reparo foi agendado:\\n\\n🗓️ *Data:* ${formatarDataComPeriodo(d.data_reparo)}\\n📍 *Local:* Bloco ${d.bloco}, Apto ${d.apartamento}\\n\\nNossa equipe estará presente para realizar o serviço.`,
        
        'reparo_concluido': (d) =>
          `✅ *Reparo Concluído - Chamado #${d.id}*

Olá ${d.nome}!

O reparo foi concluído com sucesso!

📋 *Próximo passo:*
Acesse o sistema para revisar e assinar o termo de conclusão.

Obrigado pela confiança! 🙏\\n\\nOlá ${d.nome}!\\n\\nO reparo foi concluído com sucesso!\\n\\n📋 *Próximo passo:*\\nAcesse o sistema para revisar e assinar o termo de conclusão.\\n\\nObrigado pela confiança! 🙏`,
      };

      const messageTemplate = templates[event_type];
      
      if (!messageTemplate) {
        return c.json({ error: `Evento desconhecido: ${event_type}` }, 400);
      }

      const message = messageTemplate(data);

      console.log(`🔔 Enviando notificação automática: ${event_type} para ${phone_number}`);

      // Enviar via Z-API
      const zapiResult = await zapiClient.sendMessage({
        phone: phone_number,
        message: message,
      });

      if (!zapiResult.success) {
        return c.json({ error: 'Erro ao enviar notificação', details: zapiResult.error }, 500);
      }

      // Salvar no histórico
      const chatMessage: ChatMessage = {
        id: ChatService.generateMessageId(),
        assistencia_id,
        sender: 'system',
        message,
        phone_number,
        timestamp: new Date().toISOString(),
        status: 'sent',
        z_api_message_id: zapiResult.messageId,
      };

      await ChatService.saveMessage(chatMessage);

      console.log(`✅ Notificação enviada com sucesso`);

      return c.json({
        success: true,
        message: 'Notificação enviada',
        data: chatMessage,
      });

    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
      return c.json({ error: 'Erro ao enviar notificação', details: error.message }, 500);
    }
  });

  // 🔍 DEBUG: Listar TODAS as mensagens (temporário)
  app.get('/debug/all', async (c) => {
    try {
      console.log('🔍 Listando TODAS as mensagens do KV Store...');
      
      const allMessages = await kv.getByPrefix('chat:');
      
      console.log(`📊 Total de mensagens encontradas: ${allMessages.length}`);
      
      // Agrupar por assistência
      const byAssistencia: Record<number, ChatMessage[]> = {};
      const unassociated: ChatMessage[] = [];
      
      allMessages.forEach((msg: ChatMessage) => {
        if (msg.assistencia_id === 0) {
          unassociated.push(msg);
        } else {
          if (!byAssistencia[msg.assistencia_id]) {
            byAssistencia[msg.assistencia_id] = [];
          }
          byAssistencia[msg.assistencia_id].push(msg);
        }
      });
      
      console.log(`📋 Assistências com mensagens:`, Object.keys(byAssistencia));
      console.log(`⚠️ Mensagens não associadas: ${unassociated.length}`);
      
      return c.json({
        success: true,
        total: allMessages.length,
        byAssistencia,
        unassociated,
      });
      
    } catch (error) {
      console.error('❌ Erro ao listar mensagens:', error);
      return c.json({ error: 'Erro ao listar mensagens', details: error.message }, 500);
    }
  });

  // 🔍 DEBUG: Listar chaves do KV e telefones
  app.get('/debug/keys', async (c) => {
    try {
      console.log('🔍 Listando CHAVES do KV Store...');
      
      const allMessages = await kv.getByPrefix('chat:');
      
      // Extrair informações das chaves
      const keyInfo = allMessages.map((msg: ChatMessage) => ({
        phone_number: msg.phone_number,
        assistencia_id: msg.assistencia_id,
        message_preview: msg.message?.substring(0, 50),
        timestamp: msg.timestamp,
        sender: msg.sender,
      }));
      
      // Agrupar por telefone
      const byPhone: Record<string, any[]> = {};
      keyInfo.forEach(info => {
        if (!byPhone[info.phone_number]) {
          byPhone[info.phone_number] = [];
        }
        byPhone[info.phone_number].push(info);
      });
      
      console.log('📱 Telefones encontrados:', Object.keys(byPhone));
      
      return c.json({
        success: true,
        total: allMessages.length,
        phones: Object.keys(byPhone),
        byPhone,
        rawKeys: keyInfo,
      });
      
    } catch (error) {
      console.error('❌ Erro ao listar chaves:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // 🔍 DEBUG: Buscar por telefone com variações
  app.get('/debug/phone/:phone', async (c) => {
    try {
      const phone = c.req.param('phone');
      
      console.log('🔍 ===== DEBUG BUSCA POR TELEFONE =====');
      console.log(`   📞 Telefone recebido: "${phone}"`);
      
      // Tentar várias variações do telefone
      const variations = [
        phone,
        phone.replace(/\D/g, ''), // Sem caracteres especiais
        '55' + phone.replace(/\D/g, ''), // Com código do país
        phone.replace(/\D/g, '').substring(2), // Sem código do país
      ];
      
      // Remover duplicatas
      const uniqueVariations = [...new Set(variations)];
      
      console.log('   🔄 Variações testadas:', uniqueVariations);
      
      const results: Record<string, any> = {};
      
      for (const variation of uniqueVariations) {
        const messages = await ChatService.getMessagesByPhone(variation);
        if (messages.length > 0) {
          results[variation] = {
            count: messages.length,
            messages: messages.map(m => ({
              id: m.id,
              message: m.message?.substring(0, 50),
              sender: m.sender,
              timestamp: m.timestamp,
            })),
          };
        }
      }
      
      console.log('   ✅ Resultados:', Object.keys(results));
      console.log('==========================================');
      
      return c.json({
        success: true,
        phone_searched: phone,
        variations_tested: uniqueVariations,
        results,
      });
      
    } catch (error) {
      console.error('❌ Erro:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // 🔧 CONFIGURAÇÃO Z-API: Salvar credenciais
  app.post('/config', async (c) => {
    try {
      console.log('🔧 Salvando configuração Z-API...');
      
      const body = await c.req.json();
      const { instance_id, token, client_token, base_url } = body;
      
      // Validação
      if (!instance_id || !token) {
        return c.json({ 
          success: false,
          error: 'instance_id e token são obrigatórios' 
        }, 400);
      }
      
      // Salvar no KV Store
      await kv.set('zapi_config', {
        instance_id,
        token,
        client_token: client_token || '',
        base_url: base_url || 'https://api.z-api.io',
        updated_at: new Date().toISOString(),
      });
      
      console.log('✅ Configuração Z-API salva com sucesso');
      console.log('   Instance ID:', instance_id);
      console.log('   Base URL:', base_url || 'https://api.z-api.io');
      console.log('   Client Token:', client_token ? 'Configurado' : 'Não configurado');
      
      // Recarregar credenciais no cliente Z-API
      await zapiClient.loadCredentials();
      
      return c.json({ 
        success: true,
        message: 'Configuração salva com sucesso. O sistema já está usando as novas credenciais.',
      });
      
    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
      return c.json({ 
        success: false,
        error: 'Erro ao salvar configuração', 
        details: error.message 
      }, 500);
    }
  });

  // 🔍 CONFIGURAÇÃO Z-API: Buscar credenciais atuais
  app.get('/config', async (c) => {
    try {
      const config = await kv.get('zapi_config');
      
      if (!config) {
        return c.json({ 
          success: false,
          configured: false,
          message: 'Nenhuma configuração encontrada. Configure as credenciais Z-API.',
        });
      }
      
      // Retornar configuração SEM expor tokens completos
      return c.json({ 
        success: true,
        configured: true,
        data: {
          instance_id: config.instance_id,
          base_url: config.base_url,
          has_client_token: !!config.client_token,
          updated_at: config.updated_at,
        },
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar configuração:', error);
      return c.json({ 
        success: false,
        error: 'Erro ao buscar configuração', 
        details: error.message 
      }, 500);
    }
  });

  // 🧪 TESTAR CONEXÃO Z-API
  app.post('/test-connection', async (c) => {
    try {
      console.log('🧪 Testando conexão Z-API...');
      
      const result = await zapiClient.testConnection();
      
      return c.json(result);
      
    } catch (error) {
      console.error('❌ Erro ao testar conexão:', error);
      return c.json({ 
        success: false,
        error: 'Erro ao testar conexão', 
        details: error.message 
      }, 500);
    }
  });

  // Retornar o app configurado
  return app;
}