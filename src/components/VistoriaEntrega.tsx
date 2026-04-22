"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  Upload,
  User,
  X,
  AlertTriangle,
  Calendar,
  FileSignature,
  XCircle,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  FileText,
  CircleAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useUser } from "@/contexts/UserContext";
import { projectId, publicAnonKey } from "@/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

// ═══════════════════════════════════════════════════════════════════
// Stepper de vistoria de entrega
// Steps renderizados com base no `status` do backend (fonte da verdade):
//   aguardando_docs        → Step 1: Documentos
//   docs_validados         → Step 2: Checklist
//   vistoria_em_andamento  → Step 2: Checklist
//   finalizada_apto        → Step 3: Resultado (apto, pode assinar)
//   finalizada_nao_apto    → Step 3: Resultado (não apto)
//   termo_assinado         → Step 3: Resultado (fluxo encerrado)
// ═══════════════════════════════════════════════════════════════════

type VistoriaStatus =
  | "aguardando_docs"
  | "docs_validados"
  | "vistoria_em_andamento"
  | "finalizada_apto"
  | "finalizada_nao_apto"
  | "termo_assinado"
  | "concluida"; // legado

interface VistoriaData {
  id: string;
  status: VistoriaStatus;
  tipo_representante: "cliente" | "terceiro";
  docs_validados_em: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
  finalizada_em: string | null;
  parecer_cliente: "apto" | "nao_apto" | null;
  observacoes_gerais: string | null;
  termo_assinado_em: string | null;
  engenheiro_user_id: number | null;
}

interface EngenheiroInfo {
  id: number;
  nome: string | null;
  email: string | null;
}

interface ClienteData {
  nome: string | null;
  bloco: string | null;
  unidade: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
}

interface SlotData {
  id: string | null;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  checkin_token: string | null;
  token_usado_checkin_em: string | null;
  token_usado_assinatura_em: string | null;
}

interface DocsUrls {
  identidade: string | null;
  procuracao: string | null;
  proprietario: string | null;
}

interface ItemVistoria {
  id: string;
  item_key: string;
  item_label: string;
  categoria: string | null;
  ordem: number | null;
  aceito: boolean | null;
  observacao: string | null;
  foto_path: string | null;
  foto_url: string | null;
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VistoriaEntrega({ vistoriaId }: { vistoriaId: string }) {
  const { hasPermission, loading: permLoading } = usePermissionGuard(
    "entregas.santorini.recebimento",
  );
  const router = useRouter();
  const { userData } = useUser();

  const [loading, setLoading] = useState(true);
  const [vistoria, setVistoria] = useState<VistoriaData | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [docs, setDocs] = useState<DocsUrls>({ identidade: null, procuracao: null, proprietario: null });
  const [itens, setItens] = useState<ItemVistoria[]>([]);
  const [engenheiro, setEngenheiro] = useState<EngenheiroInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fetchVistoria = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoriaId}`, {
        headers: AUTH_HEADER,
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setVistoria(data.vistoria);
      setCliente(data.cliente);
      setSlot(data.slot);
      setDocs(data.docs);
      setItens(data.itens || []);
      setEngenheiro(data.engenheiro ?? null);
      setErro(null);
    } catch (err: any) {
      setErro(err.message || "Erro ao carregar vistoria");
    } finally {
      setLoading(false);
    }
  }, [vistoriaId]);

  useEffect(() => {
    if (!hasPermission) return;
    fetchVistoria();
  }, [hasPermission, fetchVistoria]);

  if (permLoading || !hasPermission) {
    return (
      <div className="min-h-screen bg-[var(--background-alt)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background-alt)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Carregando vistoria...</p>
      </div>
    );
  }

  if (!vistoria || !cliente || !slot) {
    return (
      <div className="min-h-screen bg-[var(--background-alt)] flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm text-[var(--muted-foreground)]">{erro || "Vistoria não encontrada"}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-black underline hover:no-underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  const stepAtual = resolveStepAtual(vistoria.status);

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push("/entregas/santorini/recebimento")}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-alt)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                {cliente.nome ?? "Vistoria"}
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                Bl. {cliente.bloco ?? "—"} · Ap. {cliente.unidade ?? "—"}
              </p>
            </div>
          </div>

          {/* Stepper visual */}
          <StepperHeader stepAtual={stepAtual} />
        </div>
      </div>

      {/* Info do agendamento */}
      {slot.data && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center gap-4 bg-white rounded-xl border border-[var(--border)] p-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--foreground)] capitalize">
                {formatarDataExtenso(slot.data)}
              </span>
            </div>
            {slot.hora_inicio && slot.hora_fim && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-sm text-[var(--foreground)]">
                  {formatarHora(slot.hora_inicio)} – {formatarHora(slot.hora_fim)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Erro global */}
      {erro && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-700">{erro}</p>
          </div>
        </div>
      )}

      {/* Conteúdo do step atual */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        {stepAtual === 1 && (
          <StepDocumentos
            vistoria={vistoria}
            docs={docs}
            onError={setErro}
            onRefresh={fetchVistoria}
          />
        )}

        {stepAtual === 2 && (
          <StepChecklist
            vistoria={vistoria}
            itens={itens}
            setItens={setItens}
            onError={setErro}
            onRefresh={fetchVistoria}
          />
        )}

        {stepAtual === 3 && (
          <StepResultado
            vistoria={vistoria}
            cliente={cliente}
            slot={slot}
            itens={itens}
            engenheiroNome={engenheiro?.nome ?? userData?.nome}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEPPER VISUAL
// ═══════════════════════════════════════════════════════════════

function StepperHeader({ stepAtual }: { stepAtual: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: "Documentos", icon: FileText },
    { num: 2, label: "Vistoria", icon: ClipboardCheck },
    { num: 3, label: "Parecer", icon: ShieldCheck },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => {
        const done = stepAtual > s.num;
        const active = stepAtual === s.num;
        const Icon = s.icon;
        return (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-black text-white"
                      : "bg-[var(--background-alt)] text-[var(--muted-foreground)]"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-px flex-1 mx-2 ${done ? "bg-emerald-300" : "bg-[var(--border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function resolveStepAtual(status: VistoriaStatus): 1 | 2 | 3 {
  switch (status) {
    case "aguardando_docs":
      return 1;
    case "docs_validados":
    case "vistoria_em_andamento":
      return 2;
    case "finalizada_apto":
    case "finalizada_nao_apto":
    case "termo_assinado":
    case "concluida":
      return 3;
    default:
      return 1;
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — DOCUMENTOS
// ═══════════════════════════════════════════════════════════════

function StepDocumentos({
  vistoria,
  docs,
  onError,
  onRefresh,
}: {
  vistoria: VistoriaData;
  docs: DocsUrls;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
}) {
  const [tipoRep, setTipoRep] = useState<"cliente" | "terceiro">(
    vistoria.tipo_representante,
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const [localPreviews, setLocalPreviews] = useState<DocsUrls>(docs);

  useEffect(() => {
    setLocalPreviews(docs);
  }, [docs]);

  const handleUpload = async (tipo: "identidade" | "procuracao" | "proprietario", file: File) => {
    setUploading(tipo);
    onError(null);
    try {
      const base64 = await fileToBase64(file);
      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoria.id}/upload-doc`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, base64 }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setLocalPreviews((prev) => ({ ...prev, [tipo]: data.url }));
    } catch (err: any) {
      onError(err.message || "Erro ao fazer upload");
    } finally {
      setUploading(null);
    }
  };

  const handleValidar = async () => {
    setValidando(true);
    onError(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoria.id}/validar-docs`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_representante: tipoRep }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      onRefresh();
    } catch (err: any) {
      onError(err.message || "Erro ao validar documentos");
    } finally {
      setValidando(false);
    }
  };

  const docsOk =
    localPreviews.identidade &&
    (tipoRep === "cliente" || (localPreviews.procuracao && localPreviews.proprietario));

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[var(--border)] p-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">
            Passo 1 · Validação dos documentos
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Tire foto do documento de identificação para dar sequência à entrega.
          </p>
        </div>

        {/* Tipo de representante */}
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">
            Quem está recebendo?
          </p>
          <div className="flex items-center gap-2">
            <TipoRepBtn
              active={tipoRep === "cliente"}
              onClick={() => setTipoRep("cliente")}
              label="Cliente (proprietário)"
            />
            <TipoRepBtn
              active={tipoRep === "terceiro"}
              onClick={() => setTipoRep("terceiro")}
              label="Terceiro"
            />
          </div>
        </div>

        {/* Uploads */}
        <div className="space-y-3">
          <DocUploadField
            label="RG ou CNH"
            tipo="identidade"
            preview={localPreviews.identidade}
            uploading={uploading === "identidade"}
            onUpload={(f) => handleUpload("identidade", f)}
          />
          {tipoRep === "terceiro" && (
            <>
              <DocUploadField
                label="Procuração"
                tipo="procuracao"
                preview={localPreviews.procuracao}
                uploading={uploading === "procuracao"}
                onUpload={(f) => handleUpload("procuracao", f)}
              />
              <DocUploadField
                label="RG/CNH do Proprietário"
                tipo="proprietario"
                preview={localPreviews.proprietario}
                uploading={uploading === "proprietario"}
                onUpload={(f) => handleUpload("proprietario", f)}
              />
            </>
          )}
        </div>

        {/* Botão confirmar */}
        <button
          onClick={handleValidar}
          disabled={!docsOk || validando || uploading !== null}
          className="w-full py-3 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {validando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          {validando ? "Validando..." : "Validar documentos e avançar"}
        </button>
        {!docsOk && (
          <p className="text-[11px] text-center text-[var(--muted-foreground)]">
            {tipoRep === "cliente"
              ? "Envie o documento de identidade para continuar"
              : "Envie os 3 documentos (identidade, procuração e RG/CNH do proprietário)"}
          </p>
        )}
      </div>
    </div>
  );
}

function TipoRepBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-all ${
        active
          ? "bg-black text-white border-black"
          : "bg-white text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--background-alt)]"
      }`}
    >
      {label}
    </button>
  );
}

function DocUploadField({
  label,
  tipo,
  preview,
  uploading,
  onUpload,
}: {
  label: string;
  tipo: string;
  preview: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputId = `doc-upload-${tipo}`;
  return (
    <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
        </div>
        {preview ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            Enviado
          </span>
        ) : (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Pendente
          </span>
        )}
      </div>
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={label}
            className="w-full h-32 object-cover rounded-lg border border-[var(--border)]"
          />
          <label
            htmlFor={inputId}
            className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium px-2 py-1 rounded-lg cursor-pointer hover:bg-black/80 flex items-center gap-1"
          >
            <Camera className="w-3 h-3" />
            Trocar
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-gray-400 transition-colors ${
            uploading ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-[var(--muted-foreground)] mb-1" />
              <span className="text-xs text-[var(--muted-foreground)]">Clique para tirar foto</span>
            </>
          )}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — CHECKLIST DA VISTORIA
// ═══════════════════════════════════════════════════════════════

function StepChecklist({
  vistoria,
  itens,
  setItens,
  onError,
  onRefresh,
}: {
  vistoria: VistoriaData;
  itens: ItemVistoria[];
  setItens: React.Dispatch<React.SetStateAction<ItemVistoria[]>>;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
}) {
  const [iniciando, setIniciando] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [parecerOpen, setParecerOpen] = useState(false);

  // Inicia automaticamente a vistoria ao entrar se status = docs_validados
  useEffect(() => {
    if (vistoria.status !== "docs_validados") return;
    let active = true;
    (async () => {
      setIniciando(true);
      try {
        const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoria.id}/iniciar`, {
          method: "POST",
          headers: AUTH_HEADER,
        });
        const data = await resp.json();
        if (!active) return;
        if (!data.ok) throw new Error(data.error);
        onRefresh();
      } catch (err: any) {
        onError(err?.message ?? "Erro ao iniciar vistoria");
      } finally {
        if (active) setIniciando(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [vistoria.id, vistoria.status, onError, onRefresh]);

  const handleItemUpdate = async (
    itemKey: string,
    aceito: boolean,
    observacao?: string,
    fotoFile?: File,
  ) => {
    setUploadingItem(itemKey);
    onError(null);
    try {
      let fotoBase64: string | undefined;
      if (fotoFile) {
        fotoBase64 = await fileToBase64(fotoFile);
      }
      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoria.id}/item`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_key: itemKey,
          aceito,
          observacao: observacao ?? undefined,
          foto_base64: fotoBase64,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      setItens((prev) =>
        prev.map((item) =>
          item.item_key === itemKey
            ? {
                ...item,
                aceito: data.item.aceito,
                observacao: data.item.observacao,
                foto_path: data.item.foto_path,
                foto_url: data.item.foto_url,
              }
            : item,
        ),
      );
    } catch (err: any) {
      onError(err.message || "Erro ao salvar item");
    } finally {
      setUploadingItem(null);
    }
  };

  const itensOk = itens.filter((i) => i.aceito === true).length;
  const itensNaoAceitos = itens.filter((i) => i.aceito === false).length;
  const itensPendentes = itens.filter((i) => i.aceito === null).length;
  const todosPreenchidos = itens.every((i) => i.aceito !== null && i.foto_path);

  // Agrupa itens por categoria para render
  const itensPorCategoria = useMemo(() => {
    const map = new Map<string, ItemVistoria[]>();
    const sorted = [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    for (const it of sorted) {
      const cat = it.categoria ?? "Itens";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    return Array.from(map.entries());
  }, [itens]);

  if (iniciando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
        <p className="text-sm text-[var(--muted-foreground)]">Iniciando vistoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">OK</span>
          </div>
          <p className="text-xl font-bold text-emerald-700">{itensOk}</p>
        </div>
        <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <X className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-700">Não aceito</span>
          </div>
          <p className="text-xl font-bold text-red-700">{itensNaoAceitos}</p>
        </div>
        <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-600">Pendente</span>
          </div>
          <p className="text-xl font-bold text-gray-700">{itensPendentes}</p>
        </div>
      </div>

      {/* Checklist agrupado */}
      <div className="space-y-5">
        {itensPorCategoria.map(([cat, itensCat]) => (
          <div key={cat}>
            <h3 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 px-1">
              {cat}
            </h3>
            <div className="space-y-3">
              {itensCat.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  uploading={uploadingItem === item.item_key}
                  onUpdate={handleItemUpdate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Botão finalizar */}
      <button
        onClick={() => setParecerOpen(true)}
        disabled={!todosPreenchidos}
        className="w-full py-3.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <ShieldCheck className="w-5 h-5" />
        Finalizar vistoria e registrar parecer
      </button>
      {!todosPreenchidos && (
        <p className="text-[11px] text-center text-[var(--muted-foreground)] -mt-2">
          Preencha todos os itens com status e foto para finalizar
        </p>
      )}

      <ParecerDialog
        open={parecerOpen}
        vistoriaId={vistoria.id}
        itensNaoAceitos={itensNaoAceitos}
        onClose={() => setParecerOpen(false)}
        onFinalizado={() => {
          setParecerOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}

function ItemCard({
  item,
  uploading,
  onUpdate,
}: {
  item: ItemVistoria;
  uploading: boolean;
  onUpdate: (key: string, aceito: boolean, obs?: string, foto?: File) => void;
}) {
  const [obs, setObs] = useState(item.observacao || "");
  const [localAceito, setLocalAceito] = useState(item.aceito);

  useEffect(() => {
    setLocalAceito(item.aceito);
    setObs(item.observacao || "");
  }, [item.aceito, item.observacao]);

  const handleStatusChange = (aceito: boolean) => {
    setLocalAceito(aceito);
    onUpdate(item.item_key, aceito, aceito ? undefined : obs);
  };

  const handleFotoUpload = (file: File) => {
    onUpdate(item.item_key, localAceito ?? true, obs || undefined, file);
  };

  const handleObsSave = () => {
    if (localAceito === null) return;
    onUpdate(item.item_key, localAceito, obs || undefined);
  };

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden transition-all ${
        localAceito === true
          ? "border-emerald-200"
          : localAceito === false
            ? "border-red-200"
            : "border-[var(--border)]"
      }`}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {item.item_label}
        </span>
        <div className="flex items-center gap-1.5">
          {uploading && <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />}
          {localAceito === true && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              OK
            </span>
          )}
          {localAceito === false && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Não aceito
            </span>
          )}
          {localAceito === null && !item.foto_path && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Pendente
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusChange(true)}
            disabled={uploading}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
              localAceito === true
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-[var(--foreground)] border-[var(--border)] hover:border-emerald-400 hover:bg-emerald-50"
            } disabled:opacity-40`}
          >
            <Check className="w-4 h-4" />
            OK
          </button>
          <button
            onClick={() => handleStatusChange(false)}
            disabled={uploading}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
              localAceito === false
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-[var(--foreground)] border-[var(--border)] hover:border-red-400 hover:bg-red-50"
            } disabled:opacity-40`}
          >
            <X className="w-4 h-4" />
            Não aceito
          </button>
        </div>

        {localAceito === false && (
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={handleObsSave}
            placeholder="Observações do item não aceito..."
            rows={2}
            className="w-full text-sm border border-[var(--border)] rounded-lg p-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
          />
        )}

        {item.foto_url ? (
          <div className="relative">
            <img
              src={item.foto_url}
              alt={item.item_label}
              className="w-full h-40 object-cover rounded-lg border border-[var(--border)]"
            />
            <label className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium px-2 py-1 rounded-lg cursor-pointer hover:bg-black/80 flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Trocar
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFotoUpload(file);
                }}
              />
            </label>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg transition-colors ${
              uploading
                ? "border-gray-200 opacity-40 pointer-events-none"
                : "border-[var(--border)] cursor-pointer hover:border-gray-400"
            }`}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-[var(--muted-foreground)] mb-1" />
                <span className="text-xs text-[var(--muted-foreground)]">Tirar foto</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFotoUpload(file);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DIALOG — PARECER FINAL DO CLIENTE
// ═══════════════════════════════════════════════════════════════

function ParecerDialog({
  open,
  vistoriaId,
  itensNaoAceitos,
  onClose,
  onFinalizado,
}: {
  open: boolean;
  vistoriaId: string;
  itensNaoAceitos: number;
  onClose: () => void;
  onFinalizado: () => void;
}) {
  const [parecer, setParecer] = useState<"apto" | "nao_apto" | null>(null);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setParecer(null);
      setObs("");
      setErr(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!parecer) return;
    setSaving(true);
    setErr(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoriaId}/finalizar`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({
          parecer_cliente: parecer,
          observacoes_gerais: obs.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      onFinalizado();
    } catch (e: any) {
      setErr(e.message || "Erro ao registrar parecer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="fixed inset-x-0 bottom-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md w-full bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                Parecer do Cliente
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background-alt)]">
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                O cliente está apto a receber o imóvel neste momento?
              </p>

              {itensNaoAceitos > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <CircleAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    {itensNaoAceitos} item(ns) marcado(s) como não aceito. Avalie com o cliente se ele deseja receber mesmo assim.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <ParecerOption
                  active={parecer === "apto"}
                  onClick={() => setParecer("apto")}
                  icon={<CheckCircle2 className="w-5 h-5" />}
                  title="Apto para receber"
                  subtitle="Cliente aceitou receber o imóvel. Habilita a assinatura do termo."
                  colorActive="bg-emerald-600 border-emerald-600 text-white"
                  colorIdle="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                />
                <ParecerOption
                  active={parecer === "nao_apto"}
                  onClick={() => setParecer("nao_apto")}
                  icon={<XCircle className="w-5 h-5" />}
                  title="Não apto"
                  subtitle="Cliente optou por não receber. O termo ficará bloqueado para assinatura."
                  colorActive="bg-red-600 border-red-600 text-white"
                  colorIdle="text-red-700 border-red-200 bg-red-50 hover:bg-red-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                  Observações gerais (opcional)
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={3}
                  placeholder="Anote aqui qualquer observação relevante..."
                  className="w-full text-sm border border-[var(--border)] rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                />
              </div>

              {err && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                  {err}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!parecer || saving}
                className="w-full py-3 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {saving ? "Registrando..." : "Registrar parecer"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ParecerOption({
  active,
  onClick,
  icon,
  title,
  subtitle,
  colorActive,
  colorIdle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  colorActive: string;
  colorIdle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
        active ? colorActive : colorIdle
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className={`text-xs mt-0.5 ${active ? "text-white/80" : "opacity-80"}`}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 3 — RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════

function StepResultado({
  vistoria,
  cliente,
  slot,
  itens,
  engenheiroNome,
}: {
  vistoria: VistoriaData;
  cliente: ClienteData;
  slot: SlotData;
  itens: ItemVistoria[];
  engenheiroNome?: string;
}) {
  const aceitos = itens.filter((i) => i.aceito === true).length;
  const naoAceitos = itens.filter((i) => i.aceito === false).length;
  const apto = vistoria.parecer_cliente === "apto";
  const assinado = vistoria.status === "termo_assinado";

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div
        className={`rounded-2xl border p-5 ${
          apto
            ? "bg-emerald-50 border-emerald-200"
            : "bg-red-50 border-red-200"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              apto ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {apto ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              <XCircle className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-base font-semibold ${apto ? "text-emerald-900" : "text-red-900"}`}>
              {apto ? "Cliente apto para receber" : "Cliente não apto"}
            </h2>
            <p className={`text-sm mt-1 ${apto ? "text-emerald-800" : "text-red-800"}`}>
              {apto
                ? assinado
                  ? "Termo de entrega assinado e registrado."
                  : "Peça para o cliente escanear o mesmo QR Code para assinar o termo."
                : "A assinatura do termo está bloqueada para esta vistoria."}
            </p>
          </div>
        </div>
      </div>

      {/* Status da assinatura */}
      {apto && (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-[var(--muted-foreground)]" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Assinatura do termo
            </h3>
          </div>
          {assinado ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              Assinado em {vistoria.termo_assinado_em ? new Date(vistoria.termo_assinado_em).toLocaleString("pt-BR") : "—"}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Clock className="w-4 h-4" />
                Aguardando cliente assinar via QR Code.
              </div>
              {slot.checkin_token && (
                <div className="bg-[var(--background-alt)] rounded-lg p-3 border border-[var(--border)]">
                  <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
                    Link de assinatura
                  </p>
                  <p className="text-xs text-[var(--foreground)] break-all font-mono">
                    /assinar/{slot.checkin_token}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resumo */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Resumo da vistoria</h3>
        <div className="grid grid-cols-2 gap-3">
          <ResumoCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="Itens OK" value={String(aceitos)} />
          <ResumoCard icon={<XCircle className="w-4 h-4 text-red-600" />} label="Não aceitos" value={String(naoAceitos)} />
          <ResumoCard
            icon={<User className="w-4 h-4 text-[var(--muted-foreground)]" />}
            label="Recebido por"
            value={vistoria.tipo_representante === "terceiro" ? "Terceiro" : "Cliente"}
            full
          />
          {vistoria.finalizada_em && (
            <ResumoCard
              icon={<Clock className="w-4 h-4 text-[var(--muted-foreground)]" />}
              label="Finalizada em"
              value={new Date(vistoria.finalizada_em).toLocaleString("pt-BR")}
              full
            />
          )}
          {engenheiroNome && (
            <ResumoCard
              icon={<KeyRound className="w-4 h-4 text-[var(--muted-foreground)]" />}
              label="Engenheiro"
              value={engenheiroNome}
              full
            />
          )}
        </div>

        {vistoria.observacoes_gerais && (
          <div className="pt-3 border-t border-[var(--border)]">
            <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
              Observações gerais
            </p>
            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
              {vistoria.observacoes_gerais}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResumoCard({
  icon,
  label,
  value,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={`bg-[var(--background-alt)] rounded-lg p-3 border border-[var(--border)] ${full ? "col-span-2" : ""}`}>
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
