"use client";

import { Check, CheckCheck, Clock, X, MousePointerClick } from "lucide-react";

export type WhatsAppStatus = "PENDING" | "SENT" | "RECEIVED" | "READ" | "PLAYED" | "FAILED";

interface WhatsAppStatusIconProps {
  status: WhatsAppStatus;
  buttonClicked?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const STATUS_LABELS: Record<WhatsAppStatus, string> = {
  PENDING: "Pendente",
  SENT: "Enviado",
  RECEIVED: "Entregue",
  READ: "Lido",
  PLAYED: "Reproduzido",
  FAILED: "Falhou",
};

export function WhatsAppStatusIcon({
  status,
  buttonClicked = false,
  size = "sm",
  showLabel = false,
}: WhatsAppStatusIconProps) {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  const renderIcon = () => {
    switch (status) {
      case "PENDING":
        return <Clock className={`${iconSize} text-gray-400`} />;
      case "SENT":
        return <Check className={`${iconSize} text-gray-400`} />;
      case "RECEIVED":
        return <CheckCheck className={`${iconSize} text-gray-400`} />;
      case "READ":
      case "PLAYED":
        return <CheckCheck className={`${iconSize} text-blue-500`} />;
      case "FAILED":
        return <X className={`${iconSize} text-red-500`} />;
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      {renderIcon()}
      {buttonClicked && (
        <MousePointerClick className={`${iconSize} text-emerald-600`} />
      )}
      {showLabel && (
        <span className="text-[11px] text-[var(--muted-foreground)]">
          {STATUS_LABELS[status]}
          {buttonClicked && " · Clicou no botão"}
        </span>
      )}
    </div>
  );
}
