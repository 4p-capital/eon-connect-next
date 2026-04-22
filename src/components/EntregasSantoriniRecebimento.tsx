"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ScanLine,
  Loader2,
  Building2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  FileSignature,
  Search,
  X,
  AlertTriangle,
  Calendar,
  KeyRound,
} from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useUser } from "@/contexts/UserContext";
import { getSupabaseClient } from "@/utils/supabase/client";
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";
import { QRScannerDialog } from "@/components/QRScannerDialog";

const API_BASE = `${apiBaseUrl}`;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

type VistoriaStatus =
  | "aguardando_docs"
  | "docs_validados"
  | "vistoria_em_andamento"
  | "finalizada_apto"
  | "finalizada_nao_apto"
  | "termo_assinado"
  | "concluida"; // legado

interface VistoriaResumo {
  id: string;
  status: VistoriaStatus;
  parecer_cliente: "apto" | "nao_apto" | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  termo_assinado_em: string | null;
  created_at: string;
  updated_at: string;
  cliente: {
    nome: string | null;
    bloco: string | null;
    unidade: string | null;
    cpf: string | null;
  };
  slot: {
    data: string | null;
    hora_inicio: string | null;
    hora_fim: string | null;
    checkin_token: string | null;
  };
  engenheiro: {
    id: number;
    nome: string | null;
    email: string | null;
  } | null;
}

type Aba = "andamento" | "finalizadas";

const STATUS_FINALIZADOS: VistoriaStatus[] = [
  "finalizada_apto",
  "finalizada_nao_apto",
  "termo_assinado",
  "concluida",
];

function formatarDataCurta(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatarHora(hora: string | null) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function formatarTimestampRelativo(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EntregasSantoriniRecebimento() {
  const { hasPermission, loading: permLoading } = usePermissionGuard(
    "entregas.santorini.recebimento",
  );
  const { userData } = useUser();
  const router = useRouter();

  const [vistorias, setVistorias] = useState<VistoriaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("andamento");
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const fetchVistorias = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/entregas/recebimento/lista`, {
        headers: AUTH_HEADER,
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setVistorias(data.vistorias || []);
    } catch (err) {
      console.error("Erro ao carregar vistorias:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission) return;
    fetchVistorias();
  }, [hasPermission, fetchVistorias]);

  // Realtime: atualiza lista quando uma vistoria muda
  const fetchRef = useRef(fetchVistorias);
  fetchRef.current = fetchVistorias;

  useEffect(() => {
    if (!hasPermission) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("entregas_recebimento_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vistoria_entrega" },
        () => fetchRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasPermission]);

  // Filtragem por aba + busca
  const vistoriasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vistorias.filter((v) => {
      const finalizada = STATUS_FINALIZADOS.includes(v.status);
      const matchAba = aba === "finalizadas" ? finalizada : !finalizada;
      if (!matchAba) return false;
      if (!term) return true;
      const blob = [v.cliente.nome, v.cliente.cpf, v.cliente.bloco, v.cliente.unidade]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(term);
    });
  }, [vistorias, aba, search]);

  // Métricas
  const stats = useMemo(() => {
    const emAndamento = vistorias.filter((v) => !STATUS_FINALIZADOS.includes(v.status)).length;
    const finalizadas = vistorias.filter((v) => STATUS_FINALIZADOS.includes(v.status)).length;
    const aptos = vistorias.filter((v) => v.parecer_cliente === "apto").length;
    const assinados = vistorias.filter((v) => v.status === "termo_assinado").length;
    return { emAndamento, finalizadas, aptos, assinados };
  }, [vistorias]);

  const handleQRDetected = async (token: string) => {
    if (scannerBusy) return;
    setScannerBusy(true);
    setScannerError(null);
    try {
      const checkinResp = await fetch(`${API_BASE}/entregas/checkin/${token}`, {
        headers: AUTH_HEADER,
      });
      const checkinData = await checkinResp.json();

      if (!checkinData.ok) {
        throw new Error(checkinData.error || "QR inválido");
      }

      // Se já existe vistoria, vai direto
      if (checkinData.vistoria?.id) {
        setScannerOpen(false);
        router.push(`/entregas/santorini/vistoria/${checkinData.vistoria.id}`);
        return;
      }

      // Cria vistoria do zero
      const criarResp = await fetch(`${API_BASE}/entregas/vistoria/criar`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: checkinData.slot.id,
          tipo_representante: "cliente",
          engenheiro_user_id: userData?.id ?? null,
        }),
      });
      const criarData = await criarResp.json();
      if (!criarData.ok) throw new Error(criarData.error || "Erro ao criar vistoria");

      setScannerOpen(false);
      router.push(`/entregas/santorini/vistoria/${criarData.vistoria.id}`);
    } catch (err: any) {
      setScannerError(err?.message ?? "Erro ao processar QR Code");
    } finally {
      setScannerBusy(false);
    }
  };

  if (permLoading || !hasPermission) {
    return (
      <div className="min-h-screen bg-[var(--background-alt)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">
                  Recebimento — Gran Santorini
                </h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {loading ? "Carregando..." : `${stats.emAndamento} em andamento · ${stats.finalizadas} finalizadas`}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setScannerError(null);
                setScannerOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              Iniciar Entrega
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Clock className="w-4 h-4 text-blue-600" />}
            label="Em andamento"
            value={stats.emAndamento}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            label="Finalizadas"
            value={stats.finalizadas}
            color="emerald"
          />
          <StatCard
            icon={<KeyRound className="w-4 h-4 text-violet-600" />}
            label="Aptos"
            value={stats.aptos}
            color="violet"
          />
          <StatCard
            icon={<FileSignature className="w-4 h-4 text-amber-600" />}
            label="Termos assinados"
            value={stats.assinados}
            color="amber"
          />
        </div>
      </div>

      {/* Tabs + busca */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center bg-white rounded-xl border border-[var(--border)] p-1">
          <AbaBtn active={aba === "andamento"} onClick={() => setAba("andamento")}>
            Em andamento
          </AbaBtn>
          <AbaBtn active={aba === "finalizadas"} onClick={() => setAba("finalizadas")}>
            Finalizadas
          </AbaBtn>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, bloco ou unidade..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Carregando entregas...</p>
          </div>
        ) : vistoriasFiltradas.length === 0 ? (
          <EmptyState
            aba={aba}
            onScan={() => {
              setScannerError(null);
              setScannerOpen(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vistoriasFiltradas.map((v) => (
              <VistoriaCard key={v.id} vistoria={v} onClick={() => router.push(`/entregas/santorini/vistoria/${v.id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Scanner modal */}
      <QRScannerDialog
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScannerError(null);
        }}
        onDetected={handleQRDetected}
        title="Escanear QR do Cliente"
        subtitle="Posicione o QR Code do agendamento na área de leitura"
      />
      {scannerOpen && scannerBusy && (
        <div className="fixed inset-x-0 bottom-8 z-[60] flex justify-center pointer-events-none">
          <div className="bg-black text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Validando código...
          </div>
        </div>
      )}
      {scannerOpen && scannerError && (
        <div className="fixed inset-x-0 bottom-8 z-[60] flex justify-center px-4">
          <div className="max-w-md w-full bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl shadow-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{scannerError}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AbaBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-black text-white"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "emerald" | "violet" | "amber";
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
  };
  return (
    <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-xs font-medium ${colorMap[color]}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function EmptyState({ aba, onScan }: { aba: Aba; onScan: () => void }) {
  if (aba === "andamento") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--background-alt)] flex items-center justify-center">
          <ScanLine className="w-8 h-8 text-[var(--muted-foreground)]" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Nenhuma entrega em andamento
          </p>
          <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
            Escaneie o QR Code do cliente para iniciar uma nova entrega.
          </p>
        </div>
        <button
          onClick={onScan}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <ScanLine className="w-4 h-4" />
          Iniciar Entrega
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <CheckCircle2 className="w-10 h-10 text-[var(--border)]" />
      <p className="text-sm text-[var(--muted-foreground)]">
        Nenhuma entrega finalizada ainda
      </p>
    </div>
  );
}

function VistoriaCard({
  vistoria,
  onClick,
}: {
  vistoria: VistoriaResumo;
  onClick: () => void;
}) {
  const { label, style, icon } = resolveStatusBadge(vistoria);
  const etapa = resolveEtapa(vistoria);

  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-white rounded-xl border border-[var(--border)] p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <User className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              {vistoria.cliente.nome ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Building2 className="w-3 h-3" />
            <span>
              Bl. {vistoria.cliente.bloco ?? "—"} · Ap. {vistoria.cliente.unidade ?? "—"}
            </span>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0 ${style}`}>
          {icon}
          {label}
        </span>
      </div>

      {/* Etapa atual */}
      <div className="bg-[var(--background-alt)] rounded-lg px-3 py-2 mb-3">
        <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">
          Etapa atual
        </p>
        <p className="text-xs font-medium text-[var(--foreground)]">{etapa}</p>
      </div>

      {/* Engenheiro responsável */}
      {vistoria.engenheiro?.nome && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mb-2">
          <KeyRound className="w-3 h-3" />
          <span>Engenheiro: <span className="text-[var(--foreground)] font-medium">{vistoria.engenheiro.nome}</span></span>
        </div>
      )}

      {/* Metadados */}
      <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>
            {formatarDataCurta(vistoria.slot.data)} · {formatarHora(vistoria.slot.hora_inicio)}–{formatarHora(vistoria.slot.hora_fim)}
          </span>
        </div>
        {vistoria.updated_at && (
          <span>Atualizado {formatarTimestampRelativo(vistoria.updated_at)}</span>
        )}
      </div>
    </button>
  );
}

function resolveStatusBadge(v: VistoriaResumo) {
  switch (v.status) {
    case "aguardando_docs":
      return {
        label: "Docs pendentes",
        style: "bg-gray-100 text-gray-700",
        icon: <Clock className="w-3 h-3" />,
      };
    case "docs_validados":
      return {
        label: "Docs validados",
        style: "bg-blue-100 text-blue-700",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    case "vistoria_em_andamento":
      return {
        label: "Vistoria em andamento",
        style: "bg-amber-100 text-amber-700",
        icon: <ClipboardCheck className="w-3 h-3" />,
      };
    case "finalizada_apto":
      return {
        label: "Apto — aguarda assinatura",
        style: "bg-emerald-100 text-emerald-700",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    case "finalizada_nao_apto":
      return {
        label: "Não apto",
        style: "bg-red-100 text-red-700",
        icon: <XCircle className="w-3 h-3" />,
      };
    case "termo_assinado":
      return {
        label: "Termo assinado",
        style: "bg-violet-100 text-violet-700",
        icon: <FileSignature className="w-3 h-3" />,
      };
    default:
      return {
        label: v.status,
        style: "bg-gray-100 text-gray-700",
        icon: <Clock className="w-3 h-3" />,
      };
  }
}

function resolveEtapa(v: VistoriaResumo) {
  switch (v.status) {
    case "aguardando_docs":
      return "Aguardando envio dos documentos";
    case "docs_validados":
      return "Documentos validados — pronto para iniciar vistoria";
    case "vistoria_em_andamento":
      return "Preenchendo checklist de vistoria";
    case "finalizada_apto":
      return "Vistoria concluída — aguardando cliente assinar o termo";
    case "finalizada_nao_apto":
      return "Vistoria concluída — cliente não aceitou receber";
    case "termo_assinado":
      return "Termo de entrega assinado";
    default:
      return v.status;
  }
}
