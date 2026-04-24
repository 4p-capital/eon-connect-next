"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Bell, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getSupabaseClient } from "@/utils/supabase/client";

type LogRow = {
  id: string;
  batch_id: string | null;
  cliente_entrega_id: string;
  campanha: "agehab" | "financeiro";
  status: "success" | "failed";
  error_message: string | null;
  enviado_em: string;
  cliente_nome: string;
};

type DayGroup = {
  dayKey: string;
  dayLabel: string;
  total: number;
  success: number;
  failed: number;
  entries: LogRow[];
};

const TZ = "America/Sao_Paulo";

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function groupByDay(rows: LogRow[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const r of rows) {
    const key = dayKey(r.enviado_em);
    if (!map.has(key)) {
      map.set(key, {
        dayKey: key,
        dayLabel: dayLabel(r.enviado_em),
        total: 0,
        success: 0,
        failed: 0,
        entries: [],
      });
    }
    const g = map.get(key)!;
    g.entries.push(r);
    g.total++;
    if (r.status === "success") g.success++;
    else g.failed++;
  }
  for (const g of map.values()) {
    g.entries.sort((a, b) => (a.enviado_em < b.enviado_em ? 1 : -1));
  }
  return Array.from(map.values()).sort((a, b) =>
    a.dayKey < b.dayKey ? 1 : -1
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NotificacoesManyChatLogs() {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const supabase = getSupabaseClient();
        const { data, error: qErr } = await supabase
          .from("notificacoes_manychat_log")
          .select(`
            id,
            batch_id,
            cliente_entrega_id,
            campanha,
            status,
            error_message,
            enviado_em,
            clientes_entrega_santorini!inner ( cliente )
          `)
          .order("enviado_em", { ascending: false })
          .limit(1000);

        if (qErr) throw qErr;
        if (cancelled) return;

        const rows: LogRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          batch_id: r.batch_id as string | null,
          cliente_entrega_id: r.cliente_entrega_id as string,
          campanha: r.campanha as "agehab" | "financeiro",
          status: r.status as "success" | "failed",
          error_message: r.error_message as string | null,
          enviado_em: r.enviado_em as string,
          cliente_nome:
            (r.clientes_entrega_santorini as { cliente: string } | null)?.cliente ??
            "—",
        }));

        const grouped = groupByDay(rows);
        setDays(grouped);
        // Abre o dia mais recente por padrão
        if (grouped.length > 0) {
          setOpenDays(new Set([grouped[0].dayKey]));
        }
      } catch (e) {
        if (cancelled) return;
        console.error("Erro ao carregar logs ManyChat:", e);
        setError(e instanceof Error ? e.message : "Erro ao carregar logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (key: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-black mx-auto mb-3" />
        <p className="text-[#4B5563] text-sm">Carregando logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8 text-center">
        <AlertCircle className="h-10 w-10 text-[#EF4444] mx-auto mb-3" />
        <p className="text-[#991B1B]">{error}</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-12 text-center">
        <Bell className="h-10 w-10 text-[#9CA3AF] mx-auto mb-3" />
        <p className="text-[#4B5563]">Nenhum disparo registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const isOpen = openDays.has(day.dayKey);
        const sucessos = day.entries.filter((e) => e.status === "success");
        const falhas = day.entries.filter((e) => e.status === "failed");
        return (
          <Collapsible
            key={day.dayKey}
            open={isOpen}
            onOpenChange={() => toggle(day.dayKey)}
            className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden"
          >
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-[#4B5563] flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-[#4B5563] flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#1B1B1B] capitalize">
                    {day.dayLabel}
                  </div>
                  <div className="text-xs text-[#9CA3AF]">
                    {day.total} {day.total === 1 ? "disparo" : "disparos"} no dia
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {day.success > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#065F46]">
                    <CheckCircle2 className="h-3 w-3" />
                    {day.success}
                  </span>
                )}
                {day.failed > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#991B1B]">
                    <XCircle className="h-3 w-3" />
                    {day.failed}
                  </span>
                )}
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t border-[#E5E7EB]">
                {sucessos.length > 0 && (
                  <SubSection title="Sucessos" count={sucessos.length} variant="success" entries={sucessos} />
                )}
                {falhas.length > 0 && (
                  <SubSection title="Falhas" count={falhas.length} variant="failed" entries={falhas} />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function SubSection({
  title,
  count,
  variant,
  entries,
}: {
  title: string;
  count: number;
  variant: "success" | "failed";
  entries: LogRow[];
}) {
  const bg = variant === "success" ? "bg-[#ECFDF5]" : "bg-[#FEF2F2]";
  const text = variant === "success" ? "text-[#065F46]" : "text-[#991B1B]";
  const Icon = variant === "success" ? CheckCircle2 : XCircle;

  return (
    <div className="border-b border-[#E5E7EB] last:border-b-0">
      <div className={`flex items-center gap-2 px-6 py-2.5 ${bg}`}>
        <Icon className={`h-4 w-4 ${text}`} />
        <span className={`text-sm font-medium ${text}`}>
          {title} ({count})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F9FAFB]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                Horário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                Campanha
              </th>
              {variant === "failed" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Erro
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-[#F9FAFB] transition-colors">
                <td className="px-6 py-3 text-sm text-[#4B5563] whitespace-nowrap">
                  {formatTime(entry.enviado_em)}
                </td>
                <td className="px-6 py-3 text-sm text-[#1B1B1B]">
                  {entry.cliente_nome}
                </td>
                <td className="px-6 py-3 text-sm">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                      entry.campanha === "agehab"
                        ? "bg-[#EEF2FF] text-[#3730A3]"
                        : "bg-[#FFF7ED] text-[#9A3412]"
                    }`}
                  >
                    {entry.campanha === "agehab" ? "AGEHAB" : "Financeiro"}
                  </span>
                </td>
                {variant === "failed" && (
                  <td
                    className="px-6 py-3 text-sm text-[#991B1B] max-w-xs truncate"
                    title={entry.error_message ?? undefined}
                  >
                    {entry.error_message ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
