import { Hono } from "npm:hono@4";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
// 🔥 OTIMIZAÇÃO v3: ZApiClient carregado sob demanda via lazy import
let _ZApiClientClass: any = null;
async function getZApiClient() {
  if (!_ZApiClientClass) {
    const chatModule = await import("./chat.tsx");
    _ZApiClientClass = chatModule.ZApiClient;
    console.log('✅ [whatsapp] ZApiClient carregado via lazy import');
  }
  return new _ZApiClientClass();
}

// ============================================================
// SERVIÇO DE WHATSAPP COM TABELAS RELACIONAIS
// ============================================================

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// 🔥 OTIMIZAÇÃO: Singleton do Supabase client (evita criar múltiplas instâncias)
let _supabaseInstance: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  if (!_supabaseInstance) {
    _supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseInstance;
}

// ============================================================
// HELPER: Garantir que o contato existe
// ============================================================
async function ensureContact(phone_e164: string, display_name?: string) {
  const supabase = getSupabaseClient();
  
  console.log(`🔍 Verificando contato: ${phone_e164}`);
  
  // Buscar contato existente
  const { data: existing } = await supabase
    .from('whats_contacts')
    .select('*')
    .eq('phone_e164', phone_e164)
    .single();
  
  if (existing) {
    console.log(`✅ Contato já existe: ID ${existing.id}`);
    return existing;
  }
  
  // Criar novo contato
  console.log(`📝 Criando novo contato: ${phone_e164}`);
  const { data: newContact, error } = await supabase
    .from('whats_contacts')
    .insert({
      phone_e164,
      display_name: display_name || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Erro ao criar contato:', error);
    throw new Error(`Erro ao criar contato: ${error.message}`);
  }
  
  console.log(`✅ Contato criado: ID ${newContact.id}`);
  return newContact;
}

// ============================================================
// HELPER: Garantir que a conversa existe
// ============================================================
async function ensureConversation(
  contact_id: number,
  id_assistencia: number,
  channel: string = 'zapi_main'
) {
  const supabase = getSupabaseClient();
  
  console.log(`🔍 Verificando conversa: contact_id=${contact_id}, assistencia=${id_assistencia}`);
  
  // Buscar conversa aberta existente
  const { data: existing } = await supabase
    .from('whats_conversations')
    .select('*')
    .eq('contact_id', contact_id)
    .eq('id_assistencia', id_assistencia)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (existing) {
    console.log(`✅ Conversa encontrada: ID ${existing.id}`);
    return existing;
  }
  
  // Criar nova conversa
  console.log(`📝 Criando nova conversa`);
  const { data: newConversation, error } = await supabase
    .from('whats_conversations')
    .insert({
      contact_id,
      id_assistencia,
      channel,
      status: 'open',
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Erro ao criar conversa:', error);
    throw new Error(`Erro ao criar conversa: ${error.message}`);
  }
  
  console.log(`✅ Conversa criada: ID ${newConversation.id}`);
  return newConversation;
}

// ============================================================
// HELPER: Atualizar last_message_at da conversa
// ============================================================
async function updateConversationTimestamp(conversation_id: number) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('whats_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation_id);
  
  if (error) {
    console.error('⚠️ Erro ao atualizar timestamp da conversa:', error);
  }
}

// ============================================================
// ROTAS
// ============================================================
export function createWhatsAppRoutes() {
  const app = new Hono();
  
  // Adicionar CORS para todas as rotas
  app.use('*', cors());
  
  // ============================================================
  // 🧪 TESTE SIMPLES: Verificar se o servidor está funcionando
  // ============================================================
  app.get('/test', async (c) => {
    console.log('🧪 Endpoint de teste do WhatsApp chamado!');
    return c.json({ 
      success: true, 
      message: 'WhatsApp routes estão funcionando!',
      timestamp: new Date().toISOString()
    });
  });
  
  // ============================================================
  // 📤 WEBHOOK PARA O MAKE.COM - ENVIAR MENSAGEM
  // ============================================================
  app.post('/send-from-make', async (c) => {
    try {
      console.log('📤 ===== MAKE.COM → ENVIO DE MENSAGEM =====');
      
      const body = await c.req.json();
      const { 
        id_assistencia, 
        phone_e164, 
        message, 
        display_name,
        media_url,
        type = 'text'
      } = body;
      
      console.log('Dados recebidos:', { id_assistencia, phone_e164, message: message?.substring(0, 50) });
      
      // Validação
      if (!id_assistencia || !phone_e164 || !message) {
        return c.json({ 
          error: 'Campos obrigatórios: id_assistencia, phone_e164, message' 
        }, 400);
      }
      
      // 1) Garantir que o contato existe
      const contact = await ensureContact(phone_e164, display_name);
      
      // 2) Garantir que a conversa existe
      const conversation = await ensureConversation(contact.id, id_assistencia);
      
      // 3) Enviar via Z-API usando ZApiClient
      console.log('📞 Enviando mensagem via Z-API...');
      const zapiClient = await getZApiClient();
      const sendResult = await zapiClient.sendMessage({
        phone: phone_e164,
        message: message,
      });
      
      if (!sendResult.success) {
        console.error('❌ Erro ao enviar via Z-API:', sendResult.error);
        throw new Error(`Erro ao enviar via Z-API: ${sendResult.error || 'Erro desconhecido'}`);
      }
      
      console.log('✅ Mensagem enviada via Z-API:', sendResult);
      
      // 4) Registrar mensagem em whats_messages
      const supabase = getSupabaseClient();
      const { data: messageRecord, error: msgError } = await supabase
        .from('whats_messages')
        .insert({
          conversation_id: conversation.id,
          direction: 'out',
          from_phone: null, // Número da empresa (se disponível)
          to_phone: phone_e164,
          type: type,
          body: message,
          media_url: media_url,
          sent_at: new Date().toISOString(),
          source: 'edge_function',
          provider_message_id: sendResult.messageId || null,
          raw_payload: sendResult,
        })
        .select()
        .single();
      
      if (msgError) {
        console.error('❌ Erro ao registrar mensagem:', msgError);
        // Não falhar a requisição, mensagem foi enviada
      } else {
        console.log(`✅ Mensagem registrada: ID ${messageRecord.id}`);
      }
      
      // 5) Atualizar timestamp da conversa
      await updateConversationTimestamp(conversation.id);
      
      return c.json({
        success: true,
        contact_id: contact.id,
        conversation_id: conversation.id,
        message_id: messageRecord?.id,
        provider_message_id: sendResult.messageId,
      });
      
    } catch (error) {
      console.error('❌ Erro no envio:', error);
      return c.json({ 
        error: 'Erro ao enviar mensagem', 
        details: error.message 
      }, 500);
    }
  });
  
  // ============================================================
  // 📥 WEBHOOK PARA O MAKE.COM - RECEBER MENSAGEM
  // ============================================================
  
  // ============================================================
  // 🔍 VERIFICAR SE CONTATO EXISTE (Para n8n validar antes de enviar)
  // ============================================================
  app.get('/check-contact', async (c) => {
    try {
      let phone_e164 = c.req.query('phone');
      
      if (!phone_e164) {
        return c.json({ error: 'Parâmetro obrigatório: phone' }, 400);
      }
      
      // Normalizar telefone: garantir que tenha o +
      if (!phone_e164.startsWith('+')) {
        // Remover caracteres não numéricos
        phone_e164 = phone_e164.replace(/\D/g, '');
        // Adicionar código do Brasil se necessário
        if (!phone_e164.startsWith('55')) {
          phone_e164 = '55' + phone_e164;
        }
        // Adicionar o +
        phone_e164 = '+' + phone_e164;
      }
      
      console.log(`🔍 Verificando existência do contato: ${phone_e164}`);
      
      const supabase = getSupabaseClient();
      
      // Buscar contato
      const { data: contact } = await supabase
        .from('whats_contacts')
        .select('id')
        .eq('phone_e164', phone_e164)
        .maybeSingle();
      
      if (!contact) {
        console.log(`❌ Contato não existe: ${phone_e164}`);
        return c.json({ 
          exists: false,
          message: 'Contato não encontrado. Aguarde o primeiro contato do sistema.' 
        });
      }
      
      // Buscar conversa ativa deste contato
      const { data: conversation } = await supabase
        .from('whats_conversations')
        .select('id, id_assistencia, status')
        .eq('contact_id', contact.id)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!conversation) {
        console.log(`⚠️ Contato existe mas não tem conversa ativa: ${phone_e164}`);
        return c.json({ 
          exists: false,
          message: 'Contato existe mas não tem conversa ativa' 
        });
      }
      
      console.log(`✅ Contato encontrado com conversa ativa: ${phone_e164}`);
      
      return c.json({
        exists: true,
        contact_id: contact.id,
        conversation_id: conversation.id,
        id_assistencia: conversation.id_assistencia,
      });
      
    } catch (error) {
      console.error('❌ Erro ao verificar contato:', error);
      return c.json({ 
        error: 'Erro ao verificar contato', 
        details: error.message 
      }, 500);
    }
  });
  
  // ============================================================
  // 📥 RECEBER MENSAGEM DO N8N
  // ============================================================
  app.post('/receive-from-n8n', async (c) => {
    try {
      console.log('📥 ===== n8n → MAKE → RECEBIMENTO DE MENSAGEM =====');
      
      const body = await c.req.json();
      const {
        phone_e164,
        provider_message_id,
        body: messageBody,
        type = 'text',
        media_url,
        media_mime_type,
        raw_payload,
        id_assistencia, // Opcional: se o n8n já souber
        display_name,
      } = body;
      
      console.log('📥 Mensagem RECEBIDA do cliente:', { 
        phone_e164, 
        provider_message_id, 
        body: messageBody?.substring(0, 50),
        id_assistencia,
      });
      
      // Validação
      if (!phone_e164) {
        return c.json({ error: 'Campo obrigatório: phone_e164' }, 400);
      }
      
      // Verificar se mensagem já foi processada (evitar duplicação)
      if (provider_message_id) {
        const supabase = getSupabaseClient();
        const { data: existing } = await supabase
          .from('whats_messages')
          .select('id')
          .eq('provider_message_id', provider_message_id)
          .maybeSingle();
        
        if (existing) {
          console.log(`⏭️ Mensagem ${provider_message_id} já processada`);
          return c.json({ 
            success: true, 
            message: 'Mensagem já processada',
            duplicate: true 
          });
        }
      }
      
      // 1) Garantir que o contato existe
      const contact = await ensureContact(phone_e164, display_name);
      
      // 2) Encontrar ou criar conversa
      let conversation;
      
      if (id_assistencia) {
        // Se já temos o ID da assistência, garantir conversa específica
        console.log(`✅ id_assistencia fornecido: ${id_assistencia}`);
        conversation = await ensureConversation(contact.id, id_assistencia);
      } else {
        // Buscar conversa aberta mais recente deste contato
        const supabase = getSupabaseClient();
        const { data: recentConversation } = await supabase
          .from('whats_conversations')
          .select('*')
          .eq('contact_id', contact.id)
          .eq('status', 'open')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentConversation) {
          console.log(`✅ Conversa recente encontrada: ID ${recentConversation.id}`);
          conversation = recentConversation;
        } else {
          // 🔧 NORMALIZADO: Buscar telefone na tabela clientes (source of truth)
          const phoneCleaned = phone_e164.replace(/\D/g, '');
          const { data: clientesMatch } = await supabase
            .from('clientes')
            .select('id')
            .eq('telefone', phoneCleaned)
            .limit(1);
          
          let assistencias: any[] | null = null;
          if (clientesMatch && clientesMatch.length > 0) {
            const { data } = await supabase
              .from('Assistência Técnica')
              .select('id')
              .eq('id_cliente', clientesMatch[0].id)
              .order('created_at', { ascending: false })
              .limit(1);
            assistencias = data;
          }
          
          if (assistencias && assistencias.length > 0) {
            const assistenciaId = assistencias[0].id;
            console.log(`✅ Assistência encontrada: ${assistenciaId}`);
            conversation = await ensureConversation(contact.id, assistenciaId);
          } else {
            // Criar conversa "genérica" sem assistência
            console.log('⚠️ Nenhuma assistência encontrada, criando conversa genérica');
            const { data: genericConversation, error } = await supabase
              .from('whats_conversations')
              .insert({
                contact_id: contact.id,
                id_assistencia: null,
                channel: 'zapi_main',
                status: 'open',
                last_message_at: new Date().toISOString(),
              })
              .select()
              .single();
            
            if (error) throw new Error(`Erro ao criar conversa: ${error.message}`);
            conversation = genericConversation;
          }
        }
      }
      
      // 3) Inserir mensagem
      const supabase = getSupabaseClient();
      const { data: messageRecord, error: msgError } = await supabase
        .from('whats_messages')
        .insert({
          conversation_id: conversation.id,
          direction: 'in',
          from_phone: phone_e164,
          to_phone: null, // Número da empresa
          type: type,
          body: messageBody,
          media_url: media_url,
          media_mime_type: media_mime_type,
          received_at: new Date().toISOString(),
          source: 'n8n_webhook',
          provider_message_id: provider_message_id,
          raw_payload: raw_payload || body,
        })
        .select()
        .single();
      
      if (msgError) {
        console.error('❌ Erro ao registrar mensagem:', msgError);
        throw new Error(`Erro ao registrar mensagem: ${msgError.message}`);
      }
      
      console.log(`✅ Mensagem registrada: ID ${messageRecord.id}`);
      
      // 4) Atualizar timestamp da conversa
      await updateConversationTimestamp(conversation.id);
      
      return c.json({
        success: true,
        contact_id: contact.id,
        conversation_id: conversation.id,
        message_id: messageRecord.id,
        id_assistencia: conversation.id_assistencia,
      });
      
    } catch (error) {
      console.error('❌ Erro no recebimento:', error);
      return c.json({ 
        error: 'Erro ao processar mensagem recebida', 
        details: error.message 
      }, 500);
    }
  });
  
  // ============================================================
  // 📊 BUSCAR HISTÓRICO DE MENSAGENS POR ASSISTÊNCIA
  // ============================================================
  app.get('/messages/:id_assistencia', async (c) => {
    try {
      const id_assistencia = parseInt(c.req.param('id_assistencia'));
      
      if (!id_assistencia) {
        return c.json({ error: 'id_assistencia inválido' }, 400);
      }
      
      const supabase = getSupabaseClient();
      
      // Buscar conversas desta assistência
      const { data: conversations } = await supabase
        .from('whats_conversations')
        .select('id')
        .eq('id_assistencia', id_assistencia);
      
      if (!conversations || conversations.length === 0) {
        return c.json({ success: true, data: [] });
      }
      
      const conversationIds = conversations.map(c => c.id);
      
      // Buscar mensagens dessas conversas
      const { data: messages, error } = await supabase
        .from('whats_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('❌ Erro ao buscar mensagens do banco:', error);
        console.error('   Detalhes:', JSON.stringify(error, null, 2));
        return c.json({ 
          success: false, 
          error: 'Erro ao buscar mensagens do banco de dados',
          details: error.message 
        }, 500);
      }
      
      return c.json({
        success: true,
        data: messages || [],
        total: messages?.length || 0,
      });
      
    } catch (error) {
      console.error('❌ Erro:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  // ============================================================
  // 📊 BUSCAR HISTÓRICO DE MENSAGENS POR TELEFONE
  // ============================================================
  app.get('/messages-by-phone/:phone_e164', async (c) => {
    try {
      const phone_e164 = c.req.param('phone_e164');
      
      // 🚀 PARÂMETROS DE OTIMIZAÇÃO
      const limit = parseInt(c.req.query('limit') || '100'); // Limite padrão: 100 mensagens
      const since = c.req.query('since'); // Timestamp para busca incremental
      
      if (!phone_e164) {
        return c.json({ error: 'phone_e164 inválido' }, 400);
      }
      
      console.log(`🔍 Buscando mensagens para: ${phone_e164} (limit: ${limit}, since: ${since || 'ALL'})`);
      
      const supabase = getSupabaseClient();
      
      // Extrair apenas os dígitos do telefone (sem + e sem 55)
      const digitsOnly = phone_e164.replace(/\D/g, '');
      
      // Remover código do país se existir
      let phoneWithoutCountry = digitsOnly;
      if (digitsOnly.startsWith('55')) {
        phoneWithoutCountry = digitsOnly.substring(2);
      }
      
      console.log(`   📱 Dígitos completos: ${digitsOnly}`);
      console.log(`   📱 Sem código país: ${phoneWithoutCountry}`);
      
      // GERAR VARIAÇÕES COM E SEM O "9" (para números antigos/novos)
      const phoneVariations: string[] = [
        digitsOnly,           // Ex: 5561995041534
        phoneWithoutCountry,  // Ex: 61995041534
        '+' + digitsOnly,     // Ex: +5561995041534
        '+55' + phoneWithoutCountry // Ex: +5561995041534
      ];
      
      // Se tem 11 dígitos (61 + 9 + 8 dígitos), criar versão SEM o 9
      if (phoneWithoutCountry.length === 11 && phoneWithoutCountry.charAt(2) === '9') {
        const withoutNine = phoneWithoutCountry.substring(0, 2) + phoneWithoutCountry.substring(3);
        phoneVariations.push(withoutNine); // Ex: 6195041534
        phoneVariations.push('55' + withoutNine); // Ex: 556195041534
        console.log(`   📱 Variação SEM o 9: ${withoutNine}`);
      }
      
      // Se tem 10 dígitos (61 + 8 dígitos), criar versão COM o 9
      if (phoneWithoutCountry.length === 10) {
        const withNine = phoneWithoutCountry.substring(0, 2) + '9' + phoneWithoutCountry.substring(2);
        phoneVariations.push(withNine);
        console.log(`   📱 Variação COM o 9: ${withNine}`);
      }
      
      console.log(`   📱 Total de variações a buscar: ${phoneVariations.length}`);
      
      // BUSCAR usando TODAS as variações do telefone
      // Construir condições OR corretamente para Supabase
      const orConditions = phoneVariations.flatMap(variant => [
        `from_phone.ilike.%${variant}%`,
        `to_phone.ilike.%${variant}%`
      ]).join(',');
      
      console.log(`   🔍 Condições OR: ${orConditions}`);
      
      // Construir query otimizada
      let query = supabase
        .from('whats_messages')
        .select('*')
        .or(orConditions);
      
      // 🚀 BUSCA INCREMENTAL: Se passar 'since', buscar apenas mensagens NOVAS
      if (since) {
        query = query.gt('created_at', since);
        console.log(`   ⚡ Busca incremental: mensagens após ${since}`);
      }
      
      // Ordenar e limitar
      query = query
        .order('created_at', { ascending: true })
        .limit(limit);
      
      const { data: messages, error } = await query;
      
      if (error) {
        console.error('❌ Erro ao buscar mensagens do banco:', error);
        console.error('   Detalhes:', JSON.stringify(error, null, 2));
        console.error('   Query params:', { phone_e164, limit, since });
        return c.json({ 
          success: false,
          error: 'Erro ao buscar mensagens do banco de dados',
          details: error.message,
          data: []
        }, 500);
      }
      
      console.log(`✅ ${messages?.length || 0} mensagens encontradas`);
      
      return c.json({
        success: true,
        data: messages || [],
        total: messages?.length || 0,
        hasMore: messages?.length === limit, // Indica se há mais mensagens disponíveis
      });
      
    } catch (error) {
      console.error('❌ Erro:', error);
      return c.json({ 
        success: false,
        error: error.message,
        data: []
      }, 500);
    }
  });
  
  // ============================================================
  // 🔄 MIGRAR DADOS DO KV STORE (UTILITÁRIO)
  // ============================================================
  app.post('/migrate-from-kv', async (c) => {
    try {
      console.log('🔄 Iniciando migração do KV Store...');
      
      // Importar KV Store
      const kv = await import('./kv_store.tsx');
      
      // Buscar todas as mensagens do KV
      const kvMessages = await kv.getByPrefix('chat:');
      
      console.log(`📊 ${kvMessages.length} mensagens encontradas no KV Store`);
      
      let migratedCount = 0;
      let errorCount = 0;
      
      for (const msg of kvMessages) {
        try {
          // Garantir contato
          const contact = await ensureContact(msg.phone_number);
          
          // Garantir conversa (se tiver assistência)
          let conversation;
          if (msg.assistencia_id && msg.assistencia_id > 0) {
            conversation = await ensureConversation(contact.id, msg.assistencia_id);
          } else {
            // Criar conversa genérica
            const supabase = getSupabaseClient();
            const { data } = await supabase
              .from('whats_conversations')
              .insert({
                contact_id: contact.id,
                id_assistencia: null,
                channel: 'zapi_main',
                status: 'open',
                last_message_at: msg.timestamp,
              })
              .select()
              .single();
            conversation = data;
          }
          
          // Inserir mensagem
          const supabase = getSupabaseClient();
          await supabase
            .from('whats_messages')
            .insert({
              conversation_id: conversation.id,
              direction: msg.sender === 'cliente' ? 'in' : 'out',
              from_phone: msg.sender === 'cliente' ? msg.phone_number : null,
              to_phone: msg.sender === 'cliente' ? null : msg.phone_number,
              type: msg.media_type || 'text',
              body: msg.message,
              media_url: msg.media_url,
              sent_at: msg.sender !== 'cliente' ? msg.timestamp : null,
              received_at: msg.sender === 'cliente' ? msg.timestamp : null,
              source: 'kv_migration',
              provider_message_id: msg.z_api_message_id,
              raw_payload: msg,
            });
          
          migratedCount++;
          
        } catch (error) {
          console.error(`❌ Erro ao migrar mensagem ${msg.id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`✅ Migração concluída: ${migratedCount} migradas, ${errorCount} erros`);
      
      return c.json({
        success: true,
        migrated: migratedCount,
        errors: errorCount,
        total: kvMessages.length,
      });
      
    } catch (error) {
      console.error('❌ Erro na migração:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  // ============================================================
  // 🔍 DEBUG: Listar TODOS os contatos e mensagens (para debug)
  // ============================================================
  app.get('/debug/all-data', async (c) => {
    try {
      console.log('🔍 ===== DEBUG: LISTANDO TODOS OS DADOS =====');
      
      const supabase = getSupabaseClient();
      
      // Buscar TODOS os contatos
      const { data: contacts, error: contactsError } = await supabase
        .from('whats_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (contactsError) {
        console.error('❌ Erro ao buscar contatos:', contactsError);
        throw contactsError;
      }
      
      console.log(`📞 Total de contatos: ${contacts?.length || 0}`);
      
      // Buscar TODAS as mensagens
      const { data: messages, error: messagesError } = await supabase
        .from('whats_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Aumentar para 100
      
      if (messagesError) {
        console.error('❌ Erro ao buscar mensagens:', messagesError);
        throw messagesError;
      }
      
      console.log(`💬 Total de mensagens: ${messages?.length || 0}`);
      
      // Log detalhado
      console.log('📋 Contatos encontrados:');
      contacts?.forEach((contact, index) => {
        console.log(`   [${index}] Phone: ${contact.phone_e164}, Name: ${contact.display_name || 'N/A'}, ID: ${contact.id}`);
      });
      
      console.log('📋 Mensagens encontradas (últimas 100):');
      messages?.forEach((msg, index) => {
        console.log(`   [${index}] From: ${msg.from_phone || 'N/A'}, To: ${msg.to_phone || 'N/A'}, Direction: ${msg.direction}, Body: ${msg.body?.substring(0, 30)}...`);
      });
      
      // Extrair todos os telefones únicos das mensagens
      const allPhones = new Set<string>();
      messages?.forEach(msg => {
        if (msg.from_phone) allPhones.add(msg.from_phone);
        if (msg.to_phone) allPhones.add(msg.to_phone);
      });
      
      return c.json({
        success: true,
        data: {
          contacts: contacts || [],
          messages: messages || [],
          summary: {
            total_contacts: contacts?.length || 0,
            total_messages: messages?.length || 0,
            contact_phones: contacts?.map(c => c.phone_e164) || [],
            message_phones: Array.from(allPhones),
          }
        }
      });
    } catch (error) {
      console.error('❌ Erro no debug:', error);
      return c.json({
        success: false,
        error: 'Erro ao buscar dados de debug',
        details: error.message
      }, 500);
    }
  });

  // ============================================================
  // 💬 LISTAR TODAS AS CONVERSAS (Para interface de chat)
  // ============================================================
  app.get('/conversations', async (c) => {
    try {
      console.log('💬 Listando todas as conversas...');
      
      const supabase = getSupabaseClient();
      const status = c.req.query('status') || 'open'; // Filtro por status (open, closed, all)
      const limit = parseInt(c.req.query('limit') || '1000'); // Aumentado de 100 para 1000
      
      // Buscar conversas com joins
      let query = supabase
        .from('whats_conversations')
        .select(`
          id,
          contact_id,
          id_assistencia,
          channel,
          status,
          last_message_at,
          created_at,
          whats_contacts!contact_id (
            phone_e164,
            display_name
          )
        `)
        .order('last_message_at', { ascending: false })
        .limit(limit);
      
      if (status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data: conversations, error: convError } = await query;
      
      if (convError) {
        console.error('❌ Erro ao buscar conversas:', convError);
        return c.json({ error: 'Erro ao carregar conversas', details: convError.message }, 500);
      }
      
      // Para cada conversa, buscar a última mensagem e contar não lidas
      const conversationsWithDetails = await Promise.all(
        (conversations || []).map(async (conv: any) => {
          // Buscar última mensagem
          const { data: lastMessage } = await supabase
            .from('whats_messages')
            .select('body, type, direction, created_at, sent_at, received_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // Contar mensagens não lidas (mensagens recebidas sem read_at)
          const { count: unreadCount } = await supabase
            .from('whats_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('direction', 'in')
            .is('read_at', null);
          
          // Buscar dados da assistência se existir
          let assistenciaData = null;
          // 🔧 NORMALIZADO: JOIN com clientes via id_cliente (dados do cliente agora vivem na tabela clientes)
          if (conv.id_assistencia) {
            const { data: assistenciaRaw } = await supabase
              .from('Assistência Técnica')
              .select('id, categoria_reparo, status_chamado, clientes!id_cliente(proprietario, empreendimento)')
              .eq('id', conv.id_assistencia)
              .maybeSingle();
            if (assistenciaRaw) {
              const { clientes, ...rest } = assistenciaRaw as any;
              assistenciaData = { ...rest, ...(clientes || {}) };
            }
          }
          
          return {
            ...conv,
            contact: conv.whats_contacts,
            last_message: lastMessage,
            unread_count: unreadCount || 0,
            assistencia: assistenciaData,
          };
        })
      );
      
      console.log(`✅ ${conversationsWithDetails.length} conversas retornadas`);
      
      return c.json({
        success: true,
        data: conversationsWithDetails,
        total: conversationsWithDetails.length,
      });
      
    } catch (error) {
      console.error('❌ Erro ao listar conversas:', error);
      return c.json({ error: 'Erro ao listar conversas', details: error.message }, 500);
    }
  });
  
  // ============================================================
  // 💬 BUSCAR MENSAGENS DE UMA CONVERSA ESPECÍFICA
  // ============================================================
  app.get('/conversations/:id/messages', async (c) => {
    try {
      const conversationId = parseInt(c.req.param('id'));
      const limit = parseInt(c.req.query('limit') || '100');
      const offset = parseInt(c.req.query('offset') || '0');
      
      console.log(`💬 Buscando mensagens da conversa ${conversationId}...`);
      
      const supabase = getSupabaseClient();
      
      const { data: messages, error } = await supabase
        .from('whats_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('❌ Erro ao buscar mensagens:', error);
        return c.json({ error: 'Erro ao carregar mensagens', details: error.message }, 500);
      }
      
      console.log(`✅ ${messages?.length || 0} mensagens retornadas`);
      
      return c.json({
        success: true,
        data: messages || [],
        total: messages?.length || 0,
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return c.json({ error: 'Erro ao buscar mensagens', details: error.message }, 500);
    }
  });
  
  // ============================================================
  // 📤 ENVIAR MENSAGEM EM UMA CONVERSA
  // ============================================================
  app.post('/conversations/:id/send', async (c) => {
    try {
      const conversationId = parseInt(c.req.param('id'));
      const body = await c.req.json();
      const { message, type = 'text', media_url } = body;
      
      console.log(`📤 Enviando mensagem na conversa ${conversationId}...`);
      
      if (!message) {
        return c.json({ error: 'Campo obrigatório: message' }, 400);
      }
      
      const supabase = getSupabaseClient();
      
      // Buscar dados da conversa
      const { data: conversation, error: convError } = await supabase
        .from('whats_conversations')
        .select(`
          id,
          contact_id,
          whats_contacts!contact_id (phone_e164)
        `)
        .eq('id', conversationId)
        .single();
      
      if (convError || !conversation) {
        return c.json({ error: 'Conversa não encontrada' }, 404);
      }
      
      const phone_e164 = conversation.whats_contacts.phone_e164;
      
      // Enviar via Z-API
      const zapiClient = await getZApiClient();
      const sendResult = await zapiClient.sendMessage({
        phone: phone_e164,
        message: message,
      });
      
      if (!sendResult.success) {
        throw new Error(`Erro ao enviar via Z-API: ${sendResult.error}`);
      }
      
      // Registrar mensagem
      const { data: messageRecord, error: msgError } = await supabase
        .from('whats_messages')
        .insert({
          conversation_id: conversationId,
          direction: 'out',
          from_phone: null,
          to_phone: phone_e164,
          type: type,
          body: message,
          media_url: media_url,
          sent_at: new Date().toISOString(),
          source: 'web_interface',
          provider_message_id: sendResult.messageId || null,
          raw_payload: sendResult,
        })
        .select()
        .single();
      
      if (msgError) {
        console.error('❌ Erro ao registrar mensagem:', msgError);
        throw new Error(`Erro ao registrar mensagem: ${msgError.message}`);
      }
      
      // Atualizar timestamp da conversa
      await updateConversationTimestamp(conversationId);
      
      console.log(`✅ Mensagem enviada e registrada: ID ${messageRecord.id}`);
      
      return c.json({
        success: true,
        message_id: messageRecord.id,
        provider_message_id: sendResult.messageId,
      });
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return c.json({ error: 'Erro ao enviar mensagem', details: error.message }, 500);
    }
  });
  
  // ============================================================
  // ✅ MARCAR MENSAGENS COMO LIDAS
  // ============================================================
  app.post('/conversations/:id/mark-read', async (c) => {
    try {
      const conversationId = parseInt(c.req.param('id'));
      
      console.log(`✅ Marcando mensagens da conversa ${conversationId} como lidas...`);
      
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('whats_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('direction', 'in')
        .is('read_at', null);
      
      if (error) {
        console.error('❌ Erro ao marcar como lido:', error);
        return c.json({ error: 'Erro ao marcar como lido', details: error.message }, 500);
      }
      
      console.log(`✅ Mensagens marcadas como lidas`);
      
      return c.json({ success: true });
      
    } catch (error) {
      console.error('❌ Erro ao marcar como lido:', error);
      return c.json({ error: 'Erro ao marcar como lido', details: error.message }, 500);
    }
  });

  // 🚨 Endpoint para verificar status de alertas críticos
  app.get('/status-alert', async (c) => {
    try {
      const kv = await import('./kv_store.tsx');
      const alert = await kv.get('whatsapp_critical_alert');
      
      if (alert) {
        // Verificar se o alerta é recente (últimas 24 horas)
        const alertTime = new Date(alert.timestamp).getTime();
        const now = Date.now();
        const hoursSinceAlert = (now - alertTime) / (1000 * 60 * 60);
        
        if (hoursSinceAlert < 24) {
          return c.json({ alert });
        } else {
          // Alerta muito antigo, limpar automaticamente
          await kv.del('whatsapp_critical_alert');
          return c.json({ alert: null });
        }
      }
      
      return c.json({ alert: null });
    } catch (error) {
      console.error('❌ Erro ao buscar alerta:', error);
      return c.json({ error: 'Erro ao buscar alerta', details: error.message }, 500);
    }
  });

  // 🧹 Endpoint para limpar alertas (quando problema for resolvido)
  app.post('/clear-alert', async (c) => {
    try {
      const kv = await import('./kv_store.tsx');
      await kv.del('whatsapp_critical_alert');
      console.log('✅ Alerta crítico limpo com sucesso');
      return c.json({ success: true, message: 'Alerta limpo' });
    } catch (error) {
      console.error('❌ Erro ao limpar alerta:', error);
      return c.json({ error: 'Erro ao limpar alerta', details: error.message }, 500);
    }
  });

  return app;
}

// Export para uso no index.tsx
export const whatsappRoutes = createWhatsAppRoutes();