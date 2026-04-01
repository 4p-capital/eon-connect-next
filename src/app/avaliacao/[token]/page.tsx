"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { projectId, publicAnonKey } from "@/utils/supabase/info";

interface AvaliacaoData {
  id: string;
  token: string;
  id_assistencia: number;
  status: string;
  assistencia_finalizada: {
    id: number;
    responsaveis: string[];
    providencias: string;
    created_at: string;
  } | null;
  assistencia: {
    categoria_reparo: string;
    descricao_cliente: string;
    created_at: string;
  } | null;
  cliente: {
    proprietario: string;
  } | null;
}

export default function AvaliacaoPage() {
  const params = useParams();
  const token = params.token as string;

  const [dados, setDados] = useState<AvaliacaoData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<number | null>(null);
  const [hoverNota, setHoverNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!token) return;
    carregarAvaliacao();
  }, [token]);

  const carregarAvaliacao = async () => {
    try {
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/clicksign/avaliacao?token=${token}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey } }
      );
      if (!resp.ok) {
        const data = await resp.json();
        setErro(data.error || "Avaliacao nao encontrada.");
        return;
      }
      const data = await resp.json();
      if (data.status === "respondida") setEnviado(true);
      setDados(data);
    } catch {
      setErro("Erro ao carregar avaliacao. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const enviarAvaliacao = async () => {
    if (!nota) return;
    setEnviando(true);
    try {
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/clicksign/avaliacao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey },
          body: JSON.stringify({ token, nota, comentario: comentario.trim() || null }),
        }
      );
      if (resp.ok) {
        setEnviado(true);
      } else {
        const data = await resp.json();
        setErro(data.error || "Erro ao enviar avaliacao.");
      }
    } catch {
      setErro("Erro de conexao. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const formatarData = (dataStr: string | null | undefined) => {
    if (!dataStr) return null;
    try {
      return new Date(dataStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return null; }
  };

  const getNotaColor = (n: number, isActive: boolean) => {
    if (!isActive) return "bg-gray-100 text-gray-400 border-gray-200";
    if (n <= 3) return "bg-red-500 text-white border-red-500 shadow-red-200";
    if (n <= 5) return "bg-orange-400 text-white border-orange-400 shadow-orange-200";
    if (n <= 7) return "bg-yellow-400 text-yellow-900 border-yellow-400 shadow-yellow-200";
    if (n <= 9) return "bg-emerald-400 text-white border-emerald-400 shadow-emerald-200";
    return "bg-emerald-500 text-white border-emerald-500 shadow-emerald-200";
  };

  const getNotaEmoji = () => {
    if (!nota) return null;
    if (nota <= 2) return { emoji: "😞", text: "Precisamos melhorar muito" };
    if (nota <= 4) return { emoji: "😕", text: "Abaixo do esperado" };
    if (nota <= 6) return { emoji: "😐", text: "Pode melhorar" };
    if (nota <= 8) return { emoji: "😊", text: "Bom trabalho!" };
    if (nota === 9) return { emoji: "😄", text: "Otimo servico!" };
    return { emoji: "🤩", text: "Excelente! Obrigado!" };
  };

  // ── Loading ──
  if (carregando) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  // ── Erro ──
  if (erro && !dados) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">{erro}</p>
        </div>
      </div>
    );
  }

  // ── Sucesso ──
  if (enviado) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Obrigado!</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Sua avaliacao foi registrada com sucesso. Ela nos ajuda a melhorar nossos servicos.
          </p>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-[11px] text-gray-300 font-medium tracking-wide uppercase">BP Incorporadora</p>
          </div>
        </div>
      </div>
    );
  }

  const nomeCliente = dados?.cliente?.proprietario || "Cliente";
  const primeiroNome = nomeCliente.split(" ")[0];
  const notaInfo = getNotaEmoji();
  const responsaveis = dados?.assistencia_finalizada?.responsaveis;
  const responsaveisStr = Array.isArray(responsaveis) ? responsaveis.join(", ") : responsaveis;
  const dataFinalizado = formatarData(dados?.assistencia_finalizada?.created_at);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Conteudo centralizado */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-8">

          {/* Saudacao */}
          <div>
            <p className="text-[11px] text-gray-300 font-medium tracking-wide uppercase mb-3">BP Incorporadora</p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Ola, {primeiroNome}.
            </h1>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
              Seu reparo foi finalizado{dataFinalizado ? ` em ${dataFinalizado}` : ''}.
              {responsaveisStr ? ` Responsavel: ${responsaveisStr}.` : ''}
            </p>
          </div>

          {/* Resumo compacto */}
          <div className="flex items-center gap-3 py-3 border-y border-gray-100">
            <div className="w-1 h-8 bg-black rounded-full" />
            <div>
              <p className="text-xs font-semibold text-gray-900">
                #{dados?.id_assistencia} - {dados?.assistencia?.categoria_reparo || 'Assistencia Tecnica'}
              </p>
              {dados?.assistencia?.descricao_cliente && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dados.assistencia.descricao_cliente}</p>
              )}
            </div>
          </div>

          {/* Pergunta + Notas */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Como voce avalia o reparo?
            </h2>
            <p className="text-xs text-gray-400 mb-5">Selecione uma nota de 1 a 10</p>

            <div className="flex justify-between gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                const isActive = hoverNota !== null ? n <= hoverNota : nota !== null && n <= nota;
                const refNota = hoverNota ?? nota ?? 0;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNota(n)}
                    onMouseEnter={() => setHoverNota(n)}
                    onMouseLeave={() => setHoverNota(null)}
                    className={`flex-1 aspect-square max-w-[40px] rounded-xl text-xs font-bold border transition-all duration-150 ${
                      isActive
                        ? `${getNotaColor(refNota, true)} shadow-md scale-110`
                        : `${getNotaColor(n, false)} hover:scale-110 hover:border-gray-300`
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] text-gray-300 mt-2 px-0.5">
              <span>Ruim</span>
              <span>Excelente</span>
            </div>

            {notaInfo && (
              <div className="text-center mt-4 animate-in fade-in duration-300">
                <span className="text-3xl">{notaInfo.emoji}</span>
                <p className="text-xs text-gray-500 mt-1 font-medium">{notaInfo.text}</p>
              </div>
            )}
          </div>

          {/* Comentario */}
          <div>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Deixe um comentario (opcional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all placeholder:text-gray-300"
            />
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-sm text-red-500 text-center">{erro}</p>
          )}

          {/* Botao */}
          <button
            onClick={enviarAvaliacao}
            disabled={!nota || enviando}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3.5 rounded-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar avaliacao
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-gray-300">
            Avaliacao confidencial
          </p>
        </div>
      </div>
    </div>
  );
}
