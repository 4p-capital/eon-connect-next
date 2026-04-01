"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Star, Send, Loader2, CheckCircle2, AlertCircle, Wrench, Calendar, Tag, MessageSquare } from "lucide-react";
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
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            apikey: publicAnonKey,
          },
        }
      );

      if (!resp.ok) {
        const data = await resp.json();
        setErro(data.error || "Avaliação não encontrada.");
        return;
      }

      const data = await resp.json();
      if (data.status === "respondida") {
        setEnviado(true);
      }
      setDados(data);
    } catch {
      setErro("Erro ao carregar avaliação. Tente novamente.");
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
            apikey: publicAnonKey,
          },
          body: JSON.stringify({ token, nota, comentario: comentario.trim() || null }),
        }
      );

      if (resp.ok) {
        setEnviado(true);
      } else {
        const data = await resp.json();
        setErro(data.error || "Erro ao enviar avaliação.");
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const formatarData = (dataStr: string | null | undefined) => {
    if (!dataStr) return "---";
    try {
      return new Date(dataStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "---";
    }
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
    if (nota === 9) return { emoji: "😄", text: "Ótimo serviço!" };
    return { emoji: "🤩", text: "Excelente! Obrigado!" };
  };

  // ── Loading ──
  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">Carregando avaliação...</p>
        </div>
      </div>
    );
  }

  // ── Erro ──
  if (erro && !dados) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Avaliação indisponível</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{erro}</p>
        </div>
      </div>
    );
  }

  // ── Sucesso ──
  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="relative mx-auto mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div className="absolute -top-1 -right-1 text-3xl animate-bounce" style={{ right: 'calc(50% - 50px)' }}>
              🎉
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Obrigado pela sua avaliação!</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Sua opinião é muito importante para continuarmos melhorando nossos serviços.
          </p>
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400">BP Incorporadora</p>
          </div>
        </div>
      </div>
    );
  }

  const nomeCliente = dados?.cliente?.proprietario || "Cliente";
  const primeiroNome = nomeCliente.split(" ")[0];
  const notaInfo = getNotaEmoji();

  // ── Formulario ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 max-w-lg w-full overflow-hidden">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <Star className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Avaliação do Serviço</h1>
              <p className="text-xs text-gray-400">BP Incorporadora</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Saudacao */}
          <div className="text-center pb-1">
            <p className="text-lg text-gray-800">
              Olá, <span className="font-bold text-gray-900">{primeiroNome}</span>! 👋
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Sua avaliação nos ajuda a melhorar cada vez mais.
            </p>
          </div>

          {/* Dados do chamado */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-50/50 rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-xs font-bold text-black uppercase tracking-wider">
                Solicitação N. {dados?.id_assistencia}
              </p>
            </div>
            <div className="space-y-2.5">
              {dados?.assistencia?.categoria_reparo && (
                <div className="flex items-start gap-2.5">
                  <Tag className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Categoria</span>
                    <span className="text-xs text-gray-700 font-semibold bg-white px-2.5 py-1 rounded-md border border-gray-100">
                      {dados.assistencia.categoria_reparo}
                    </span>
                  </div>
                </div>
              )}
              {dados?.assistencia?.descricao_cliente && (
                <div className="flex items-start gap-2.5">
                  <MessageSquare className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-400">Descrição</span>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{dados.assistencia.descricao_cliente}</p>
                  </div>
                </div>
              )}
              {dados?.assistencia_finalizada?.responsaveis && dados.assistencia_finalizada.responsaveis.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Wrench className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Responsavel</span>
                    <span className="text-xs text-gray-700 font-semibold bg-white px-2.5 py-1 rounded-md border border-gray-100">
                      {Array.isArray(dados.assistencia_finalizada.responsaveis)
                        ? dados.assistencia_finalizada.responsaveis.join(', ')
                        : dados.assistencia_finalizada.responsaveis}
                    </span>
                  </div>
                </div>
              )}
              {dados?.assistencia_finalizada?.created_at && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Finalizado em</span>
                    <span className="text-xs text-gray-700 font-semibold">
                      {formatarData(dados.assistencia_finalizada.created_at)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nota - NPS */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Como você avalia o reparo realizado?
            </label>
            <p className="text-xs text-gray-400 mb-4">Selecione uma nota de 1 a 10</p>
            <div className="flex justify-center gap-1.5">
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
                    className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all duration-150 ${
                      isActive
                        ? `${getNotaColor(refNota, true)} shadow-md scale-105`
                        : `${getNotaColor(n, false)} hover:scale-105 hover:border-gray-300`
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-300 mt-2 px-1">
              <span>Ruim</span>
              <span>Excelente</span>
            </div>
            {notaInfo && (
              <div className="text-center mt-3 animate-in fade-in duration-300">
                <span className="text-2xl">{notaInfo.emoji}</span>
                <p className="text-xs text-gray-500 mt-1 font-medium">{notaInfo.text}</p>
              </div>
            )}
          </div>

          {/* Comentario */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Deixe um comentário
            </label>
            <p className="text-xs text-gray-400 mb-2">Elogios, reclamações ou sugestões (opcional)</p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Conte-nos mais sobre sua experiência..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all placeholder:text-gray-300"
            />
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {erro}
            </div>
          )}

          {/* Botao */}
          <button
            onClick={enviarAvaliacao}
            disabled={!nota || enviando}
            className="w-full bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando avaliação...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar avaliação
              </>
            )}
          </button>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-300 pt-1">
            Seus dados estão protegidos e esta avaliação é confidencial.
          </p>
        </div>
      </div>
    </div>
  );
}
