// src/services/clicksign.webhook.ts
// Webhook do Clicksign é tratado na edge function (supabase/functions/clicksign/index.ts)
// Este arquivo mantém apenas os tipos para referência no frontend

export type ClicksignWebhookEvent =
  | "sign"
  | "close"
  | "auto_close"
  | "cancel"
  | "refusal"
  | "deadline"
  | "add_signer"
  | "remove_signer";

export type ClicksignStatus =
  | "running"    // Aguardando assinatura
  | "signed"     // Assinado pelo cliente
  | "closed"     // Envelope fechado (todos assinaram)
  | "refused"    // Cliente recusou assinar
  | "expired"    // Prazo expirou (aceitação tácita)
  | "canceled";  // Cancelado

export interface ClicksignStatusInfo {
  label: string;
  color: string;
  bgColor: string;
}

/** Mapa de status Clicksign para exibição no frontend */
export const CLICKSIGN_STATUS_MAP: Record<ClicksignStatus, ClicksignStatusInfo> = {
  running: { label: "Aguardando assinatura", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  signed: { label: "Assinado digitalmente", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  closed: { label: "Finalizado", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  refused: { label: "Recusado pelo cliente", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  expired: { label: "Prazo expirado (aceite tácito)", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  canceled: { label: "Cancelado", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" },
};
