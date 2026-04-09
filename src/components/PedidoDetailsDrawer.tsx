"use client";

import { useEffect, useState } from "react";
import {
  X,
  Phone,
  Building2,
  Calendar,
  Hash,
  User,
  Bell,
  Users2,
  FileText,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseComprasClient } from "@/utils/supabase-compras/client";
import { WhatsAppStatusIcon, type WhatsAppStatus } from "./WhatsAppStatusIcon";

interface EventoPedido {
  id: string;
  created_at: string;
  id_pedido: string | null;
  storage_pdf_pedido: string | null;
  id_fornecedor: string | null;
  nome_fornecedor: string | null;
  contato_fornecedor: string | null;
  centro_custo: string | null;
  fornecedor_notificado: boolean | null;
  grupo_notificado: boolean | null;
  nome_contato: string | null;
}

interface MessageStatus {
  id: string;
  message_id: string;
  tipo_destinatario: "fornecedor" | "grupo";
  destinatario: string;
  nome_destinatario: string | null;
  status: WhatsAppStatus;
  status_timestamp: string;
  button_clicked: boolean;
  button_clicked_at: string | null;
  created_at: string;
}

interface PedidoDetailsDrawerProps {
  evento: EventoPedido | null;
  onClose: () => void;
}

export function PedidoDetailsDrawer({ evento, onClose }: PedidoDetailsDrawerProps) {
  const [statuses, setStatuses] = useState<MessageStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!evento) return;

    const fetchStatuses = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseComprasClient();
        const { data, error } = await (supabase
          .from("whatsapp_message_status") as any)
          .select("*")
          .eq("evento_pedido_id", evento.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setStatuses(data || []);
      } catch (err) {
        console.error("Erro ao buscar status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, [evento]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  return (
    <AnimatePresence>
      {evento && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[540px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--foreground)] truncate">
                    Pedido #{evento.id_pedido || "—"}
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">
                    {evento.nome_fornecedor}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Content scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Info Cards */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Informações do Pedido
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard
                    icon={<Hash className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Pedido"
                    value={evento.id_pedido || "—"}
                  />
                  <InfoCard
                    icon={<Building2 className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Centro de Custo"
                    value={evento.centro_custo || "—"}
                  />
                  <InfoCard
                    icon={<User className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Fornecedor"
                    value={evento.nome_fornecedor || "—"}
                  />
                  <InfoCard
                    icon={<Phone className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Contato"
                    value={
                      evento.contato_fornecedor
                        ? formatPhone(evento.contato_fornecedor)
                        : "—"
                    }
                  />
                  <InfoCard
                    icon={<User className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Nome do Contato"
                    value={evento.nome_contato || "—"}
                  />
                  <InfoCard
                    icon={<Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Recebido em"
                    value={formatDateTime(evento.created_at)}
                  />
                </div>

                {evento.storage_pdf_pedido && (
                  <a
                    href={evento.storage_pdf_pedido}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors w-fit"
                  >
                    <Download className="w-4 h-4" />
                    Baixar PDF do Pedido
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Timeline de Notificações */}
              <div>
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                  Histórico de Notificações
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
                  </div>
                ) : statuses.length === 0 ? (
                  <div className="text-center py-10 bg-[var(--background-alt)] rounded-xl border border-[var(--border)]">
                    <Bell className="w-8 h-8 text-[var(--border)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Nenhuma notificação registrada ainda
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(["fornecedor", "grupo"] as const).map((tipo) => {
                      const items = statuses.filter((s) => s.tipo_destinatario === tipo);
                      if (items.length === 0) return null;
                      return (
                        <div key={tipo} className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            {tipo === "fornecedor" ? (
                              <User className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            ) : (
                              <Users2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            )}
                            <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                              {tipo === "fornecedor" ? "Fornecedor" : "Grupo da Obra"}
                            </span>
                          </div>
                          {items.map((s) => (
                            <div
                              key={s.id}
                              className="bg-white border border-[var(--border)] rounded-xl p-4 space-y-2"
                            >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {s.tipo_destinatario === "fornecedor" ? (
                              <User className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                            ) : (
                              <Users2 className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                                {s.nome_destinatario || s.destinatario}
                              </p>
                              <p className="text-[11px] text-[var(--muted-foreground)] font-mono">
                                {s.destinatario.includes("@")
                                  ? s.destinatario
                                  : formatPhone(s.destinatario)}
                              </p>
                            </div>
                          </div>
                          <WhatsAppStatusIcon
                            status={s.status}
                            buttonClicked={s.button_clicked}
                            showLabel
                          />
                        </div>

                        {/* Timeline mini */}
                        <div className="pt-2 border-t border-[var(--border)] space-y-1">
                          <TimelineItem
                            label="Enviado"
                            timestamp={s.created_at}
                            active
                          />
                          {s.status === "RECEIVED" ||
                          s.status === "READ" ||
                          s.status === "PLAYED" ? (
                            <TimelineItem
                              label="Entregue"
                              timestamp={s.status_timestamp}
                              active
                            />
                          ) : null}
                          {s.status === "READ" || s.status === "PLAYED" ? (
                            <TimelineItem
                              label="Lido"
                              timestamp={s.status_timestamp}
                              active
                              highlight
                            />
                          ) : null}
                          {s.button_clicked && s.button_clicked_at && (
                            <TimelineItem
                              label="Clicou em 'Ver pedido'"
                              timestamp={s.button_clicked_at}
                              active
                              highlight
                            />
                          )}
                          {s.status === "FAILED" && (
                            <TimelineItem
                              label="Falhou"
                              timestamp={s.status_timestamp}
                              error
                            />
                          )}
                        </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--background-alt)] rounded-lg p-3 border border-[var(--border)]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-medium">
          {label}
        </p>
      </div>
      <p className="text-sm font-medium text-[var(--foreground)] truncate">{value}</p>
    </div>
  );
}

function TimelineItem({
  label,
  timestamp,
  active,
  highlight,
  error,
}: {
  label: string;
  timestamp: string;
  active?: boolean;
  highlight?: boolean;
  error?: boolean;
}) {
  const time = new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            error
              ? "bg-red-500"
              : highlight
                ? "bg-blue-500"
                : active
                  ? "bg-emerald-500"
                  : "bg-gray-300"
          }`}
        />
        <span
          className={
            error
              ? "text-red-600"
              : highlight
                ? "text-blue-600 font-medium"
                : "text-[var(--foreground)]"
          }
        >
          {label}
        </span>
      </div>
      <span className="text-[var(--muted-foreground)] font-mono">{time}</span>
    </div>
  );
}
