"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { projectId, publicAnonKey } from "@/utils/supabase/info";
import { useRouter } from "next/navigation";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

interface VistoriaData {
  id: string;
  status: string;
  tipo_representante: string;
  docs_validados_em: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
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
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

interface ItemVistoria {
  id: string;
  item_key: string;
  item_label: string;
  aceito: boolean | null;
  observacao: string | null;
  foto_path: string | null;
  foto_url: string | null;
}

function formatarHora(hora: string) {
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

export function VistoriaEntrega({ vistoriaId }: { vistoriaId: string }) {
  const { hasPermission, loading: permLoading } = usePermissionGuard(
    "entregas.santorini.recebimento",
  );
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vistoria, setVistoria] = useState<VistoriaData | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [itens, setItens] = useState<ItemVistoria[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);

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
      setItens(data.itens);
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

  const handleItemUpdate = async (
    itemKey: string,
    aceito: boolean,
    observacao?: string,
    fotoFile?: File,
  ) => {
    setUploadingItem(itemKey);
    setErro(null);
    try {
      let fotoBase64: string | undefined;
      if (fotoFile) {
        fotoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fotoFile);
        });
      }

      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoriaId}/item`, {
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
      setErro(err.message || "Erro ao salvar item");
    } finally {
      setUploadingItem(null);
    }
  };

  const handleConcluir = async () => {
    setConcluindo(true);
    setErro(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/vistoria/${vistoriaId}/concluir`, {
        method: "POST",
        headers: AUTH_HEADER,
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setVistoria((prev) => (prev ? { ...prev, status: "concluida" } : prev));
    } catch (err: any) {
      setErro(err.message || "Erro ao concluir");
    } finally {
      setConcluindo(false);
    }
  };

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

  if (!vistoria || !cliente) {
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

  const concluida = vistoria.status === "concluida";
  const todosPreenchidos = itens.every((i) => i.aceito !== null && i.foto_path);
  const itensOk = itens.filter((i) => i.aceito === true).length;
  const itensNaoAceitos = itens.filter((i) => i.aceito === false).length;
  const itensPendentes = itens.filter((i) => i.aceito === null).length;

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-alt)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-[var(--foreground)]">
                Vistoria de Entrega
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                {cliente.nome} — Bl. {cliente.bloco} · Ap. {cliente.unidade}
              </p>
            </div>
            {concluida ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluída
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">
                <ClipboardCheck className="w-3.5 h-3.5" />
                Em andamento
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info do agendamento */}
      {slot?.data && (
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

      {/* Métricas */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
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
      </div>

      {/* Erro global */}
      {erro && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-700">{erro}</p>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-3">
        {itens.map((item) => (
          <ItemCard
            key={item.item_key}
            item={item}
            disabled={concluida}
            uploading={uploadingItem === item.item_key}
            onUpdate={handleItemUpdate}
          />
        ))}
      </div>

      {/* Botão concluir */}
      {!concluida && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
          <button
            onClick={handleConcluir}
            disabled={!todosPreenchidos || concluindo}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {concluindo ? "Finalizando..." : "Finalizar Vistoria"}
          </button>
          {!todosPreenchidos && (
            <p className="text-[11px] text-center text-[var(--muted-foreground)] mt-2">
              Preencha todos os itens com status e foto para finalizar
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD DE ITEM DO CHECKLIST
// ═══════════════════════════════════════════════════════════════

function ItemCard({
  item,
  disabled,
  uploading,
  onUpdate,
}: {
  item: ItemVistoria;
  disabled: boolean;
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
    if (disabled) return;
    setLocalAceito(aceito);
    onUpdate(item.item_key, aceito, aceito ? undefined : obs);
  };

  const handleFotoUpload = (file: File) => {
    if (disabled) return;
    onUpdate(item.item_key, localAceito ?? true, obs || undefined, file);
  };

  const handleObsSave = () => {
    if (disabled || localAceito === null) return;
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
      {/* Header do item */}
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

      {/* Conteúdo */}
      <div className="px-4 pb-4 space-y-3">
        {/* Botões OK / Não aceito */}
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusChange(true)}
            disabled={disabled || uploading}
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
            disabled={disabled || uploading}
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

        {/* Observação (quando não aceito) */}
        {localAceito === false && (
          <div className="space-y-1.5">
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onBlur={handleObsSave}
              placeholder="Observações do item não aceito..."
              disabled={disabled}
              rows={2}
              className="w-full text-sm border border-[var(--border)] rounded-lg p-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-red-200 resize-none disabled:opacity-50"
            />
          </div>
        )}

        {/* Foto */}
        {item.foto_url ? (
          <div className="relative">
            <img
              src={item.foto_url}
              alt={item.item_label}
              className="w-full h-40 object-cover rounded-lg border border-[var(--border)]"
            />
            {!disabled && (
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
            )}
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg transition-colors ${
              disabled || uploading
                ? "border-gray-200 opacity-40 pointer-events-none"
                : "border-[var(--border)] cursor-pointer hover:border-gray-400"
            }`}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-[var(--muted-foreground)] mb-1" />
                <span className="text-xs text-[var(--muted-foreground)]">Tirar foto ou enviar</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={disabled || uploading}
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
