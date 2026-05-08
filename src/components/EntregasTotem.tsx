"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  KeyRound,
  Star,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Home,
  ArrowRight,
  RotateCcw,
  QrCode,
} from "lucide-react";
import { apiBaseUrl, publicAnonKey } from "@/utils/supabase/info";

const API_BASE = apiBaseUrl;
const AUTH_HEADER = { Authorization: `Bearer ${publicAnonKey}` };

type View = "scan" | "loading" | "resumo" | "pesquisa" | "finalizado" | "erro";

type Cliente = { nome: string; bloco: string; unidade: string };

type RespostaPesquisa = {
  qualidade_apartamento: string | null;
  qualidade_areas_comuns: string | null;
  item_apto_favorito: string | null;
  parte_apto_favorita: string | null;
  item_lazer_favorito: string | null;
  sugestao_melhoria: string;
  estrelas: number | null;
};

const RESPOSTA_INICIAL: RespostaPesquisa = {
  qualidade_apartamento: null,
  qualidade_areas_comuns: null,
  item_apto_favorito: null,
  parte_apto_favorita: null,
  item_lazer_favorito: null,
  sugestao_melhoria: "",
  estrelas: null,
};

const QUALIDADE_OPCOES: Array<{ value: string; label: string; emoji: string }> = [
  { value: "amei", label: "Perfeito, amei", emoji: "💙" },
  { value: "superou", label: "Superou as minhas expectativas", emoji: "✨" },
  { value: "dentro_esperado", label: "Está dentro do que eu esperava", emoji: "✅" },
  { value: "abaixo", label: "Fica um pouco abaixo do que eu esperava", emoji: "🤏" },
  { value: "deixa_desejar", label: "Deixa a desejar", emoji: "❌" },
];

const ITEM_APTO_OPCOES: Array<{ value: string; label: string }> = [
  { value: "area_servico_externa", label: "Área de Serviço Externa" },
  { value: "previsao_ar_quarto_sala", label: "Previsão de Ar-Condicionado no Quarto e na Sala" },
  { value: "tomada_usb_bancada", label: "Tomada USB na Bancada" },
  { value: "armario_planejado_banheiro", label: "Armário Planejado no Banheiro" },
  { value: "dois_pontos_tv_sala", label: "Dois Pontos de TV e Internet na Sala" },
  { value: "janelas_amplas_2m_sala", label: "Janelas Amplas de 2m na Sala" },
  { value: "piso_laminado_madeira_quartos", label: "Piso Laminado de Madeira nos Quartos" },
];

const PARTE_APTO_OPCOES: Array<{ value: string; label: string }> = [
  { value: "quartos", label: "Quartos" },
  { value: "banheiro", label: "Banheiro" },
  { value: "cozinha", label: "Cozinha" },
  { value: "sala", label: "Sala" },
  { value: "area_servico_externa", label: "Área de serviço externa" },
];

const ITEM_LAZER_OPCOES: Array<{ value: string; label: string }> = [
  { value: "guarita", label: "Guarita" },
  { value: "quadra_esporte", label: "Quadra de Esporte" },
  { value: "playground", label: "Playground" },
  { value: "espaco_gourmet", label: "Espaço Gourmet" },
  { value: "churrasqueira", label: "Churrasqueira" },
  { value: "piscinas", label: "Piscinas" },
  { value: "academia", label: "Academia" },
  { value: "pet_place", label: "Pet Place" },
  { value: "redario", label: "Redário" },
  { value: "car_wash", label: "Car Wash / Lava Carros" },
  { value: "carregamento_carro_eletrico", label: "Carregamento para Carro Elétrico" },
  { value: "horta_comunitaria", label: "Horta Comunitária" },
  { value: "bicicletarios_blocos", label: "Bicicletários nos Blocos" },
];

const ESTRELAS_LABELS: Record<number, string> = {
  1: "Péssimo",
  2: "Ruim",
  3: "Razoável",
  4: "Bom",
  5: "Excelente",
};

type PesquisaStep =
  | { field: "qualidade_apartamento"; titulo: string; tipo: "qualidade" }
  | { field: "qualidade_areas_comuns"; titulo: string; tipo: "qualidade" }
  | { field: "item_apto_favorito"; titulo: string; tipo: "item_apto" }
  | { field: "parte_apto_favorita"; titulo: string; tipo: "parte_apto" }
  | { field: "item_lazer_favorito"; titulo: string; tipo: "item_lazer" }
  | { field: "sugestao_melhoria"; titulo: string; tipo: "texto" }
  | { field: "estrelas"; titulo: string; tipo: "estrelas" };

const STEPS: PesquisaStep[] = [
  {
    field: "qualidade_apartamento",
    titulo: "Em geral, a qualidade do apartamento que você recebeu atendeu suas expectativas?",
    tipo: "qualidade",
  },
  {
    field: "qualidade_areas_comuns",
    titulo: "Em geral, a qualidade das áreas comuns do condomínio atendeu suas expectativas?",
    tipo: "qualidade",
  },
  {
    field: "item_apto_favorito",
    titulo: "Qual dos itens entregues no seu apartamento você mais gostou?",
    tipo: "item_apto",
  },
  {
    field: "parte_apto_favorita",
    titulo: "Qual parte do seu novo apartamento você mais gostou?",
    tipo: "parte_apto",
  },
  {
    field: "item_lazer_favorito",
    titulo: "Qual dos itens da Área de Lazer você mais gostou?",
    tipo: "item_lazer",
  },
  {
    field: "sugestao_melhoria",
    titulo: "Alguma sugestão de melhoria para os próximos empreendimentos?",
    tipo: "texto",
  },
  {
    field: "estrelas",
    titulo: "De modo geral, como você avalia a qualidade do seu novo apartamento construído pela BP?",
    tipo: "estrelas",
  },
];

const PASSOS = STEPS.length;

export function EntregasTotem() {
  const [view, setView] = useState<View>("scan");
  const [token, setToken] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pesquisa, setPesquisa] = useState<RespostaPesquisa>(RESPOSTA_INICIAL);
  const [step, setStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setView("scan");
    setToken(null);
    setCliente(null);
    setPesquisa(RESPOSTA_INICIAL);
    setStep(0);
    setErrorMsg(null);
  };

  const validarToken = async (tk: string) => {
    setView("loading");
    try {
      const resp = await fetch(`${API_BASE}/entregas/assinar/${tk}`, {
        headers: AUTH_HEADER,
      });
      const data = await resp.json();
      if (!data.ok) {
        setErrorMsg(data.error ?? "Código não reconhecido.");
        setView("erro");
        return;
      }
      if (!data.pode_assinar) {
        const msgs: Record<string, string> = {
          JA_ASSINADO:
            "Este termo já foi assinado. Procure um operador se precisar de uma cópia.",
          VISTORIA_NAO_INICIADA:
            "A vistoria do seu apartamento ainda não foi feita. Procure um operador para iniciar o check-in com o engenheiro.",
          NAO_APTO:
            "Sua unidade ainda não está apta para recebimento. Procure um operador.",
          VISTORIA_EM_ANDAMENTO:
            "A vistoria ainda está em andamento. Aguarde a finalização para assinar.",
        };
        setErrorMsg(msgs[data.motivo] ?? data.mensagem ?? "Não é possível assinar agora.");
        setView("erro");
        return;
      }
      setToken(tk);
      setCliente({
        nome: data.cliente?.nome ?? "—",
        bloco: data.cliente?.bloco ?? "—",
        unidade: data.cliente?.unidade ?? "—",
      });
      setView("resumo");
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão. Tente novamente.");
      setView("erro");
    }
  };

  const buscarPorCpf = async (cpfDigitos: string) => {
    setView("loading");
    try {
      const resp = await fetch(
        `${API_BASE}/entregas/totem/buscar-por-cpf?cpf=${cpfDigitos}`,
        { headers: AUTH_HEADER },
      );
      const data = await resp.json();
      if (!data.ok) {
        const msgs: Record<string, string> = {
          CPF_INVALIDO: "CPF inválido. Verifique os números digitados.",
          CPF_NAO_ENCONTRADO:
            "Não encontramos este CPF na lista de clientes. Procure um operador.",
          SEM_AGENDAMENTO_ATIVO:
            "Não há agendamento ativo para este CPF no momento. Procure um operador.",
          AMBIGUO:
            "Encontramos mais de um agendamento para este CPF. Use o QR Code do agendamento específico.",
        };
        setErrorMsg(msgs[data.code] ?? data.error ?? "Erro ao buscar CPF.");
        setView("erro");
        return;
      }
      await validarToken(data.checkin_token);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão. Tente novamente.");
      setView("erro");
    }
  };

  const enviarPesquisa = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/entregas/totem/pesquisa/${token}`, {
        method: "POST",
        headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
        body: JSON.stringify({
          qualidade_apartamento: pesquisa.qualidade_apartamento,
          qualidade_areas_comuns: pesquisa.qualidade_areas_comuns,
          item_apto_favorito: pesquisa.item_apto_favorito,
          parte_apto_favorita: pesquisa.parte_apto_favorita,
          item_lazer_favorito: pesquisa.item_lazer_favorito,
          sugestao_melhoria: pesquisa.sugestao_melhoria.trim() || null,
          estrelas: pesquisa.estrelas,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        setErrorMsg(data.error ?? "Erro ao registrar pesquisa.");
        setView("erro");
        return;
      }
      setView("finalizado");
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão ao registrar pesquisa.");
      setView("erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col">
      <TotemHeader />

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {view === "scan" && (
            <motion.div
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <ScanView onTokenDetected={validarToken} onCpfSubmit={buscarPorCpf} />
            </motion.div>
          )}

          {view === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <Loader2 className="w-16 h-16 animate-spin text-[#CE9D58]" />
            </motion.div>
          )}

          {view === "resumo" && cliente && (
            <motion.div
              key="resumo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col"
            >
              <ResumoView
                cliente={cliente}
                onIniciar={() => {
                  setStep(0);
                  setView("pesquisa");
                }}
                onCancelar={reset}
              />
            </motion.div>
          )}

          {view === "pesquisa" && (
            <motion.div
              key="pesquisa"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <PesquisaView
                step={step}
                pesquisa={pesquisa}
                setPesquisa={setPesquisa}
                onNext={() => setStep((s) => Math.min(s + 1, PASSOS - 1))}
                onBack={() => setStep((s) => Math.max(s - 1, 0))}
                onFinalizar={enviarPesquisa}
                submitting={submitting}
                onCancelar={reset}
              />
            </motion.div>
          )}

          {view === "finalizado" && (
            <motion.div
              key="finalizado"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex-1 flex items-center justify-center px-8"
            >
              <FinalizadoView onVoltar={reset} />
            </motion.div>
          )}

          {view === "erro" && (
            <motion.div
              key="erro"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex-1 flex items-center justify-center px-8"
            >
              <ErroView mensagem={errorMsg ?? "Erro desconhecido"} onVoltar={reset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function TotemHeader() {
  return (
    <header className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-[#322D67]/10">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#CE9D58] font-semibold">BP Construtora</p>
        <h1 className="text-xl font-semibold text-[#322D67]">Recebimento Gran Santorini</h1>
      </div>
      <ClockBadge />
    </header>
  );
}

function ClockBadge() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="text-right">
      <p className="text-xs text-[#322D67]/60">{fmt.format(now)}</p>
    </div>
  );
}

function ScanView({
  onTokenDetected,
  onCpfSubmit,
}: {
  onTokenDetected: (token: string) => void;
  onCpfSubmit: (cpfDigitos: string) => void;
}) {
  const [cpfOpen, setCpfOpen] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [debug, setDebug] = useState<{
    keystrokes: number;
    lastKey: string;
    lastSrc: string;
    lastAt: number;
    focused: boolean;
    bufferLen: number;
  }>({ keystrokes: 0, lastKey: "—", lastSrc: "—", lastAt: 0, focused: false, bufferLen: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const onTokenDetectedRef = useRef(onTokenDetected);

  // Habilita o painel de diagnóstico só com `?debug=1` na URL.
  const debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  useEffect(() => {
    onTokenDetectedRef.current = onTokenDetected;
  }, [onTokenDetected]);

  // Captura de leitor HID externo (USB/Bluetooth) — comporta-se como teclado.
  // Em Chrome Android, `inputMode=none` e `pointer-events-none` podem impedir
  // o input invisível de receber keystrokes externos, então a captura roda
  // primária no `document` (cobre Android) com o input invisível focado só
  // pra "ancorar" o foco e evitar abrir teclado virtual em outros elementos.
  // O modal de CPF pausa a captura para o numpad virtual não conflitar.
  useEffect(() => {
    if (cpfOpen) return;

    let buffer = "";
    let lastKeyAt = 0;
    let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

    const processarKey = (e: KeyboardEvent, src: string) => {
      const now = Date.now();
      // Leitor HID dispara em ~10ms. Acima de 100ms é digitação humana
      // (ex.: alguém apertou uma tecla por engano) — descarta o buffer.
      if (now - lastKeyAt > 100) buffer = "";
      lastKeyAt = now;

      if (debugEnabled) {
        setDebug((d) => ({
          ...d,
          keystrokes: d.keystrokes + 1,
          lastKey: e.key,
          lastSrc: src,
          lastAt: now,
          bufferLen: buffer.length + (e.key.length === 1 ? 1 : 0),
        }));
      }

      // Aceita Enter (principal e numpad) e Tab como sufixos de fim de leitura.
      // Tab é comum em leitores configurados como "wedge" para campos de form.
      const isTerminador =
        e.key === "Enter" || e.code === "NumpadEnter" || e.key === "Tab";
      if (isTerminador) {
        e.preventDefault();
        const match = buffer.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        );
        const tk = match ? match[0] : buffer.trim();
        buffer = "";
        if (inputRef.current) inputRef.current.value = "";
        if (tk.length > 0) {
          setFeedback(true);
          if (feedbackTimeout) clearTimeout(feedbackTimeout);
          feedbackTimeout = setTimeout(() => setFeedback(false), 600);
          onTokenDetectedRef.current(tk);
        }
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    // Listener primário no document — cobre Android, onde o input invisível
    // pode não receber keydown de teclado externo.
    const onDocKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName;
      // Se foco está em input/textarea visível (ex.: modal CPF), deixa
      // o leitor digitar lá e não duplica.
      if (
        tgt !== inputRef.current &&
        (tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (tgt && tgt.isContentEditable))
      ) {
        return;
      }
      processarKey(e, tag === "INPUT" ? "hidden-input" : "document");
    };
    document.addEventListener("keydown", onDocKey, true);

    // Mantém o foco no input invisível (re-foca em blur)
    const refocus = () => {
      if (!cpfOpen && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
      if (debugEnabled) {
        setDebug((d) => ({
          ...d,
          focused: document.activeElement === inputRef.current,
        }));
      }
    };
    refocus();
    const interval = setInterval(refocus, 1500);

    return () => {
      document.removeEventListener("keydown", onDocKey, true);
      clearInterval(interval);
      if (feedbackTimeout) clearTimeout(feedbackTimeout);
    };
  }, [cpfOpen, debugEnabled]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
      {/* Input "ancora" de foco — em Android, `pointer-events-none` e
          `inputMode=none` podem fazer o input ignorar teclado externo,
          então removemos ambos. Fica posicionado dentro da viewport
          (não em top:-9999, que pode causar scroll/foco inconsistente em
          mobile) com opacity 0 e tamanho 1px. A captura real acontece no
          listener do `document`. */}
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        tabIndex={-1}
        className="fixed top-0 left-0 w-px h-px opacity-0"
        style={{ caretColor: "transparent" }}
      />

      {debugEnabled && (
        <div className="fixed bottom-2 left-2 z-50 px-3 py-2 rounded-lg bg-black/80 text-[11px] text-emerald-300 font-mono leading-snug pointer-events-none">
          <div>HID debug</div>
          <div>keystrokes: {debug.keystrokes}</div>
          <div>last: {debug.lastKey} ({debug.lastSrc})</div>
          <div>buffer: {debug.bufferLen} chars</div>
          <div>focado: {debug.focused ? "sim" : "não"}</div>
          <div>há {debug.lastAt ? Math.round((Date.now() - debug.lastAt) / 100) / 10 : "—"}s</div>
        </div>
      )}

      <ScannerRadar feedback={feedback} />

      <h2 className="mt-10 text-2xl font-semibold text-[#322D67] text-center max-w-md leading-snug">
        Aproxime o QR Code do seu agendamento no leitor
      </h2>
      <p className="mt-3 text-sm text-[#322D67]/60 text-center max-w-sm">
        Posicione o código em frente ao leitor.
      </p>

      <button
        type="button"
        onClick={() => setCpfOpen(true)}
        className="mt-12 inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white hover:bg-[#CE9D58]/5 border-2 border-[#CE9D58] text-[#322D67] text-lg font-medium transition-all"
      >
        <KeyRound className="w-5 h-5 text-[#CE9D58]" />
        Digitar CPF
      </button>

      <AnimatePresence>
        {cpfOpen && (
          <CpfModal
            onClose={() => setCpfOpen(false)}
            onSubmit={(cpfDig) => {
              setCpfOpen(false);
              onCpfSubmit(cpfDig);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Decoração visual — radar pulsante com ícone de QR no centro.
// Sem câmera: a leitura é feita por leitor HID externo (USB/Bluetooth).
// Quando `feedback=true`, pisca verde para indicar leitura reconhecida.
function ScannerRadar({ feedback }: { feedback: boolean }) {
  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      {/* Halos pulsantes */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0.6 }}
        animate={{ scale: 1.1, opacity: 0 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        className={`absolute inset-0 rounded-full border-2 ${
          feedback ? "border-emerald-500" : "border-[#CE9D58]/60"
        }`}
      />
      <motion.div
        initial={{ scale: 0.6, opacity: 0.4 }}
        animate={{ scale: 1.05, opacity: 0 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
        className={`absolute inset-0 rounded-full border ${
          feedback ? "border-emerald-500/70" : "border-[#CE9D58]/40"
        }`}
      />
      <div className="absolute inset-6 rounded-full border border-[#322D67]/5" />

      {/* Núcleo com ícone de QR */}
      <div
        className={`relative w-28 h-28 rounded-2xl border-2 shadow-xl flex items-center justify-center overflow-hidden transition-colors ${
          feedback
            ? "bg-emerald-50 border-emerald-500"
            : "bg-white border-[#CE9D58]"
        }`}
      >
        <QrCode
          className={`w-14 h-14 ${feedback ? "text-emerald-600" : "text-[#322D67]"}`}
          strokeWidth={1.5}
        />
        {/* Linha radar atravessando o ícone */}
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: "100%" }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          className={`pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-b from-transparent to-transparent shadow-[0_0_20px_rgba(206,157,88,0.7)] ${
            feedback ? "via-emerald-500" : "via-[#CE9D58]"
          }`}
        />
      </div>
    </div>
  );
}

function CpfModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (cpfDigitos: string) => void;
}) {
  const [cpf, setCpf] = useState("");
  const cpfDigitos = cpf.replace(/\D/g, "").slice(0, 11);
  const podeEnviar = cpfDigitos.length === 11;

  const formatado = formatCpf(cpfDigitos);

  const append = (digit: string) => {
    if (cpfDigitos.length >= 11) return;
    setCpf(cpfDigitos + digit);
  };

  const back = () => {
    setCpf(cpfDigitos.slice(0, -1));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#322D67]/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md w-full bg-white border-t-4 border-[#CE9D58] rounded-t-3xl p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-[#322D67]">Digite seu CPF</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#322D67]/5 hover:bg-[#322D67]/10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-[#322D67]" />
          </button>
        </div>

        <div className="bg-[#322D67]/5 border border-[#322D67]/15 rounded-2xl px-6 py-5 mb-6">
          <p className="text-3xl font-mono text-[#322D67] text-center tracking-wider">
            {formatado || <span className="text-[#322D67]/30">000.000.000-00</span>}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeyButton key={d} onClick={() => append(d)} label={d} />
          ))}
          <div />
          <KeyButton onClick={() => append("0")} label="0" />
          <KeyButton onClick={back} icon={<ChevronLeft className="w-7 h-7" />} />
        </div>

        <button
          type="button"
          disabled={!podeEnviar}
          onClick={() => onSubmit(cpfDigitos)}
          className="w-full py-4 rounded-2xl bg-[#CE9D58] hover:bg-[#b88847] disabled:bg-[#322D67]/10 disabled:text-[#322D67]/30 text-white text-lg font-semibold transition-all shadow-lg shadow-[#CE9D58]/20 disabled:shadow-none"
        >
          Buscar
        </button>
      </motion.div>
    </>
  );
}

function KeyButton({
  label,
  icon,
  onClick,
}: {
  label?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-16 rounded-2xl bg-[#322D67]/5 hover:bg-[#322D67]/10 active:bg-[#322D67]/15 border border-[#322D67]/10 flex items-center justify-center text-2xl font-medium text-[#322D67] transition-all"
    >
      {icon ?? label}
    </button>
  );
}

function formatCpf(digitos: string): string {
  const d = digitos;
  if (d.length === 0) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function ResumoView({
  cliente,
  onIniciar,
  onCancelar,
}: {
  cliente: Cliente;
  onIniciar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 mb-4">
            <Check className="w-10 h-10 text-emerald-600" strokeWidth={2.5} />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#CE9D58] font-semibold mb-2">Tudo pronto</p>
          <h2 className="text-3xl font-semibold text-[#322D67] mb-2">
            Olá, {primeiroNome(cliente.nome)}!
          </h2>
          <p className="text-[#322D67]/60">
            Bloco {cliente.bloco} · Unidade {cliente.unidade}
          </p>
        </div>

        <div className="space-y-3 mb-10">
          <ChecklistItem ok label="Documentação validada" />
          <ChecklistItem ok label="Vistoria realizada e aprovada" />
          <ChecklistItem ok label="Pronto para assinatura" />
        </div>

        <button
          type="button"
          onClick={onIniciar}
          className="w-full py-5 rounded-2xl bg-[#CE9D58] hover:bg-[#b88847] text-white text-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#CE9D58]/25"
        >
          Iniciar assinatura
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="w-full mt-3 py-3 rounded-2xl text-[#322D67]/60 hover:text-[#322D67] text-sm font-medium transition-all"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#322D67]/10">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center ${
          ok ? "bg-emerald-500" : "bg-[#322D67]/10"
        }`}
      >
        <Check className={`w-4 h-4 ${ok ? "text-white" : "text-[#322D67]/30"}`} strokeWidth={3} />
      </div>
      <span className="text-[#322D67] font-medium">{label}</span>
    </div>
  );
}

function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || nome;
}

function PesquisaView({
  step,
  pesquisa,
  setPesquisa,
  onNext,
  onBack,
  onFinalizar,
  submitting,
  onCancelar,
}: {
  step: number;
  pesquisa: RespostaPesquisa;
  setPesquisa: React.Dispatch<React.SetStateAction<RespostaPesquisa>>;
  onNext: () => void;
  onBack: () => void;
  onFinalizar: () => void;
  submitting: boolean;
  onCancelar: () => void;
}) {
  const atualStep = STEPS[step];

  const podeAvancar = (() => {
    switch (atualStep.tipo) {
      case "qualidade":
      case "item_apto":
      case "parte_apto":
      case "item_lazer":
        return Boolean(pesquisa[atualStep.field]);
      case "estrelas":
        return pesquisa.estrelas !== null;
      case "texto":
        return true;
    }
  })();

  const ehUltimo = step === PASSOS - 1;

  return (
    <div className="flex-1 flex flex-col px-8 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: PASSOS }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              i <= step ? "bg-[#CE9D58]" : "bg-[#322D67]/10"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-[#CE9D58] font-semibold uppercase tracking-wider mb-1">
        Pergunta {step + 1} de {PASSOS}
      </p>

      <h2 className="text-2xl font-semibold text-[#322D67] leading-snug mb-8">
        {atualStep.titulo}
      </h2>

      <div className="flex-1 overflow-y-auto pb-2">
        <PesquisaCampo step={atualStep} pesquisa={pesquisa} setPesquisa={setPesquisa} />
      </div>

      <div className="flex items-center gap-3 pt-6">
        {step > 0 ? (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="px-5 py-4 rounded-2xl bg-[#322D67]/5 hover:bg-[#322D67]/10 border border-[#322D67]/15 text-[#322D67] font-medium flex items-center gap-2 transition-all disabled:opacity-40"
          >
            <ChevronLeft className="w-5 h-5" />
            Voltar
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancelar}
            disabled={submitting}
            className="px-5 py-4 rounded-2xl text-[#322D67]/60 hover:text-[#322D67] font-medium transition-all"
          >
            Cancelar
          </button>
        )}

        {ehUltimo ? (
          <button
            type="button"
            onClick={onFinalizar}
            disabled={!podeAvancar || submitting}
            className="flex-1 py-4 rounded-2xl bg-[#CE9D58] hover:bg-[#b88847] disabled:bg-[#322D67]/10 disabled:text-[#322D67]/30 text-white text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#CE9D58]/20 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                Finalizar e assinar
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!podeAvancar}
            className="flex-1 py-4 rounded-2xl bg-[#CE9D58] hover:bg-[#b88847] disabled:bg-[#322D67]/10 disabled:text-[#322D67]/30 text-white text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#CE9D58]/20 disabled:shadow-none"
          >
            Continuar
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function PesquisaCampo({
  step,
  pesquisa,
  setPesquisa,
}: {
  step: PesquisaStep;
  pesquisa: RespostaPesquisa;
  setPesquisa: React.Dispatch<React.SetStateAction<RespostaPesquisa>>;
}) {
  if (step.tipo === "qualidade") {
    const field = step.field;
    return (
      <OpcoesGrid
        opcoes={QUALIDADE_OPCOES}
        selected={pesquisa[field] as string | null}
        onSelect={(v) => setPesquisa((p) => ({ ...p, [field]: v }))}
      />
    );
  }
  if (step.tipo === "item_apto") {
    return (
      <OpcoesGrid
        opcoes={ITEM_APTO_OPCOES}
        selected={pesquisa.item_apto_favorito}
        onSelect={(v) => setPesquisa((p) => ({ ...p, item_apto_favorito: v }))}
      />
    );
  }
  if (step.tipo === "parte_apto") {
    return (
      <OpcoesGrid
        opcoes={PARTE_APTO_OPCOES}
        selected={pesquisa.parte_apto_favorita}
        onSelect={(v) => setPesquisa((p) => ({ ...p, parte_apto_favorita: v }))}
      />
    );
  }
  if (step.tipo === "item_lazer") {
    return (
      <OpcoesGrid
        opcoes={ITEM_LAZER_OPCOES}
        selected={pesquisa.item_lazer_favorito}
        onSelect={(v) => setPesquisa((p) => ({ ...p, item_lazer_favorito: v }))}
      />
    );
  }
  if (step.tipo === "texto") {
    return (
      <div>
        <textarea
          value={pesquisa.sugestao_melhoria}
          onChange={(e) =>
            setPesquisa((p) => ({ ...p, sugestao_melhoria: e.target.value }))
          }
          rows={6}
          maxLength={2000}
          placeholder="Sua sugestão (opcional)"
          className="w-full px-5 py-4 rounded-2xl bg-white border border-[#322D67]/15 text-[#322D67] text-base placeholder:text-[#322D67]/40 focus:outline-none focus:border-[#CE9D58] focus:ring-2 focus:ring-[#CE9D58]/20 transition-all"
        />
        <p className="mt-2 text-xs text-[#322D67]/50">
          Esta pergunta é opcional — você pode pular tocando em Continuar.
        </p>
      </div>
    );
  }
  // estrelas
  const valor = pesquisa.estrelas ?? 0;
  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPesquisa((p) => ({ ...p, estrelas: n }))}
            className="p-2 transition-transform active:scale-95"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          >
            <Star
              className={`w-14 h-14 ${
                n <= valor ? "fill-[#CE9D58] text-[#CE9D58]" : "text-[#322D67]/20"
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-lg text-[#322D67] font-medium h-7">
        {pesquisa.estrelas ? ESTRELAS_LABELS[pesquisa.estrelas] : ""}
      </p>
    </div>
  );
}

function OpcoesGrid({
  opcoes,
  selected,
  onSelect,
}: {
  opcoes: Array<{ value: string; label: string; emoji?: string }>;
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {opcoes.map((op) => {
        const ativo = selected === op.value;
        return (
          <button
            key={op.value}
            type="button"
            onClick={() => onSelect(op.value)}
            className={`px-5 py-4 rounded-2xl text-left flex items-center gap-3 transition-all border-2 ${
              ativo
                ? "bg-[#CE9D58]/10 border-[#CE9D58] text-[#322D67]"
                : "bg-white border-[#322D67]/10 hover:border-[#CE9D58]/40 hover:bg-[#CE9D58]/5 text-[#322D67]"
            }`}
          >
            {op.emoji && <span className="text-2xl">{op.emoji}</span>}
            <span className="text-base font-medium flex-1">{op.label}</span>
            {ativo && <Check className="w-5 h-5 text-[#CE9D58]" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

function FinalizadoView({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-500 mb-6">
        <Check className="w-12 h-12 text-emerald-600" strokeWidth={2.5} />
      </div>
      <h2 className="text-3xl font-semibold text-[#322D67] mb-3">Pesquisa registrada!</h2>
      <p className="text-[#322D67]/60 mb-2">
        Obrigado por compartilhar sua opinião sobre o Gran Santorini.
      </p>
      <div className="mt-8 px-5 py-4 rounded-2xl bg-[#CE9D58]/10 border border-[#CE9D58]/40">
        <p className="text-sm text-[#322D67]">
          <strong className="text-[#CE9D58]">Próxima etapa:</strong> assinatura digital do termo de
          recebimento — em construção.
        </p>
      </div>
      <button
        type="button"
        onClick={onVoltar}
        className="mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#322D67]/5 hover:bg-[#322D67]/10 border border-[#322D67]/15 text-[#322D67] text-lg font-medium transition-all"
      >
        <Home className="w-5 h-5" />
        Voltar ao início
      </button>
    </div>
  );
}

function ErroView({
  mensagem,
  onVoltar,
}: {
  mensagem: string;
  onVoltar: () => void;
}) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-rose-50 border-2 border-rose-500 mb-6">
        <AlertTriangle className="w-12 h-12 text-rose-600" />
      </div>
      <h2 className="text-3xl font-semibold text-[#322D67] mb-3">Não foi possível continuar</h2>
      <p className="text-[#322D67]/60 mb-8">{mensagem}</p>
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#CE9D58] hover:bg-[#b88847] text-white text-lg font-semibold transition-all shadow-lg shadow-[#CE9D58]/20"
      >
        <RotateCcw className="w-5 h-5" />
        Tentar novamente
      </button>
    </div>
  );
}
