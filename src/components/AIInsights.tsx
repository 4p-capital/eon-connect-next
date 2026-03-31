"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, Loader2, AlertCircle, TrendingUp, Users, Package, Star, Clock, Wrench, Calendar } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface InsightResponse {
  success: boolean;
  prompt: string;
  resposta: string;
  metadata?: {
    totalAssistencias: number;
    totalFinalizadas: number;
    totalMateriais: number;
    periodo?: string;
    modelo: string;
    timestamp: string;
  };
  error?: string;
  needsApiKey?: boolean;
}

const PERGUNTAS_SUGERIDAS = [
  {
    icon: Wrench,
    titulo: 'Padrões nas Descrições',
    prompt: 'Analise as descrições dos clientes e identifique palavras-chave recorrentes, tipos de problemas específicos mencionados e padrões de linguagem que indiquem problemas não óbvios.'
  },
  {
    icon: TrendingUp,
    titulo: 'Problemas por Empreendimento',
    prompt: 'Quais empreendimentos têm problemas recorrentes específicos? Cruze categoria_reparo com empreendimento e descricao_cliente para identificar padrões.'
  },
  {
    icon: Package,
    titulo: 'Categorias vs Descrições',
    prompt: 'Compare as categorias de reparo oficiais com o que os clientes realmente descrevem. Há discrepâncias? Alguma categoria tem descrições muito variadas?'
  },
  {
    icon: AlertCircle,
    titulo: 'Anomalias e Urgências',
    prompt: 'Identifique assistências com descrições que indiquem urgência, gravidade ou problemas atípicos. Há empreendimentos com mais casos críticos?'
  },
  {
    icon: Users,
    titulo: 'Correlação Material-Problema',
    prompt: 'Cruze os materiais utilizados com as descrições dos problemas. Há correlação entre materiais específicos e categorias/empreendimentos?'
  },
  {
    icon: Star,
    titulo: 'Insights Ocultos',
    prompt: 'Encontre 3 insights não óbvios nos dados que não aparecem em contagens simples. Busque padrões ocultos nas descrições, combinações incomuns de categoria+empreendimento, ou tendências temporais.'
  },
];

export function AIInsights() {
  const [prompt, setPrompt] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [resposta, setResposta] = useState<InsightResponse | null>(null);

  const gerarInsight = async (textoPrompt?: string) => {
    const promptFinal = textoPrompt || prompt;
    
    if (!promptFinal.trim()) {
      toast.error('Digite uma pergunta para gerar insights');
      return;
    }

    // Determinar o tipo: se veio de uma sugestão, é 'insight'; se veio do campo livre, é 'general'
    const tipo = textoPrompt ? 'insight' : 'general';

    setLoading(true);
    setResposta(null);

    try {
      console.log('🤖 Gerando insights com IA...');
      console.log('📝 Prompt:', promptFinal);
      console.log('🔀 Tipo:', tipo);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/ai-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ 
            prompt: promptFinal,
            type: tipo,
            dataInicio: dataInicio || undefined,
            dataFim: dataFim || undefined
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erro na API:', data);
        
        if (data.needsApiKey) {
          toast.error('Configure a API Key da OpenAI nas variáveis de ambiente', {
            duration: 5000
          });
          setResposta({
            success: false,
            prompt: promptFinal,
            resposta: '',
            error: 'API Key da OpenAI não configurada. Adicione a variável de ambiente OPENAI_API_KEY.'
          });
        } else {
          toast.error(data.error || 'Erro ao gerar insights');
          setResposta({
            success: false,
            prompt: promptFinal,
            resposta: '',
            error: data.error || 'Erro desconhecido'
          });
        }
        return;
      }

      console.log('✅ Insights gerados com sucesso');
      setResposta(data);
      toast.success('Insights gerados com sucesso!');

    } catch (error) {
      console.error('❌ Erro ao gerar insights:', error);
      toast.error('Erro ao conectar com o servidor');
      setResposta({
        success: false,
        prompt: promptFinal,
        resposta: '',
        error: String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const usarPerguntaSugerida = (pergunta: string) => {
    setPrompt(pergunta);
    gerarInsight(pergunta);
  };

  return (
    <div className="space-y-6">
      {/* Card Principal - Input */}
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Insights com IA</CardTitle>
              <CardDescription className="text-base">
                Faça perguntas sobre os dados e receba análises inteligentes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Filtros de Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                Data Início (opcional)
              </label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border-2 focus:border-black"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                Data Fim (opcional)
              </label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border-2 focus:border-black"
                disabled={loading}
              />
            </div>
            <div className="col-span-1 md:col-span-2 flex gap-2">
              <Button
                onClick={() => {
                  const hoje = new Date().toISOString().split('T')[0];
                  setDataInicio(hoje);
                  setDataFim(hoje);
                }}
                variant="outline"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                📅 Hoje
              </Button>
              <Button
                onClick={() => {
                  const hoje = new Date();
                  const semanaPassada = new Date(hoje);
                  semanaPassada.setDate(hoje.getDate() - 7);
                  setDataInicio(semanaPassada.toISOString().split('T')[0]);
                  setDataFim(hoje.toISOString().split('T')[0]);
                }}
                variant="outline"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                📅 Última Semana
              </Button>
              <Button
                onClick={() => {
                  const hoje = new Date();
                  const mesPassado = new Date(hoje);
                  mesPassado.setMonth(hoje.getMonth() - 1);
                  setDataInicio(mesPassado.toISOString().split('T')[0]);
                  setDataFim(hoje.toISOString().split('T')[0]);
                }}
                variant="outline"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                📅 Último Mês
              </Button>
              {(dataInicio || dataFim) && (
                <Button
                  onClick={() => {
                    setDataInicio('');
                    setDataFim('');
                  }}
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  🗑️ Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Área de Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Digite sua pergunta:
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Quais são os problemas mais comuns no GRAN ROMA?"
              rows={4}
              className="text-base resize-none border-2 focus:border-black"
              disabled={loading}
            />
          </div>

          {/* Botão Gerar */}
          <Button
            onClick={() => gerarInsight()}
            disabled={loading || !prompt.trim()}
            className="w-full h-12 text-base bg-gradient-to-r from-gray-800 to-gray-900 hover:from-black hover:to-gray-800 text-white shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analisando dados...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Gerar Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Perguntas Sugeridas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💡 Perguntas Sugeridas</CardTitle>
          <CardDescription>
            Clique em uma pergunta para análise rápida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERGUNTAS_SUGERIDAS.map((sugestao, index) => {
              const Icon = sugestao.icon;
              return (
                <button
                  key={index}
                  onClick={() => usarPerguntaSugerida(sugestao.prompt)}
                  disabled={loading}
                  className="flex flex-col items-start gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-gray-700 group-hover:scale-110 transition-transform" />
                    <span className="font-medium text-sm text-gray-900">
                      {sugestao.titulo}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {sugestao.prompt}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resposta da IA */}
      {resposta && (
        <Card className={`border-2 ${resposta.success ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              {resposta.success ? (
                <div className="p-2 bg-green-500 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              ) : (
                <div className="p-2 bg-red-500 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-lg">
                  {resposta.success ? '✨ Análise Gerada' : '⚠️ Erro'}
                </CardTitle>
                <CardDescription className="text-sm italic">
                  "{resposta.prompt}"
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {resposta.success ? (
              <div className="space-y-4">
                {/* Resposta formatada em Markdown */}
                <div className="prose prose-sm max-w-none bg-white rounded-xl p-6 border-2 border-gray-200">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-2 text-gray-800 mt-4" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mb-2 text-gray-700 mt-3" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-3 text-gray-700 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-700" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-700" {...props} />,
                      li: ({ node, ...props }) => <li className="text-gray-700" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
                      em: ({ node, ...props }) => <em className="italic text-gray-800" {...props} />,
                      code: ({ node, ...props }) => <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />,
                      blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-400 pl-4 italic text-gray-700 my-3" {...props} />,
                    }}
                  >
                    {resposta.resposta}
                  </ReactMarkdown>
                </div>

                {/* Metadata */}
                {resposta.metadata && (
                  <div className="flex flex-wrap gap-3 pt-3 border-t">
                    {resposta.metadata.periodo && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-full text-xs">
                        <span className="font-medium text-orange-900">
                          📅 {resposta.metadata.periodo}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-full text-xs">
                      <span className="font-medium text-blue-900">
                        📊 {resposta.metadata.totalAssistencias} assistências
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full text-xs">
                      <span className="font-medium text-green-900">
                        ✅ {resposta.metadata.totalFinalizadas} finalizadas
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs">
                      <span className="font-medium text-gray-900">
                        📦 {resposta.metadata.totalMateriais} materiais
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs">
                      <span className="font-medium text-gray-700">
                        🤖 {resposta.metadata.modelo}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 border-2 border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900 mb-1">
                      Não foi possível gerar os insights
                    </p>
                    <p className="text-sm text-red-700">
                      {resposta.error}
                    </p>
                    {resposta.error?.includes('API Key') && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-900">
                          <strong>💡 Como configurar:</strong><br />
                          1. Obtenha uma API Key em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-yellow-700 hover:text-yellow-800">platform.openai.com</a><br />
                          2. Adicione a variável de ambiente <code className="bg-yellow-100 px-1 py-0.5 rounded">OPENAI_API_KEY</code> no Supabase
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}