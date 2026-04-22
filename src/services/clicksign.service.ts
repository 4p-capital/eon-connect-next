// src/services/clicksign.service.ts
// Cliente frontend para integração Clicksign via Edge Function do Supabase
// Todas as chamadas à API Clicksign passam pelo backend (token seguro)

import { publicAnonKey, clicksignFunctionUrl } from "@/utils/supabase/info";

// ============================================================
// TIPOS
// ============================================================

export interface ClicksignSendEnvelopeInput {
  pdf_base64: string;
  filename: string;
  signer_name: string;
  signer_email: string;
  signer_phone: string;
  signer_cpf: string;
  id_assistencia: number | string;
  id_finalizacao?: number;
  deadline_days?: number;
}

export interface ClicksignSendEnvelopeResult {
  success: boolean;
  data?: {
    envelope_id: string;
    document_id: string;
    signer_id: string;
    signing_url: string | null;
    signing_url_path: string | null;
    whatsapp_sent: boolean;
    status: string;
  };
  error?: string;
}

export interface ClicksignResendInput {
  id_finalizacao: number;
}

export interface ClicksignResendResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CLICKSIGN_FUNCTION_URL = `${clicksignFunctionUrl}`;

async function clicksignFetch<T>(
  route: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${CLICKSIGN_FUNCTION_URL}/${route}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      apikey: publicAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Erro ${response.status} na requisição Clicksign`);
  }

  return data as T;
}

// ============================================================
// 1. ENVIAR TERMO PARA ASSINATURA
// ============================================================

/**
 * Envia o PDF do termo de assistência para assinatura digital via Clicksign.
 * O backend cria o envelope, faz upload do PDF, adiciona o signatário,
 * configura autenticação via WhatsApp, ativa e envia notificação.
 */
export async function enviarTermoParaAssinatura(
  input: ClicksignSendEnvelopeInput
): Promise<ClicksignSendEnvelopeResult> {
  return clicksignFetch<ClicksignSendEnvelopeResult>("send-envelope", input as unknown as Record<string, unknown>);
}

// ============================================================
// 2. REENVIAR NOTIFICAÇÃO
// ============================================================

/**
 * Reenvia a notificação de assinatura via WhatsApp para o signatário.
 * Útil quando o cliente não recebeu ou perdeu a mensagem original.
 */
export async function reenviarNotificacaoAssinatura(
  input: ClicksignResendInput
): Promise<ClicksignResendResult> {
  return clicksignFetch<ClicksignResendResult>("resend", input as unknown as Record<string, unknown>);
}

// ============================================================
// 3. HELPER: Verificar se Clicksign está habilitado
// ============================================================

export function isClicksignEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLICKSIGN_ENABLED === "true";
}
