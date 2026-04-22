"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileSignature,
  ShieldCheck,
  Calendar as CalendarIcon,
  Building2,
} from "lucide-react";
import { projectId, publicAnonKey } from "@/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

// ═══════════════════════════════════════════════════════════════════
// Tela pública /assinar/[token] — mesmo QR do check-in
// Estados possíveis:
//   loading            → buscando
//   nao_encontrado     → token inválido
//   vistoria_pendente  → vistoria não iniciada ou em andamento
//   nao_apto           → parecer do engenheiro foi "não apto"
//   pode_assinar       → libera botão de assinatura
//   ja_assinado        → termo já foi assinado
//   assinando          → aguardando confirmação
//   sucesso            → termo assinado
// ═══════════════════════════════════════════════════════════════════

type EstadoTela =
  | "loading"
  | "nao_encontrado"
  | "vistoria_pendente"
  | "nao_apto"
  | "pode_assinar"
  | "ja_assinado"
  | "assinando"
  | "sucesso";

interface ClienteInfo {
  nome: string | null;
  bloco: string | null;
  unidade: string | null;
}

interface SlotInfo {
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

function formatarHora(hora: string | null) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function formatarDataExtenso(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function AssinarTermoEntrega({ token }: { token: string }) {
  const [estado, setEstado] = useState<EstadoTela>("loading");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [slot, setSlot] = useState<SlotInfo | null>(null);

  const carregar = useCallback(async () => {
    setEstado("loading");
    setMensagem(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/assinar/${token}`, {
        headers: AUTH_HEADER,
      });
      const data = await resp.json();

      if (!data.ok) {
        setEstado("nao_encontrado");
        setMensagem(data.error || "Código não reconhecido");
        return;
      }

      setCliente(data.cliente || null);
      setSlot(data.slot || null);

      if (data.pode_assinar) {
        setEstado("pode_assinar");
        return;
      }

      setMensagem(data.mensagem || null);

      switch (data.motivo) {
        case "JA_ASSINADO":
          setEstado("ja_assinado");
          return;
        case "NAO_APTO":
          setEstado("nao_apto");
          return;
        case "VISTORIA_NAO_INICIADA":
        case "VISTORIA_EM_ANDAMENTO":
          setEstado("vistoria_pendente");
          return;
        default:
          setEstado("vistoria_pendente");
      }
    } catch (err: any) {
      console.error(err);
      setEstado("nao_encontrado");
      setMensagem("Erro ao buscar informações. Tente novamente em instantes.");
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleAssinar = async () => {
    setEstado("assinando");
    try {
      const resp = await fetch(`${API_BASE}/entregas/assinar/${token}/confirmar`, {
        method: "POST",
        headers: AUTH_HEADER,
      });
      const data = await resp.json();
      if (!data.ok) {
        throw new Error(data.error || "Não foi possível assinar");
      }
      setEstado("sucesso");
    } catch (err: any) {
      setEstado("pode_assinar");
      setMensagem(err?.message ?? "Erro ao assinar termo");
    }
  };

  if (estado === "loading") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
          <p className="text-sm text-[var(--muted-foreground)]">Validando código...</p>
        </div>
      </Layout>
    );
  }

  if (estado === "nao_encontrado") {
    return (
      <Layout>
        <StatusCard
          icon={<AlertTriangle className="w-10 h-10 text-red-500" />}
          title="Código não reconhecido"
          description={mensagem ?? "O QR Code utilizado não corresponde a um agendamento ativo."}
        />
      </Layout>
    );
  }

  if (estado === "vistoria_pendente") {
    return (
      <Layout>
        <ClienteHeader cliente={cliente} slot={slot} />
        <StatusCard
          icon={<Clock className="w-10 h-10 text-amber-500" />}
          title="Vistoria em andamento"
          description={mensagem ?? "A vistoria ainda não foi concluída. Aguarde o engenheiro finalizar para assinar o termo."}
          footer={
            <button
              onClick={carregar}
              className="text-sm text-black underline hover:no-underline"
            >
              Atualizar
            </button>
          }
        />
      </Layout>
    );
  }

  if (estado === "nao_apto") {
    return (
      <Layout>
        <ClienteHeader cliente={cliente} slot={slot} />
        <StatusCard
          tone="red"
          icon={<XCircle className="w-10 h-10 text-red-500" />}
          title="Entrega não concluída"
          description={mensagem ?? "A unidade foi considerada não apta para recebimento. A assinatura do termo está indisponível."}
        />
      </Layout>
    );
  }

  if (estado === "ja_assinado") {
    return (
      <Layout>
        <ClienteHeader cliente={cliente} slot={slot} />
        <StatusCard
          tone="emerald"
          icon={<CheckCircle2 className="w-10 h-10 text-emerald-500" />}
          title="Termo já assinado"
          description={mensagem ?? "Este termo de entrega já foi registrado. Nenhuma ação adicional é necessária."}
        />
      </Layout>
    );
  }

  if (estado === "sucesso") {
    return (
      <Layout>
        <ClienteHeader cliente={cliente} slot={slot} />
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-emerald-900">
            Termo assinado com sucesso!
          </h2>
          <p className="text-sm text-emerald-800">
            O recebimento do seu imóvel foi registrado. Você receberá uma cópia do termo no seu e-mail.
          </p>
        </div>
      </Layout>
    );
  }

  // estado === "pode_assinar" ou "assinando"
  const assinando = estado === "assinando";
  return (
    <Layout>
      <ClienteHeader cliente={cliente} slot={slot} />

      <div className="bg-white rounded-2xl border border-[var(--border)] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center flex-shrink-0">
            <FileSignature className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Termo de Entrega
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              A vistoria foi concluída e você está apto a receber as chaves. Assine abaixo para oficializar a entrega.
            </p>
          </div>
        </div>

        <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--border)] p-4 space-y-2">
          <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
            Ao assinar, você declara que:
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--foreground)]">
            <TermoItem>Recebeu as chaves da unidade e concorda com a entrega.</TermoItem>
            <TermoItem>Conferiu os itens listados na vistoria com o engenheiro responsável.</TermoItem>
            <TermoItem>Está ciente dos itens marcados com observação durante a vistoria.</TermoItem>
          </ul>
        </div>

        {mensagem && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">{mensagem}</p>
          </div>
        )}

        <button
          onClick={handleAssinar}
          disabled={assinando}
          className="w-full py-3.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {assinando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Assinar termo de entrega
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-[var(--muted-foreground)]">
          Após a assinatura, este QR Code não poderá ser utilizado novamente.
        </p>
      </div>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Entrega de Chaves
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                Gran Santorini
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-5">{children}</div>
    </div>
  );
}

function ClienteHeader({ cliente, slot }: { cliente: ClienteInfo | null; slot: SlotInfo | null }) {
  if (!cliente?.nome) return null;
  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] p-4 space-y-3">
      <div>
        <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
          Agendamento
        </p>
        <p className="text-base font-semibold text-[var(--foreground)] mt-0.5">
          {cliente.nome}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          <span>
            Bl. {cliente.bloco ?? "—"} · Ap. {cliente.unidade ?? "—"}
          </span>
        </div>
        {slot?.data && (
          <div className="flex items-center gap-1.5 capitalize">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{formatarDataExtenso(slot.data)}</span>
          </div>
        )}
        {slot?.hora_inicio && slot?.hora_fim && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {formatarHora(slot.hora_inicio)}–{formatarHora(slot.hora_fim)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  tone,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: "red" | "emerald" | "amber";
  footer?: React.ReactNode;
}) {
  const bgClass =
    tone === "red"
      ? "bg-red-50 border-red-200"
      : tone === "emerald"
        ? "bg-emerald-50 border-emerald-200"
        : "bg-white border-[var(--border)]";

  return (
    <div className={`rounded-2xl border p-6 text-center space-y-3 ${bgClass}`}>
      <div className="mx-auto">{icon}</div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>
      {footer && <div className="pt-2">{footer}</div>}
    </div>
  );
}

function TermoItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
