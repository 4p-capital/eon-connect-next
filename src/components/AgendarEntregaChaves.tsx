"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { QRCodeDots } from "@/components/QRCodeDots";
import { Calendar } from "@/components/ui/calendar";
import { projectId, publicAnonKey } from "@/utils/supabase/info";
import { getSupabaseClient } from "@/utils/supabase/client";

// ═══════════════════════════════════════════════════════════════════
// Tela pública /agendar — fluxo de agendamento de entrega de chaves
// ═══════════════════════════════════════════════════════════════════
// Etapas:
//   cpf       → digita CPF
//   pendencia → cliente tem pendência (AGEHAB/PRO-SOLUTO/JUROS-OBRA)
//   calendar  → escolhe dia
//   horario   → escolhe horário do dia
//   ticket    → confirmação (ou cliente já tinha reserva ativa)
// ═══════════════════════════════════════════════════════════════════

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

type Etapa = "cpf" | "pendencia" | "calendar" | "horario" | "ticket";

type Cliente = {
  id: string;
  nome: string | null;
  bloco: string | null;
  unidade: string | null;
  telefone: string | null;
  email: string | null;
};

type Pendencias = {
  agehab: boolean;
  pro_soluto: boolean;
  juros_obra: boolean;
};

type ReservaAtiva = {
  slot_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  reservado_em: string;
  checkin_token?: string | null;
};

type HorarioSlot = {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  ocupado: boolean;
};

type DiaDisponivel = {
  data: string;
  vagas: number;
  total: number;
  lotado: boolean;
  horarios: HorarioSlot[];
};

function maskCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
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

// ISO YYYY-MM-DD ⇄ Date local (sem TZ shift)
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

export function AgendarEntregaChaves() {
  const [etapa, setEtapa] = useState<Etapa>("cpf");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pendencias, setPendencias] = useState<Pendencias | null>(null);
  const [reserva, setReserva] = useState<ReservaAtiva | null>(null);

  const [dias, setDias] = useState<DiaDisponivel[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState<DiaDisponivel | null>(null);
  const [slotProvisorio, setSlotProvisorio] = useState<ReservaAtiva | null>(null);

  const cpfDigits = useMemo(() => cpf.replace(/\D/g, ""), [cpf]);
  const cpfValido = cpfDigits.length === 11;

  const diasMap = useMemo(() => {
    const m = new Map<string, DiaDisponivel>();
    for (const d of dias) m.set(d.data, d);
    return m;
  }, [dias]);

  const diasLotados = useMemo(
    () => dias.filter((d) => d.lotado).map((d) => isoParaDate(d.data)),
    [dias],
  );

  const primeiroDia = dias[0]?.data ?? null;
  const ultimoDia = dias[dias.length - 1]?.data ?? null;

  // Mantém diaSelecionado sincronizado com a lista atualizada de dias
  useEffect(() => {
    if (!diaSelecionado) return;
    const atualizado = dias.find((d) => d.data === diaSelecionado.data);
    if (atualizado && atualizado !== diaSelecionado) {
      setDiaSelecionado(atualizado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const carregarDisponibilidade = useCallback(async () => {
    const resp = await fetch(`${API_BASE}/entregas/disponibilidade`, {
      headers: { ...AUTH_HEADER },
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Erro ao buscar agenda");
    setDias(data.dias as DiaDisponivel[]);
  }, []);

  // Etapa 1 → validar CPF
  const handleValidarCpf = useCallback(async () => {
    if (!cpfValido) return;
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/validar-cpf`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits }),
      });
      const data = await resp.json();

      if (resp.status === 404) {
        setErro("CPF não encontrado nos registros do Gran Santorini. Confira o número digitado.");
        return;
      }
      if (resp.status === 400) {
        setErro("CPF inválido.");
        return;
      }
      if (!data) throw new Error("Resposta inválida");

      setCliente(data.cliente as Cliente);
      setPendencias(data.pendencias as Pendencias);
      setReserva(data.reserva_ativa ?? null);

      if (data.tem_pendencia) {
        setEtapa("pendencia");
        return;
      }
      if (data.reserva_ativa) {
        setEtapa("ticket");
        return;
      }

      await carregarDisponibilidade();
      setEtapa("calendar");
    } catch (err) {
      console.error(err);
      setErro("Erro ao validar CPF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [cpfDigits, cpfValido, carregarDisponibilidade]);

  // Selecionar horário → reserva atomicamente no banco e mantém em modo "provisório"
  const handleSelecionarHorario = useCallback(
    async (slotId: string) => {
      setLoading(true);
      setErro(null);
      try {
        const resp = await fetch(`${API_BASE}/entregas/reservar`, {
          method: "POST",
          headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: cpfDigits, slot_id: slotId }),
        });
        const data = await resp.json();
        if (!data.ok) {
          if (data.code === "SLOT_INDISPONIVEL" || data.code === "SLOT_BLOQUEADO") {
            setErro("Esse horário acabou de ser reservado por outra pessoa.");
            await carregarDisponibilidade();
            return;
          }
          if (data.code === "JA_RESERVADO") {
            setErro("Você já tem uma reserva ativa.");
            return;
          }
          if (data.code === "GATE_BLOQUEADO") {
            setEtapa("pendencia");
            return;
          }
          throw new Error(data.error || "Erro ao reservar");
        }
        setSlotProvisorio({
          slot_id: data.reserva.slot_id,
          data: data.reserva.data,
          hora_inicio: data.reserva.hora_inicio,
          hora_fim: data.reserva.hora_fim,
          reservado_em: data.reserva.reservado_em,
        });
        // Recarrega disponibilidade pra refletir o lock + mudanças de outros clientes
        await carregarDisponibilidade();
      } catch (err) {
        console.error(err);
        setErro("Erro ao reservar horário. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [cpfDigits, carregarDisponibilidade],
  );

  // Confirma a reserva provisória → gera checkin_token no banco → vai pro ticket
  const handleConfirmarHorario = useCallback(async () => {
    if (!slotProvisorio) return;
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/confirmar`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Erro ao confirmar");
      setReserva({
        ...slotProvisorio,
        checkin_token: data.checkin_token,
      });
      setSlotProvisorio(null);
      setEtapa("ticket");
    } catch (err) {
      console.error(err);
      setErro("Erro ao confirmar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [slotProvisorio, cpfDigits]);

  // Cancela a reserva provisória (libera no banco) e volta a habilitar os horários
  const handleCancelarProvisorio = useCallback(async () => {
    if (!slotProvisorio) return;
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/cancelar`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Erro ao liberar horário");
      setSlotProvisorio(null);
      await carregarDisponibilidade();
    } catch (err) {
      console.error(err);
      setErro("Erro ao liberar horário.");
    } finally {
      setLoading(false);
    }
  }, [cpfDigits, slotProvisorio, carregarDisponibilidade]);

  // Cancelar reserva
  const handleCancelar = useCallback(async () => {
    if (!confirm("Tem certeza que deseja cancelar seu agendamento?")) return;
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`${API_BASE}/entregas/cancelar`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Erro ao cancelar");
      setReserva(null);
      await carregarDisponibilidade();
      setEtapa("calendar");
    } catch (err) {
      console.error(err);
      setErro("Erro ao cancelar reserva.");
    } finally {
      setLoading(false);
    }
  }, [cpfDigits, carregarDisponibilidade]);

  // Voltar para escolher um novo horário (remarcar)
  const handleRemarcarVoltar = useCallback(async () => {
    setLoading(true);
    try {
      await carregarDisponibilidade();
      setEtapa("calendar");
    } finally {
      setLoading(false);
    }
  }, [carregarDisponibilidade]);

  // Reset total
  const handleVoltarInicio = useCallback(() => {
    setEtapa("cpf");
    setCpf("");
    setCliente(null);
    setPendencias(null);
    setReserva(null);
    setDias([]);
    setDiaSelecionado(null);
    setErro(null);
  }, []);

  // ───────────────────────────────────────────────────────────────
  // Realtime: escuta mudanças na tabela entrega_slot para atualizar
  // a disponibilidade em tempo real enquanto o cliente escolhe horário
  // ───────────────────────────────────────────────────────────────
  const carregarRef = useRef(carregarDisponibilidade);
  carregarRef.current = carregarDisponibilidade;

  useEffect(() => {
    if (etapa !== "calendar" && etapa !== "horario") return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("entrega_slot_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "entrega_slot" },
        () => {
          carregarRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [etapa]);

  return (
    <div className="min-h-screen bg-[var(--background-alt)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--border)]">
        <div className="max-w-[580px] mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--foreground)]">
              Agendamento de Entrega de Chaves
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Gran Santorini
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-[580px] mx-auto px-4 py-6">
        {/* Erro global */}
        {erro && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {/* ETAPA 1 — CPF */}
        {etapa === "cpf" && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">
              Informe seu CPF
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Vamos verificar se você já pode agendar a entrega das suas chaves.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && cpfValido && !loading) {
                  handleValidarCpf();
                }
              }}
            />
            <button
              onClick={handleValidarCpf}
              disabled={!cpfValido || loading}
              className="mt-4 w-full py-3 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Continuar"
              )}
            </button>
          </div>
        )}

        {/* ETAPA 2 — PENDÊNCIA */}
        {etapa === "pendencia" && pendencias && (
          <div className="bg-white rounded-2xl border border-amber-200 p-6">
            <div className="flex gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  Pendências identificadas
                </h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Para agendar a entrega das chaves, você precisa primeiro
                  resolver os itens abaixo com a equipe BP.
                </p>
              </div>
            </div>

            <ul className="space-y-2 mb-5">
              {pendencias.agehab && (
                <li className="flex items-center gap-2 text-sm text-[var(--foreground)] p-3 bg-amber-50 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  Pendência junto à <strong>AGEHAB</strong>
                </li>
              )}
              {pendencias.pro_soluto && (
                <li className="flex items-center gap-2 text-sm text-[var(--foreground)] p-3 bg-amber-50 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  Pendência de <strong>Pró-Soluto</strong>
                </li>
              )}
              {pendencias.juros_obra && (
                <li className="flex items-center gap-2 text-sm text-[var(--foreground)] p-3 bg-amber-50 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  Pendência de <strong>Juros de Obra</strong>
                </li>
              )}
            </ul>

            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Assim que essas pendências forem resolvidas, você poderá retornar
              aqui e fazer o agendamento.
            </p>

            <button
              onClick={handleVoltarInicio}
              className="w-full py-3 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--background-alt)] transition-all"
            >
              Voltar
            </button>
          </div>
        )}

        {/* ETAPA 3 — CALENDÁRIO */}
        {etapa === "calendar" && (
          <div className="space-y-4">
            {cliente && (
              <div className="bg-white rounded-2xl border border-[var(--border)] p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                    Olá, {cliente.nome}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Bloco {cliente.bloco} · Apto {cliente.unidade}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
              <h2 className="text-base font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Escolha um dia
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Agendamentos disponíveis a partir de 7 dias.
              </p>

              {dias.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">
                  Nenhum horário disponível no momento.
                </p>
              ) : (
                <>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={diaSelecionado ? isoParaDate(diaSelecionado.data) : undefined}
                      onSelect={(date) => {
                        if (!date) return;
                        const iso = dateParaIso(date);
                        const dia = diasMap.get(iso);
                        if (!dia || dia.lotado) return;
                        setDiaSelecionado(dia);
                        setEtapa("horario");
                      }}
                      startMonth={primeiroDia ? isoParaDate(primeiroDia) : undefined}
                      endMonth={ultimoDia ? isoParaDate(ultimoDia) : undefined}
                      disabled={(date) => {
                        const iso = dateParaIso(date);
                        const dia = diasMap.get(iso);
                        return !dia || dia.lotado;
                      }}
                      modifiers={{ lotado: diasLotados }}
                      modifiersClassNames={{
                        lotado: "line-through text-red-500 opacity-70",
                      }}
                      formatters={{
                        formatCaption: (date) =>
                          date.toLocaleDateString("pt-BR", {
                            month: "long",
                            year: "numeric",
                          }),
                        formatWeekdayName: (date) =>
                          date
                            .toLocaleDateString("pt-BR", { weekday: "short" })
                            .replace(".", ""),
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-black/5 border border-[var(--border)]" />
                      Disponível
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                      Lotado
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-[var(--background-alt)] border border-dashed border-[var(--border)]" />
                      Indisponível
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 4 — HORÁRIO */}
        {etapa === "horario" && diaSelecionado && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
            <button
              onClick={async () => {
                if (slotProvisorio) {
                  await handleCancelarProvisorio();
                }
                setDiaSelecionado(null);
                setEtapa("calendar");
              }}
              disabled={loading}
              className="text-sm text-[var(--muted-foreground)] flex items-center gap-1 mb-4 hover:text-[var(--foreground)] disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>

            <h2 className="text-base font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Escolha um horário
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-4 capitalize">
              {formatarDataExtenso(diaSelecionado.data)}
            </p>

            {(() => {
              const horarios = diaSelecionado.horarios;
              const manha = horarios.filter(
                (h) => parseInt(h.hora_inicio.slice(0, 2), 10) < 13,
              );
              const tarde = horarios.filter(
                (h) => parseInt(h.hora_inicio.slice(0, 2), 10) >= 13,
              );

              const renderBotao = (h: HorarioSlot) => {
                const isMeu = slotProvisorio?.slot_id === h.id;
                const desabilitado = loading || h.ocupado || (!!slotProvisorio && !isMeu);

                let cls =
                  "p-3 rounded-xl border text-sm font-medium transition-all";
                if (isMeu) {
                  cls +=
                    " border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200";
                } else if (h.ocupado || (slotProvisorio && !isMeu)) {
                  cls +=
                    " border-dashed border-[var(--border)] bg-[var(--background-alt)] text-[var(--muted-foreground)] line-through cursor-not-allowed";
                } else {
                  cls +=
                    " border-[var(--border)] hover:border-black hover:bg-[var(--background-alt)]";
                }

                return (
                  <button
                    key={h.id}
                    onClick={() =>
                      !desabilitado && !isMeu && handleSelecionarHorario(h.id)
                    }
                    disabled={desabilitado}
                    className={cls}
                  >
                    {formatarHora(h.hora_inicio)} – {formatarHora(h.hora_fim)}
                    {isMeu && (
                      <span className="block text-[10px] font-normal mt-0.5 not-italic">
                        selecionado
                      </span>
                    )}
                    {!isMeu && h.ocupado && (
                      <span className="block text-[10px] font-normal mt-0.5">
                        ocupado
                      </span>
                    )}
                  </button>
                );
              };

              return (
                <div className="space-y-5">
                  {manha.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                        Manhã
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {manha.map(renderBotao)}
                      </div>
                    </div>
                  )}
                  {tarde.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                        Tarde
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {tarde.map(renderBotao)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Botões Confirmar / Cancelar */}
            <div className="grid grid-cols-2 gap-2 mt-6 pt-5 border-t border-[var(--border)]">
              <button
                onClick={handleCancelarProvisorio}
                disabled={!slotProvisorio || loading}
                className="py-3 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--background-alt)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarHorario}
                disabled={!slotProvisorio || loading}
                className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Confirmar
              </button>
            </div>

            {loading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </div>
            )}
          </div>
        )}

        {/* ETAPA 5 — TICKET (estilo boarding pass) */}
        {etapa === "ticket" && reserva && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
              {/* Header do ticket */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[var(--foreground)]">
                      Agendamento confirmado!
                    </h2>
                  </div>
                </div>
                <p className="text-base text-[var(--foreground)] mb-1">
                  {cliente?.nome?.split(" ")[0] ?? "Futuro morador"}, suas chaves
                  estão te esperando! 🏠🔑🎉
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Estamos preparando tudo com carinho para esse grande momento.
                </p>
              </div>

              {/* Serrilhado divisor */}
              <div className="relative h-6 flex items-center">
                <div className="absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full bg-[var(--background-alt)]" />
                <div className="w-full border-t-2 border-dashed border-[var(--border)]" />
                <div className="absolute right-0 translate-x-1/2 w-6 h-6 rounded-full bg-[var(--background-alt)]" />
              </div>

              {/* Grid: Dados à esquerda + QR Code à direita */}
              <div className="px-6 pt-2 pb-5">
                <div className="flex gap-5 items-center">
                  {/* Coluna esquerda — dados */}
                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                        Data
                      </p>
                      <p className="text-sm font-semibold text-[var(--foreground)] capitalize">
                        {formatarDataExtenso(reserva.data)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                        Horário
                      </p>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {formatarHora(reserva.hora_inicio)} – {formatarHora(reserva.hora_fim)}
                      </p>
                    </div>
                    {cliente && (
                      <div>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                          Unidade
                        </p>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Bloco {cliente.bloco} · Apto {cliente.unidade}
                        </p>
                      </div>
                    )}
                    {cliente && (
                      <div>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                          Cliente
                        </p>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {cliente.nome}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Coluna direita — QR Code */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    {reserva.checkin_token ? (
                      <>
                        <div className="p-3 bg-white rounded-2xl border border-[var(--border)] shadow-sm">
                          <QRCodeDots
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${reserva.checkin_token}`}
                            size={180}
                            level="H"
                            logoSvg={`<path d="M0 8.3415C0.0814095 8.28552 0.162819 8.25752 0.244228 8.20154C1.87242 6.9979 3.47347 5.79426 5.10166 4.59062C5.18307 4.53464 5.26448 4.47866 5.31875 4.42267C5.37303 4.59062 5.37303 35.2974 5.31875 35.5773C5.23734 35.5213 5.18307 35.4934 5.1288 35.4374C3.55488 34.2617 1.95383 33.0861 0.379911 31.9104C0.298501 31.8544 0.217092 31.7705 0.135682 31.6865C0.0814095 31.6585 0.054273 31.6305 0 31.6025C0 23.8488 0 16.0672 0 8.31351V8.3415Z" fill="#322D67"/><path d="M13.1883 40V0C13.2969 0.0559832 13.3783 0.111966 13.4597 0.16795C14.7351 1.09167 15.9834 2.04339 17.2588 2.96711C17.503 3.13506 17.7201 3.331 17.9644 3.47096C18.2086 3.61092 18.29 3.83485 18.2629 4.08677C18.2629 5.12246 18.2629 6.15815 18.2629 7.22183C18.2629 10.2449 18.2629 13.268 18.2629 16.2911C18.2629 22.7292 18.2629 29.1393 18.2629 35.5773C18.2629 35.6613 18.2629 35.7453 18.2629 35.8293C18.29 36.1092 18.1814 36.3051 17.9644 36.4451C16.5261 37.5088 15.0608 38.5724 13.6225 39.6361C13.4868 39.7201 13.3783 39.8321 13.2155 39.972L13.1883 40Z" fill="#322D67"/><path d="M11.7501 0V40C11.6144 39.888 11.5059 39.7761 11.3702 39.6921C9.98623 38.6564 8.57513 37.6207 7.19117 36.613C7.10976 36.557 7.02835 36.501 6.97408 36.4451C6.78412 36.3051 6.70271 36.1092 6.70271 35.8852C6.70271 35.8013 6.70271 35.7453 6.70271 35.6613C6.70271 27.3478 6.70271 19.0623 6.70271 10.7488C6.70271 8.56543 6.70271 6.41008 6.70271 4.22673C6.70271 3.89083 6.81126 3.63891 7.08262 3.44297C8.54799 2.37929 9.98623 1.31561 11.4516 0.223933C11.5601 0.139958 11.6687 0.0839748 11.7772 0H11.7501Z" fill="#322D67"/><path d="M19.8639 4.39468C19.9453 4.45067 19.9996 4.47866 20.0539 4.53464C21.7092 5.76627 23.3374 6.96991 24.9927 8.20154C25.1284 8.28551 25.1555 8.39748 25.1555 8.53744C25.1555 16.1512 25.1555 23.7649 25.1555 31.3786C25.1555 31.5745 25.1013 31.7145 24.9384 31.8265C23.2831 33.0581 21.6549 34.2617 19.9996 35.4934C19.9725 35.5213 19.9182 35.5493 19.8911 35.5773H19.8639C19.8639 25.2484 19.8639 14.9475 19.8639 4.61861C19.8639 4.56263 19.8639 4.50665 19.8639 4.42267V4.39468Z" fill="#322D67"/>`}
                            logoScale={0.2}
                          />
                        </div>
                        <p className="text-[9px] text-[var(--muted-foreground)] text-center w-[180px]">
                          Apresente este QR Code no dia da entrega
                        </p>
                      </>
                    ) : (
                      <div className="w-[180px] h-[180px] rounded-2xl border border-dashed border-[var(--border)] flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Serrilhado divisor */}
              <div className="relative h-6 flex items-center">
                <div className="absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full bg-[var(--background-alt)]" />
                <div className="w-full border-t-2 border-dashed border-[var(--border)]" />
                <div className="absolute right-0 translate-x-1/2 w-6 h-6 rounded-full bg-[var(--background-alt)]" />
              </div>

              {/* Aviso + rodapé */}
              <div className="px-6 pb-6 space-y-3">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">
                    📋 Instruções para o recebimento
                  </p>
                  <div className="space-y-2">
                    <div className="flex gap-2 text-sm text-amber-900">
                      <span className="font-bold mt-px">1.</span>
                      <p>Leve um <strong>documento com foto</strong> (RG ou CNH) para receber seu apartamento.</p>
                    </div>
                    <div className="flex gap-2 text-sm text-amber-900">
                      <span className="font-bold mt-px">2.</span>
                      <p>Caso não possa comparecer pessoalmente, um representante pode receber em seu nome apresentando uma <strong>procuração emitida pelo proprietário</strong> e documento com foto.</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--muted-foreground)]">
                  No dia da entrega, compareça pessoalmente no Gran Santorini.
                  Você receberá um lembrete por WhatsApp em breve.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRemarcarVoltar}
                    disabled={loading}
                    className="py-3 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--background-alt)] transition-all disabled:opacity-50"
                  >
                    Remarcar
                  </button>
                  <button
                    onClick={handleCancelar}
                    disabled={loading}
                    className="py-3 rounded-xl border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleVoltarInicio}
              className="w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2"
            >
              Sair
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
