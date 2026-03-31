// ═══════════════════════════════════════════════════════════════════
// EDGE FUNCTION: Clicksign Integration
// Rotas:
//   POST /clicksign/send-envelope  → Cria envelope + upload PDF + signer + ativa
//   POST /clicksign/webhook        → Recebe eventos do Clicksign
//   POST /clicksign/resend         → Reenvia notificação de assinatura
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLICKSIGN_TOKEN = Deno.env.get("CLICKSIGN_TOKEN")!;
// Trocar para https://app.clicksign.com/api/v3 em produção
const CLICKSIGN_BASE = Deno.env.get("CLICKSIGN_BASE_URL") || "https://sandbox.clicksign.com/api/v3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Z-API WhatsApp
const ZAPI_BASE_URL = Deno.env.get("ZAPI_URL") || "https://api.z-api.io";
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID")!;
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN")!;
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN")!;

// [META API - COMENTADO PARA USO FUTURO]
// const WHATSAPP_META_TOKEN = Deno.env.get("WHATSAPP_META_TOKEN")!;
// const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "943238462209611";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ── Helpers ────────────────────────────────────────────────────────

async function clicksignRequest(path: string, method: string, body?: unknown) {
  const res = await fetch(`${CLICKSIGN_BASE}${path}`, {
    method,
    headers: {
      Authorization: CLICKSIGN_TOKEN,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Clicksign error:", JSON.stringify(data));
    throw new Error(`Clicksign ${method} ${path} failed: ${res.status} - ${JSON.stringify(data)}`);
  }
  return data;
}

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── Helper: Enviar link de assinatura via Z-API ──────────────────

async function enviarWhatsAppAssinatura(
  telefone: string,
  nomeCliente: string,
  signingUrl: string,
): Promise<void> {
  // Formatar telefone para E.164 (55 + DDD + número)
  let digits = telefone.replace(/\D/g, "");
  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }

  // Normalizar base URL (extrair apenas domínio, mesmo padrão do ZApiClient)
  const baseUrl = ZAPI_BASE_URL.trim().replace(/\/$/, "").match(/^(https?:\/\/[^/]+)/)?.[1] || ZAPI_BASE_URL;
  const url = `${baseUrl}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-image`;

  const body = {
    phone: digits,
    image: "",
    message: `*Novo documento!*\nOlá ${nomeCliente}! Ficamos felizes em dizer que seu reparo foi concluído.✅\n\nPara finalizar o processo, precisamos que assine o termo abaixo. 😄\n\n*Leia nosso termo de Assistência:* ➡️\nAté logo! BP Incorporadora`,
    buttonActions: [
      {
        id: "1",
        type: "URL",
        url: signingUrl,
        label: "Assinar Termo!",
      },
    ],
  };

  console.log(`📱 Enviando WhatsApp via Z-API para ${digits}...`);
  console.log(`   URL completa: ${signingUrl}`);
  console.log(`   Endpoint: ${url}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Client-Token": ZAPI_CLIENT_TOKEN,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("❌ Erro Z-API:", JSON.stringify(data));
    throw new Error(`Z-API error: ${res.status} - ${JSON.stringify(data)}`);
  }

  console.log(`✅ WhatsApp enviado com sucesso via Z-API:`, JSON.stringify(data));
}

// ── [META API - COMENTADO PARA USO FUTURO] ──────────────────────
//
// async function enviarWhatsAppAssinatura(
//   telefone: string,
//   nomeCliente: string,
//   urlPath: string,
// ): Promise<void> {
//   let digits = telefone.replace(/\D/g, "");
//   if (!digits.startsWith("55")) {
//     digits = `55${digits}`;
//   }
//
//   const url = `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
//
//   const body = {
//     messaging_product: "whatsapp",
//     to: digits,
//     type: "template",
//     template: {
//       name: "assinar_template",
//       language: { code: "pt_BR" },
//       components: [
//         {
//           type: "body",
//           parameters: [
//             {
//               type: "text",
//               parameter_name: "nome_cliente",
//               text: nomeCliente,
//             },
//           ],
//         },
//         {
//           type: "button",
//           sub_type: "url",
//           index: 0,
//           parameters: [
//             {
//               type: "text",
//               text: urlPath,
//             },
//           ],
//         },
//       ],
//     },
//   };
//
//   console.log(`📱 Enviando WhatsApp template para ${digits}...`);
//   console.log(`   URL path: ${urlPath}`);
//
//   const res = await fetch(url, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${WHATSAPP_META_TOKEN}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(body),
//   });
//
//   const data = await res.json();
//   if (!res.ok) {
//     console.error("❌ Erro Meta WhatsApp API:", JSON.stringify(data));
//     throw new Error(`Meta WhatsApp API error: ${res.status} - ${JSON.stringify(data)}`);
//   }
//
//   console.log(`✅ WhatsApp enviado com sucesso:`, JSON.stringify(data));
// }

// ── Rota: Criar e enviar envelope ──────────────────────────────────

async function handleSendEnvelope(req: Request): Promise<Response> {
  const {
    pdf_base64,
    filename,
    signer_name,
    signer_email,
    signer_phone,
    signer_cpf,
    id_assistencia,
    id_finalizacao,
    deadline_days = 7,
  } = await req.json();

  // Validação
  if (!pdf_base64 || !signer_name || !signer_email || !signer_cpf || !id_assistencia) {
    return new Response(
      JSON.stringify({ error: "Campos obrigatórios: pdf_base64, signer_name, signer_email, signer_cpf, id_assistencia" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1️⃣ Criar Envelope
    const deadlineAt = new Date();
    deadlineAt.setDate(deadlineAt.getDate() + deadline_days);

    const envelopeRes = await clicksignRequest("/envelopes", "POST", {
      data: {
        type: "envelopes",
        attributes: {
          name: `Termo Assistência #${id_assistencia}`,
          locale: "pt-BR",
          auto_close: true,
          remind_interval: 2,
          block_after_refusal: true,
          deadline_at: deadlineAt.toISOString(),
        },
      },
    });

    const envelopeId = envelopeRes.data.id;
    console.log(`✅ Envelope criado: ${envelopeId}`);

    // 2️⃣ Upload do Documento PDF
    const docRes = await clicksignRequest(`/envelopes/${envelopeId}/documents`, "POST", {
      data: {
        type: "documents",
        attributes: {
          filename: filename || `termo-assistencia-${id_assistencia}.pdf`,
          content_base64: `data:application/pdf;base64,${pdf_base64}`,
        },
      },
    });

    const documentId = docRes.data.id;
    console.log(`✅ Documento uploaded: ${documentId}`);

    // 3️⃣ Adicionar Signatário
    const signerAttrs: Record<string, string> = {
      name: signer_name,
      email: signer_email,
    };

    // Telefone: formato DDD + número (sem DDI 55)
    let hasPhone = false;
    if (signer_phone) {
      let digits = signer_phone.replace(/\D/g, "");
      // Remover DDI 55 se presente
      if (digits.startsWith("55") && digits.length > 11) {
        digits = digits.slice(2);
      }
      // DDD(2) + número(8-9) = 10 ou 11 dígitos
      if (digits.length === 10 || digits.length === 11) {
        signerAttrs.phone_number = digits;
        hasPhone = true;
      }
      console.log(`📱 Telefone: "${signer_phone}" → phone_number: "${signerAttrs.phone_number || "NÃO ENVIADO"}"`)
    }

    // CPF: formato XXX.XXX.XXX-XX
    if (signer_cpf) {
      const cpfDigits = signer_cpf.replace(/\D/g, "");
      if (cpfDigits.length === 11) {
        signerAttrs.documentation = `${cpfDigits.slice(0,3)}.${cpfDigits.slice(3,6)}.${cpfDigits.slice(6,9)}-${cpfDigits.slice(9)}`;
      }
    }

    const signerRes = await clicksignRequest(`/envelopes/${envelopeId}/signers`, "POST", {
      data: {
        type: "signers",
        attributes: signerAttrs,
      },
    });

    const signerId = signerRes.data.id;
    console.log(`✅ Signatário adicionado: ${signerId}`);

    // 4️⃣ Criar Requisitos (assinatura + autenticação via WhatsApp)
    // Requisito de assinatura
    await clicksignRequest(`/envelopes/${envelopeId}/requirements`, "POST", {
      data: {
        type: "requirements",
        attributes: {
          action: "agree",
          role: "sign",
        },
        relationships: {
          document: { data: { type: "documents", id: documentId } },
          signer: { data: { type: "signers", id: signerId } },
        },
      },
    });
    console.log(`✅ Requisito de assinatura criado`);

    // Requisito de autenticação: WhatsApp se tem telefone, senão email
    const authMethod = hasPhone ? "whatsapp" : "email";
    await clicksignRequest(`/envelopes/${envelopeId}/requirements`, "POST", {
      data: {
        type: "requirements",
        attributes: {
          action: "provide_evidence",
          auth: authMethod,
        },
        relationships: {
          document: { data: { type: "documents", id: documentId } },
          signer: { data: { type: "signers", id: signerId } },
        },
      },
    });
    console.log(`✅ Requisito de autenticação ${authMethod} criado`);

    // 5️⃣ Ativar Envelope (muda status para "running")
    await clicksignRequest(`/envelopes/${envelopeId}`, "PATCH", {
      data: {
        type: "envelopes",
        id: envelopeId,
        attributes: {
          status: "running",
        },
      },
    });
    console.log(`✅ Envelope ativado`);

    // 6️⃣ Construir URL pública de assinatura
    // Formato Clicksign v3: https://{domain}/widget/notarial/{signer_id}/documents/{document_id}
    const clicksignDomain = CLICKSIGN_BASE.includes("sandbox")
      ? "https://sandbox.clicksign.com"
      : "https://app.clicksign.com";
    const signingUrl = `${clicksignDomain}/widget/notarial/${signerId}/documents/${documentId}`;
    console.log(`🔗 URL de assinatura: ${signingUrl}`);

    // 7️⃣ Enviar link de assinatura via WhatsApp (Z-API)
    let whatsappSent = false;

    if (signingUrl && hasPhone) {
      try {
        await enviarWhatsAppAssinatura(signer_phone, signer_name, signingUrl);
        whatsappSent = true;
      } catch (whatsErr) {
        console.error("⚠️ Erro ao enviar WhatsApp, continuando sem envio:", whatsErr);
      }
    } else if (!signingUrl) {
      console.warn("⚠️ URL de assinatura não retornada pela Clicksign");
    } else if (!hasPhone) {
      console.warn("⚠️ Telefone não disponível, WhatsApp não enviado");
    }

    // 8️⃣ Salvar referências no banco
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Salvar na tabela clicksign_envelopes
    if (id_finalizacao) {
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + deadline_days);

      await supabase.from("clicksign_envelopes").insert({
        assistencia_finalizada_id: id_finalizacao,
        envelope_id: envelopeId,
        envelope_status: "running",
        document_id: documentId,
        signer_id: signerId,
        signer_name,
        signer_email,
        signer_cpf,
        signer_phone: signer_phone || null,
        signing_url: signingUrl,
        sent_at: now,
        deadline_at: deadlineDate.toISOString(),
      });
      console.log(`✅ Registro salvo em clicksign_envelopes`);

      // Atualizar status da assistencia_finalizada
      await supabase
        .from("assistencia_finalizada")
        .update({ status: "Aguardando assinatura" })
        .eq("id", id_finalizacao);
      console.log(`✅ Status atualizado na finalização #${id_finalizacao}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          envelope_id: envelopeId,
          document_id: documentId,
          signer_id: signerId,
          signing_url: signingUrl,
          whatsapp_sent: whatsappSent,
          status: "running",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro ao enviar envelope Clicksign:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ── Rota: Webhook do Clicksign ─────────────────────────────────────

async function handleWebhook(req: Request): Promise<Response> {
  const body = await req.text();

  // Verificar HMAC (se configurado)
  const hmacHeader = req.headers.get("Content-Hmac");
  const webhookSecret = Deno.env.get("CLICKSIGN_WEBHOOK_SECRET");
  if (webhookSecret && hmacHeader) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hexHash = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
    if (hmacHeader !== `sha256=${hexHash}`) {
      console.error("❌ HMAC inválido no webhook Clicksign");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const event = JSON.parse(body);
  console.log(`📩 Webhook Clicksign recebido: ${JSON.stringify(event)}`);

  // Salvar payload bruto para debug
  const debugSupabase = getSupabaseClient();
  await debugSupabase.from("kv_store_a8708d5d").upsert({
    key: `clicksign_webhook_${Date.now()}`,
    value: { raw_body: body, parsed: event, received_at: new Date().toISOString() },
  });

  // Extrair evento e identificadores do payload Clicksign
  const eventType = event?.event?.name;
  const documentKey = event?.document?.key; // document_id no nosso banco

  console.log(`📋 Event: ${eventType}, Document Key: ${documentKey}`);

  if (!documentKey || !eventType) {
    console.log(`ℹ️ Payload sem document.key ou event.name, ignorando`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient();

  // Buscar o envelope pelo document_id (document.key do webhook)
  const { data: envelope } = await supabase
    .from("clicksign_envelopes")
    .select("id, assistencia_finalizada_id, envelope_id, document_id")
    .eq("document_id", documentKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!envelope) {
    console.warn(`⚠️ Nenhum envelope encontrado para document_id ${documentKey}`);
    return new Response(JSON.stringify({ received: true, warning: "no matching document" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const envelopeId = envelope.envelope_id;
  console.log(`✅ Envelope encontrado: ${envelopeId}, finalização: ${envelope.assistencia_finalizada_id}`);

  // Buscar a finalização associada
  const { data: finalizacao } = await supabase
    .from("assistencia_finalizada")
    .select("id, id_assistencia, status")
    .eq("id", envelope.assistencia_finalizada_id)
    .single();

  if (!finalizacao) {
    console.warn(`⚠️ Nenhuma finalização encontrada para envelope ${envelopeId}`);
    return new Response(JSON.stringify({ received: true, warning: "no matching record" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();

  // Processar eventos
  switch (eventType) {
    case "sign": {
      // Assinatura completada
      console.log(`✅ Documento assinado! Finalizando assistência #${finalizacao.id_assistencia}`);

      // Atualizar assistencia_finalizada
      await supabase
        .from("assistencia_finalizada")
        .update({ status: "Finalizado" })
        .eq("id", finalizacao.id);

      // Atualizar clicksign_envelopes
      await supabase
        .from("clicksign_envelopes")
        .update({ envelope_status: "closed", webhook_event: "sign", signed_at: now })
        .eq("envelope_id", envelopeId);

      // Atualizar status da assistência original para "Finalizado"
      await supabase
        .from("Assistência Técnica")
        .update({
          status_chamado: "Finalizado",
          situacao: "Finalizado",
        })
        .eq("id", finalizacao.id_assistencia);

      console.log(`✅ Assistência #${finalizacao.id_assistencia} finalizada com sucesso`);
      break;
    }

    case "close":
    case "auto_close": {
      // Envelope fechado (todos assinaram)
      await supabase
        .from("clicksign_envelopes")
        .update({ envelope_status: "closed", webhook_event: eventType })
        .eq("envelope_id", envelopeId);
      break;
    }

    case "refusal": {
      // Signatário recusou
      console.warn(`⚠️ Signatário recusou o documento - Assistência #${finalizacao.id_assistencia}`);

      await supabase
        .from("clicksign_envelopes")
        .update({ envelope_status: "canceled", webhook_event: "refusal", canceled_at: now })
        .eq("envelope_id", envelopeId);
      break;
    }

    case "deadline": {
      // Prazo expirou sem assinatura → aceitação tácita
      console.log(`⏰ Prazo expirado - Assistência #${finalizacao.id_assistencia} → aceitação tácita`);

      await supabase
        .from("assistencia_finalizada")
        .update({ status: "Finalizado" })
        .eq("id", finalizacao.id);

      await supabase
        .from("clicksign_envelopes")
        .update({ envelope_status: "expired", webhook_event: "deadline" })
        .eq("envelope_id", envelopeId);

      await supabase
        .from("Assistência Técnica")
        .update({
          status_chamado: "Finalizado",
          situacao: "Finalizado",
        })
        .eq("id", finalizacao.id_assistencia);
      break;
    }

    case "document_closed": {
      // Documento assinado e fechado (pronto para download)
      console.log(`✅ Documento fechado (assinado)! Finalizando assistência #${finalizacao.id_assistencia}`);

      // Atualizar assistencia_finalizada
      await supabase
        .from("assistencia_finalizada")
        .update({ status: "Finalizado" })
        .eq("id", finalizacao.id);

      // Atualizar clicksign_envelopes
      await supabase
        .from("clicksign_envelopes")
        .update({ envelope_status: "closed", webhook_event: "document_closed", signed_at: now })
        .eq("envelope_id", envelopeId);

      // Atualizar status da assistência original para "Finalizado"
      await supabase
        .from("Assistência Técnica")
        .update({
          status_chamado: "Finalizado",
          situacao: "Finalizado",
        })
        .eq("id", finalizacao.id_assistencia);

      console.log(`✅ Assistência #${finalizacao.id_assistencia} finalizada via document_closed`);

      // Criar avaliação NPS e enviar link via WhatsApp
      try {
        const { data: avaliacaoData } = await supabase
          .from("avaliacoes_nps")
          .insert({
            assistencia_finalizada_id: finalizacao.id,
            id_assistencia: finalizacao.id_assistencia,
          })
          .select("token")
          .single();

        if (avaliacaoData?.token) {
          console.log(`📋 Token de avaliação criado: ${avaliacaoData.token}`);

          // Buscar dados do cliente para enviar WhatsApp
          const { data: signerData } = await supabase
            .from("clicksign_envelopes")
            .select("signer_phone, signer_name")
            .eq("envelope_id", envelopeId)
            .single();

          if (signerData?.signer_phone) {
            const avaliacaoUrl = `https://connect.eonbr.com/avaliacao/${avaliacaoData.token}`;
            const nomeCliente = signerData.signer_name || "Cliente";

            // Enviar link de avaliação via Z-API
            const baseUrl = ZAPI_BASE_URL.trim().replace(/\/$/, "").match(/^(https?:\/\/[^/]+)/)?.[1] || ZAPI_BASE_URL;
            const zapiUrl = `${baseUrl}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-image`;

            let digits = signerData.signer_phone.replace(/\D/g, "");
            if (!digits.startsWith("55")) digits = `55${digits}`;

            const zapiBody = {
              phone: digits,
              image: "",
              message: `*Obrigado por assinar!* ✅\nOlá ${nomeCliente}! Agradecemos por assinar o termo de assistência.\n\nAgora, gostaríamos de saber sua opinião sobre o reparo realizado. Sua avaliação nos ajuda a melhorar! 😊\n\n*Avalie nosso serviço:* ➡️\nAté logo! BP Incorporadora`,
              buttonActions: [
                {
                  id: "1",
                  type: "URL",
                  url: avaliacaoUrl,
                  label: "Avaliar Servico",
                },
              ],
            };

            const zapiResp = await fetch(zapiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Client-Token": ZAPI_CLIENT_TOKEN,
              },
              body: JSON.stringify(zapiBody),
            });

            const zapiData = await zapiResp.json();
            console.log(`📱 WhatsApp avaliação enviado:`, zapiResp.ok ? "sucesso" : zapiData);
          }
        }
      } catch (npsErr) {
        console.error("⚠️ Erro ao criar avaliação NPS (não crítico):", npsErr);
      }

      break;
    }

    default:
      console.log(`ℹ️ Evento não tratado: ${eventType}`);
  }

  return new Response(JSON.stringify({ received: true, event: eventType }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Rota: Reenviar notificação ─────────────────────────────────────

async function handleResend(req: Request): Promise<Response> {
  const { id_finalizacao } = await req.json();

  if (!id_finalizacao) {
    return new Response(
      JSON.stringify({ error: "id_finalizacao obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = getSupabaseClient();

  // Buscar dados do envelope na tabela clicksign_envelopes
  const { data: envelope } = await supabase
    .from("clicksign_envelopes")
    .select("envelope_id, signer_id, signer_name, signer_phone, signing_url")
    .eq("assistencia_finalizada_id", id_finalizacao)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!envelope?.envelope_id) {
    return new Response(
      JSON.stringify({ error: "Nenhum envelope Clicksign encontrado para esta finalização" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Buscar URL atualizada do signer (pode ter mudado)
    let signingUrl = envelope.signing_url;
    if (!signingUrl) {
      const signerDetails = await clicksignRequest(
        `/envelopes/${envelope.envelope_id}/signers/${envelope.signer_id}`,
        "GET"
      );
      signingUrl = signerDetails?.data?.attributes?.url || null;
    }

    if (!signingUrl || !envelope.signer_phone) {
      return new Response(
        JSON.stringify({ error: "URL de assinatura ou telefone não disponível" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reenviar via WhatsApp (Z-API) com URL completa
    await enviarWhatsAppAssinatura(envelope.signer_phone, envelope.signer_name, signingUrl);

    return new Response(
      JSON.stringify({ success: true, message: "Link de assinatura reenviado via WhatsApp" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ── Rota: Buscar signing URL ──────────────────────────────────────

async function handleSigningUrl(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const idFinalizacao = url.searchParams.get("id_finalizacao");

  if (!idFinalizacao) {
    return new Response(
      JSON.stringify({ error: "id_finalizacao obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = getSupabaseClient();

  const { data: envelope } = await supabase
    .from("clicksign_envelopes")
    .select("signing_url")
    .eq("assistencia_finalizada_id", parseInt(idFinalizacao))
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return new Response(
    JSON.stringify({ signing_url: envelope?.signing_url || null }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Rota: Buscar dados da avaliação (GET) ─────────────────────────

async function handleGetAvaliacao(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = getSupabaseClient();

  // Buscar avaliação pelo token
  const { data: avaliacao, error } = await supabase
    .from("avaliacoes_nps")
    .select("id, token, assistencia_finalizada_id, id_assistencia, status, nota")
    .eq("token", token)
    .single();

  if (error || !avaliacao) {
    return new Response(
      JSON.stringify({ error: "Avaliação não encontrada ou link inválido." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Buscar dados da assistência
  const { data: assistencia } = await supabase
    .from("Assistência Técnica")
    .select("id, categoria_reparo, descricao_cliente, created_at, id_cliente")
    .eq("id", avaliacao.id_assistencia)
    .single();

  // Buscar dados da finalização
  const { data: finalizacao } = await supabase
    .from("assistencia_finalizada")
    .select("id, responsaveis, providencias, created_at")
    .eq("id", avaliacao.assistencia_finalizada_id)
    .single();

  // Buscar nome do cliente
  let cliente = null;
  if (assistencia?.id_cliente) {
    const { data: clienteData } = await supabase
      .from("clientes")
      .select("proprietario")
      .eq("id_cliente", assistencia.id_cliente)
      .single();
    cliente = clienteData;
  }

  return new Response(
    JSON.stringify({
      ...avaliacao,
      assistencia,
      assistencia_finalizada: finalizacao,
      cliente,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Rota: Salvar avaliação (POST) ─────────────────────────────────

async function handlePostAvaliacao(req: Request): Promise<Response> {
  const { token, nota, comentario } = await req.json();

  if (!token || !nota || nota < 1 || nota > 10) {
    return new Response(
      JSON.stringify({ error: "Token e nota (1-10) são obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = getSupabaseClient();

  // Verificar se a avaliação existe e está pendente
  const { data: avaliacao } = await supabase
    .from("avaliacoes_nps")
    .select("id, status")
    .eq("token", token)
    .single();

  if (!avaliacao) {
    return new Response(
      JSON.stringify({ error: "Avaliação não encontrada." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (avaliacao.status === "respondida") {
    return new Response(
      JSON.stringify({ error: "Esta avaliação já foi respondida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Salvar avaliação
  const { error } = await supabase
    .from("avaliacoes_nps")
    .update({
      nota,
      comentario: comentario || null,
      status: "respondida",
      responded_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (error) {
    console.error("❌ Erro ao salvar avaliação:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao salvar avaliação." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`✅ Avaliação respondida: token=${token}, nota=${nota}`);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Router ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    switch (path) {
      case "send-envelope":
        return await handleSendEnvelope(req);
      case "webhook":
        return await handleWebhook(req);
      case "resend":
        return await handleResend(req);
      case "signing-url":
        return await handleSigningUrl(req);
      case "avaliacao":
        if (req.method === "GET") return await handleGetAvaliacao(req);
        if (req.method === "POST") return await handlePostAvaliacao(req);
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
      default:
        return new Response(
          JSON.stringify({ error: `Rota não encontrada: ${path}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("❌ Erro na edge function clicksign:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
