"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  Search,
  Loader2,
  Building2,
  X,
  Clock,
  Users,
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  CheckCircle2,
  Mail,
  FileText,
  AlertTriangle,
  Hash,
  ShoppingBag,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar } from "@/components/ui/calendar";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { getSupabaseClient } from "@/utils/supabase/client";

// ═══════════════════════════════════════════════════════════════════
// Tela admin — Acompanhamento de agendamentos de entrega de chaves
// Duas visualizações: Lista (agrupada por dia) e Calendário
// ═══════════════════════════════════════════════════════════════════

interface SlotComCliente {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  bloqueado: boolean;
  reserva_cliente_id: string | null;
  reservado_em: string | null;
  checkin_token: string | null;
  // join
  cliente_nome: string | null;
  cliente_bloco: string | null;
  cliente_unidade: string | null;
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_reserva: number | null;
  cliente_data_venda: string | null;
  cliente_pendencia_agehab: boolean;
  cliente_pendencia_prosoluto: boolean;
  cliente_pendencia_jurosobra: boolean;
}

interface DiaAgrupado {
  data: string;
  diaSemana: string;
  total: number;
  ocupados: number;
  slots: SlotComCliente[];
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

function formatarDataCurta(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatarHora(hora: string) {
  return hora.slice(0, 5);
}

function isoParaDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateParaIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Visualizacao = "lista" | "calendario";

export function EntregasSantoriniAgendamentos() {
  const { hasPermission, loading: permissionLoading } = usePermissionGuard(
    "entregas.santorini.agendamentos",
  );

  const [slots, setSlots] = useState<SlotComCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<Visualizacao>("lista");

  // Drawer de detalhes
  const [slotSelecionado, setSlotSelecionado] = useState<SlotComCliente | null>(null);

  // Calendário
  const [mesAtual, setMesAtual] = useState(new Date());
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>(undefined);

  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await (
        supabase.from("entrega_slot") as ReturnType<typeof supabase.from>
      )
        .select(
          `id, data, hora_inicio, hora_fim, bloqueado, reserva_cliente_id, reservado_em, checkin_token,
           clientes_entrega_santorini!entrega_slot_reserva_cliente_id_fkey (
             cliente, bloco, unidade, cpf_cnpj, telefone, email, reserva, data_venda,
             pendencia_agehab, pendencia_prosoluto, pendencia_jurosobra
           )`,
        )
        .eq("bloqueado", false)
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (error) throw error;

      const mapped: SlotComCliente[] = ((data as any[]) ?? []).map((s) => {
        const c = s.clientes_entrega_santorini;
        return {
          id: s.id,
          data: s.data,
          hora_inicio: s.hora_inicio,
          hora_fim: s.hora_fim,
          bloqueado: s.bloqueado,
          reserva_cliente_id: s.reserva_cliente_id,
          reservado_em: s.reservado_em,
          checkin_token: s.checkin_token,
          cliente_nome: c?.cliente ?? null,
          cliente_bloco: c?.bloco ?? null,
          cliente_unidade: c?.unidade ?? null,
          cliente_cpf: c?.cpf_cnpj ?? null,
          cliente_telefone: c?.telefone ?? null,
          cliente_email: c?.email ?? null,
          cliente_reserva: c?.reserva ?? null,
          cliente_data_venda: c?.data_venda ?? null,
          cliente_pendencia_agehab: c?.pendencia_agehab ?? false,
          cliente_pendencia_prosoluto: c?.pendencia_prosoluto ?? false,
          cliente_pendencia_jurosobra: c?.pendencia_jurosobra ?? false,
        };
      });

      setSlots(mapped);
    } catch (err) {
      console.error("Erro ao buscar slots:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission) return;
    fetchSlots();
  }, [hasPermission, fetchSlots]);

  // Realtime: atualiza automaticamente quando alguém reserva/cancela um slot
  const fetchSlotsRef = useRef(fetchSlots);
  fetchSlotsRef.current = fetchSlots;

  useEffect(() => {
    if (!hasPermission) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("admin_entrega_slot_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "entrega_slot" },
        () => {
          fetchSlotsRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasPermission]);

  // Agrupar por dia
  const diasAgrupados = useMemo(() => {
    const mapa = new Map<string, SlotComCliente[]>();
    for (const s of slots) {
      if (!mapa.has(s.data)) mapa.set(s.data, []);
      mapa.get(s.data)!.push(s);
    }
    const result: DiaAgrupado[] = [];
    for (const [data, slotsArr] of mapa) {
      const d = new Date(data + "T12:00:00");
      result.push({
        data,
        diaSemana: d.toLocaleDateString("pt-BR", { weekday: "long" }),
        total: slotsArr.length,
        ocupados: slotsArr.filter((s) => s.reserva_cliente_id).length,
        slots: slotsArr,
      });
    }
    return result;
  }, [slots]);

  // Filtro de busca (por nome, cpf, bloco, unidade)
  const diasFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return diasAgrupados;
    return diasAgrupados
      .map((dia) => ({
        ...dia,
        slots: dia.slots.filter((s) => {
          if (!s.reserva_cliente_id) return false;
          return [s.cliente_nome, s.cliente_cpf, s.cliente_bloco, s.cliente_unidade]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term);
        }),
      }))
      .filter((dia) => dia.slots.length > 0);
  }, [diasAgrupados, search]);

  // Métricas
  const stats = useMemo(() => {
    const reservados = slots.filter((s) => s.reserva_cliente_id);
    const confirmados = reservados.filter((s) => s.checkin_token);
    return {
      totalSlots: slots.length,
      reservados: reservados.length,
      confirmados: confirmados.length,
      livres: slots.length - reservados.length,
    };
  }, [slots]);

  // Dados do calendário
  const diasComReserva = useMemo(() => {
    const m = new Map<string, { reservados: number; total: number }>();
    for (const s of slots) {
      if (!m.has(s.data)) m.set(s.data, { reservados: 0, total: 0 });
      const entry = m.get(s.data)!;
      entry.total += 1;
      if (s.reserva_cliente_id) entry.reservados += 1;
    }
    return m;
  }, [slots]);

  const datasComAgendamento = useMemo(
    () =>
      Array.from(diasComReserva.entries())
        .filter(([, v]) => v.reservados > 0)
        .map(([k]) => isoParaDate(k)),
    [diasComReserva],
  );

  const datasLotadas = useMemo(
    () =>
      Array.from(diasComReserva.entries())
        .filter(([, v]) => v.reservados === v.total)
        .map(([k]) => isoParaDate(k)),
    [diasComReserva],
  );

  // Slots do dia selecionado no calendário
  const slotsDoDia = useMemo(() => {
    if (!dataSelecionada) return [];
    const iso = dateParaIso(dataSelecionada);
    return slots.filter((s) => s.data === iso);
  }, [dataSelecionada, slots]);

  const proximoMes = () => {
    const n = new Date(mesAtual);
    n.setMonth(n.getMonth() + 1);
    setMesAtual(n);
  };
  const mesAnterior = () => {
    const n = new Date(mesAtual);
    n.setMonth(n.getMonth() - 1);
    setMesAtual(n);
  };

  if (permissionLoading || !hasPermission) {
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">
                  Agendamentos — Gran Santorini
                </h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {loading ? "Carregando..." : `${stats.reservados} agendamento${stats.reservados !== 1 ? "s" : ""} confirmado${stats.reservados !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {/* Toggle Vista */}
            <div className="flex items-center bg-[var(--background-alt)] rounded-xl border border-[var(--border)] p-1">
              <button
                onClick={() => setView("lista")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  view === "lista"
                    ? "bg-white shadow-sm text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <List className="w-4 h-4" />
                Lista
              </button>
              <button
                onClick={() => setView("calendario")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  view === "calendario"
                    ? "bg-white shadow-sm text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Calendário
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Total de vagas</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{stats.totalSlots}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Agendados</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{stats.reservados}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-medium text-violet-700">Confirmados</span>
              </div>
              <p className="text-xl font-bold text-violet-700">{stats.confirmados}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Vagas livres</span>
              </div>
              <p className="text-xl font-bold text-gray-700">{stats.livres}</p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Carregando agendamentos...</p>
          </div>
        ) : view === "lista" ? (
          <VistaLista
            dias={diasFiltrados}
            search={search}
            setSearch={setSearch}
            totalDias={diasAgrupados.length}
            onSlotClick={setSlotSelecionado}
          />
        ) : (
          <VistaCalendario
            mesAtual={mesAtual}
            setMesAtual={setMesAtual}
            dataSelecionada={dataSelecionada}
            setDataSelecionada={setDataSelecionada}
            datasComAgendamento={datasComAgendamento}
            datasLotadas={datasLotadas}
            diasComReserva={diasComReserva}
            slotsDoDia={slotsDoDia}
            proximoMes={proximoMes}
            mesAnterior={mesAnterior}
            onSlotClick={setSlotSelecionado}
          />
        )}
      </div>

      {/* Drawer de detalhes do agendamento */}
      <AgendamentoDrawer
        slot={slotSelecionado}
        onClose={() => setSlotSelecionado(null)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISTA LISTA — agrupada por dia
// ═══════════════════════════════════════════════════════════════

function VistaLista({
  dias,
  search,
  setSearch,
  totalDias,
  onSlotClick,
}: {
  dias: DiaAgrupado[];
  search: string;
  setSearch: (v: string) => void;
  totalDias: number;
  onSlotClick: (slot: SlotComCliente) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
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

      {dias.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CalendarCheck className="w-12 h-12 text-[var(--border)]" />
          <p className="text-sm text-[var(--muted-foreground)]">
            {search
              ? "Nenhum agendamento encontrado com os filtros aplicados"
              : "Nenhum agendamento registrado"}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-sm text-black underline hover:no-underline"
            >
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {dias.map((dia) => (
            <div key={dia.data}>
              {/* Header do dia */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] capitalize">
                    {formatarDataExtenso(dia.data)}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    {dia.ocupados}/{dia.total} agendados
                  </span>
                </div>
              </div>

              {/* Slots do dia */}
              <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
                {dia.slots.map((slot) => (
                  <SlotRow key={slot.id} slot={slot} onClick={onSlotClick} />
                ))}
              </div>
            </div>
          ))}

          <div className="text-[11px] text-[var(--muted-foreground)] text-right">
            Exibindo {dias.length} de {totalDias} dias
          </div>
        </div>
      )}
    </div>
  );
}

function SlotRow({ slot, onClick }: { slot: SlotComCliente; onClick: (slot: SlotComCliente) => void }) {
  const ocupado = !!slot.reserva_cliente_id;
  const confirmado = !!slot.checkin_token;

  return (
    <div
      onClick={ocupado ? () => onClick(slot) : undefined}
      className={`flex items-center gap-4 px-4 py-3 ${
        ocupado ? "cursor-pointer hover:bg-[var(--background-alt)] transition-colors" : "opacity-40"
      }`}
    >
      {/* Horário */}
      <div className="flex items-center gap-1.5 w-[110px] flex-shrink-0">
        <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        <span className="text-sm font-medium text-[var(--foreground)]">
          {formatarHora(slot.hora_inicio)} – {formatarHora(slot.hora_fim)}
        </span>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {ocupado ? (
          confirmado ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              Confirmado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3" />
              Pendente
            </span>
          )
        ) : (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Livre
          </span>
        )}
      </div>

      {/* Cliente */}
      {ocupado ? (
        <div className="flex-1 flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
            <span className="text-sm text-[var(--foreground)] truncate">
              {slot.cliente_nome || "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">
              Bl. {slot.cliente_bloco} · Ap. {slot.cliente_unidade}
            </span>
          </div>
          {slot.cliente_telefone && (
            <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
              <Phone className="w-3 h-3 text-[var(--muted-foreground)]" />
              <span className="text-xs text-[var(--muted-foreground)]">
                {slot.cliente_telefone}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1">
          <span className="text-xs text-[var(--muted-foreground)] italic">
            Horário disponível
          </span>
        </div>
      )}

      {ocupado && (
        <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISTA CALENDÁRIO — igual ao CalendarioAssistencia
// ═══════════════════════════════════════════════════════════════

function VistaCalendario({
  mesAtual,
  setMesAtual,
  dataSelecionada,
  setDataSelecionada,
  datasComAgendamento,
  datasLotadas,
  diasComReserva,
  slotsDoDia,
  proximoMes,
  mesAnterior,
  onSlotClick,
}: {
  mesAtual: Date;
  setMesAtual: (d: Date) => void;
  dataSelecionada: Date | undefined;
  setDataSelecionada: (d: Date | undefined) => void;
  datasComAgendamento: Date[];
  datasLotadas: Date[];
  diasComReserva: Map<string, { reservados: number; total: number }>;
  slotsDoDia: SlotComCliente[];
  proximoMes: () => void;
  mesAnterior: () => void;
  onSlotClick: (slot: SlotComCliente) => void;
}) {
  const slotsDoDiaReservados = slotsDoDia.filter((s) => s.reserva_cliente_id);
  const info = dataSelecionada
    ? diasComReserva.get(dateParaIso(dataSelecionada))
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
      {/* Calendário */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Calendário de Entregas
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={mesAnterior}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-alt)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm min-w-[140px] text-center capitalize">
              {mesAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={proximoMes}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-alt)] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <style>{`
            .cal-entregas { width: 100% !important; max-width: 100% !important; }
            .cal-entregas > div { width: 100% !important; }
            .cal-entregas .rdp { width: 100%; }
            .cal-entregas .rdp-months { width: 100%; }
            .cal-entregas .rdp-month { width: 100%; }
            .cal-entregas .rdp-caption { width: 100%; }
            .cal-entregas table { width: 100% !important; table-layout: fixed; }
            .cal-entregas thead th { padding: 0.75rem; width: 14.28%; }
            .cal-entregas tbody td { padding: 0.5rem; width: 14.28%; }
            .cal-entregas tbody button { width: 100%; }
            .cal-day-has-booking { position: relative; }
            .cal-day-has-booking::after {
              content: '';
              position: absolute;
              bottom: 2px;
              left: 50%;
              transform: translateX(-50%);
              width: 6px;
              height: 6px;
              background-color: #10b981;
              border-radius: 50%;
            }
            .cal-day-full::after {
              background-color: #f59e0b !important;
            }
          `}</style>
          <Calendar
            mode="single"
            selected={dataSelecionada}
            onSelect={setDataSelecionada}
            month={mesAtual}
            onMonthChange={setMesAtual}
            className="rounded-md border-0 cal-entregas w-full"
            modifiers={{
              hasBooking: datasComAgendamento,
              full: datasLotadas,
            }}
            modifiersClassNames={{
              hasBooking: "cal-day-has-booking",
              full: "cal-day-full",
            }}
          />
          <div className="mt-4 pt-4 border-t flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-[var(--muted-foreground)]">Com agendamentos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-[var(--muted-foreground)]">Lotado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalhes do dia selecionado */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {dataSelecionada
              ? formatarDataCurta(dateParaIso(dataSelecionada))
              : "Selecione uma data"}
          </h2>
          {info && (
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {info.reservados}/{info.total} vagas preenchidas
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!dataSelecionada ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
              <CalendarDays className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm">Clique em um dia para ver os agendamentos</p>
            </div>
          ) : slotsDoDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
              <CalendarCheck className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm">Nenhuma vaga neste dia</p>
            </div>
          ) : (
            <div className="space-y-2">
              {slotsDoDia.map((slot) => {
                const ocupado = !!slot.reserva_cliente_id;
                const confirmado = !!slot.checkin_token;

                return (
                  <div
                    key={slot.id}
                    onClick={ocupado ? () => onSlotClick(slot) : undefined}
                    className={`rounded-xl border p-3 ${
                      ocupado
                        ? confirmado
                          ? "border-emerald-200 bg-emerald-50/50 cursor-pointer hover:bg-emerald-50 transition-colors"
                          : "border-amber-200 bg-amber-50/50 cursor-pointer hover:bg-amber-50 transition-colors"
                        : "border-[var(--border)] bg-[var(--background-alt)]/50 opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {formatarHora(slot.hora_inicio)} – {formatarHora(slot.hora_fim)}
                      </span>
                      {ocupado ? (
                        confirmado ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Confirmado
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Pendente
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Livre
                        </span>
                      )}
                    </div>
                    {ocupado && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-[var(--foreground)] font-medium truncate">
                          {slot.cliente_nome}
                        </p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          Bl. {slot.cliente_bloco} · Ap. {slot.cliente_unidade}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {slotsDoDiaReservados.length > 0 && (
                <p className="text-[11px] text-[var(--muted-foreground)] text-center pt-2">
                  {slotsDoDiaReservados.length} agendamento{slotsDoDiaReservados.length !== 1 ? "s" : ""} neste dia
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DRAWER DE DETALHES DO AGENDAMENTO (somente leitura)
// Ações de recebimento/vistoria moveram para /entregas/santorini/recebimento
// ═══════════════════════════════════════════════════════════════

function AgendamentoDrawer({
  slot,
  onClose,
}: {
  slot: SlotComCliente | null;
  onClose: () => void;
}) {
  if (!slot) return null;

  const confirmado = !!slot.checkin_token;
  const temPendencia =
    slot.cliente_pendencia_agehab ||
    slot.cliente_pendencia_prosoluto ||
    slot.cliente_pendencia_jurosobra;

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 14) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }
    return cpf;
  };

  const formatDataVenda = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatReservadoEm = (ts: string) => {
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AnimatePresence>
      {slot && (
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
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                  <CalendarCheck className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--foreground)] truncate">
                    Detalhes do Agendamento
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatarDataExtenso(slot.data)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--background-alt)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Status + Horário */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    confirmado ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    <Clock className={`w-6 h-6 ${confirmado ? "text-emerald-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {formatarHora(slot.hora_inicio)} – {formatarHora(slot.hora_fim)}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Horário agendado
                    </p>
                  </div>
                </div>
                {confirmado ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-100 text-amber-700">
                    <Clock className="w-3.5 h-3.5" />
                    Pendente
                  </span>
                )}
              </div>

              {/* Dados do Cliente */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Dados do Cliente
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <DrawerInfoCard
                    icon={<User className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Nome"
                    value={slot.cliente_nome || "—"}
                    fullWidth
                  />
                  <DrawerInfoCard
                    icon={<FileText className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="CPF/CNPJ"
                    value={slot.cliente_cpf ? formatCpf(slot.cliente_cpf) : "—"}
                  />
                  <DrawerInfoCard
                    icon={<Phone className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Telefone"
                    value={slot.cliente_telefone || "—"}
                  />
                  {slot.cliente_email && (
                    <DrawerInfoCard
                      icon={<Mail className="w-4 h-4 text-[var(--muted-foreground)]" />}
                      label="E-mail"
                      value={slot.cliente_email}
                      fullWidth
                    />
                  )}
                </div>
              </div>

              {/* Dados da Unidade */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Unidade
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <DrawerInfoCard
                    icon={<Building2 className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Bloco"
                    value={slot.cliente_bloco || "—"}
                  />
                  <DrawerInfoCard
                    icon={<Building2 className="w-4 h-4 text-[var(--muted-foreground)]" />}
                    label="Apartamento"
                    value={slot.cliente_unidade || "—"}
                  />
                  {slot.cliente_reserva && (
                    <DrawerInfoCard
                      icon={<Hash className="w-4 h-4 text-[var(--muted-foreground)]" />}
                      label="Reserva"
                      value={String(slot.cliente_reserva)}
                    />
                  )}
                  {slot.cliente_data_venda && (
                    <DrawerInfoCard
                      icon={<ShoppingBag className="w-4 h-4 text-[var(--muted-foreground)]" />}
                      label="Data da Venda"
                      value={formatDataVenda(slot.cliente_data_venda)}
                    />
                  )}
                </div>
              </div>

              {/* Pendências */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Pendências
                </p>
                {temPendencia ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        Cliente com pendências
                      </span>
                    </div>
                    {slot.cliente_pendencia_agehab && (
                      <PendenciaItem label="AGEHAB" />
                    )}
                    {slot.cliente_pendencia_prosoluto && (
                      <PendenciaItem label="Pró-Soluto" />
                    )}
                    {slot.cliente_pendencia_jurosobra && (
                      <PendenciaItem label="Juros de Obra" />
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-800">
                        Nenhuma pendência registrada
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Info da Reserva */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Informações da Reserva
                </p>
                <div className="bg-[var(--background-alt)] rounded-xl border border-[var(--border)] p-4 space-y-3">
                  {slot.reservado_em && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted-foreground)]">Reservado em</span>
                      <span className="text-xs font-medium text-[var(--foreground)]">
                        {formatReservadoEm(slot.reservado_em)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">Check-in</span>
                    <span className={`text-xs font-medium ${confirmado ? "text-emerald-700" : "text-amber-700"}`}>
                      {confirmado ? "Confirmado" : "Aguardando confirmação"}
                    </span>
                  </div>
                  {slot.checkin_token && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted-foreground)]">Token</span>
                      <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                        {slot.checkin_token.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerInfoCard({
  icon,
  label,
  value,
  fullWidth,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`bg-[var(--background-alt)] rounded-lg p-3 border border-[var(--border)] ${fullWidth ? "col-span-2" : ""}`}>
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

function PendenciaItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pl-6">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      <span className="text-sm text-amber-800">{label}</span>
    </div>
  );
}

