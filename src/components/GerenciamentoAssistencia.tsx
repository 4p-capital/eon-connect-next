"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  LayoutGrid, 
  User, 
  Building2, 
  Wrench, 
  Phone, 
  Mail,
  Image as ImageIcon,
  Clock,
  Calendar,
  Calendar as CalendarIcon,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Plus,
  BarChart3,
  CheckCircle2,
  Check,
  Upload,
  X,
  History,
  Edit
} from 'lucide-react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { DashboardAssistencia } from '@/components/DashboardAssistencia';
import { CalendarioAssistencia } from '@/components/CalendarioAssistencia';
import { HistoricoAssistencias } from '@/components/HistoricoAssistencias';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

export interface Solicitacao {
  id: number | string; // 🔑 Pode ser number (normal) ou string (finalizadas: "finalizada-123")
  id_assistencia_original?: number; // 📋 ID original da assistência (apenas para finalizadas)
  proprietario: string;
  email: string;
  cpf: string;
  telefone: string;
  bloco: string;
  unidade: string;
  empreendimento: string;
  descricao_cliente: string;
  categoria_reparo: string;
  url_foto: string | null; // 📸 Campo mantido para compatibilidade (carregado sob demanda)
  tem_foto: boolean; // 📸 Indica se tem foto, sem carregar o base64
  status_chamado: string;
  created_at: string;
  data_vistoria: string | null;
  data_reparo: string | null;
  idempresa: number | null;
  empresa_nome: string | null;
  situacao?: string; // 📝 Campo para controlar Ativo/Desqualificado
  // Campos adicionais para assistências finalizadas
  id_finalizacao?: number;
  responsaveis?: string[];
  providencias?: string;
  nps?: number | null;
  foto_reparo?: string;
  data_finalizacao?: string;
  created_at_finalizacao?: string; // 📅 Data de criação do registro de finalização
  // Campos de análise GPT
  gpt_classificacao?: 'Moderado' | 'Médio' | 'Crítico' | null;
  gpt_analise?: string | null;
  // Campos do termo de assistência (tabela termos_assistencia)
  termo_id?: number | null;
  termo_pdf_path?: string | null;
  enviado_sienge?: boolean;
  data_envio_sienge?: string | null;
}

const COLUNAS = [
  { 
    id: 'Abertos', 
    titulo: 'Abertos', 
    cor: 'bg-gray-900',
    corClara: 'bg-gray-100',
    corTexto: 'text-gray-900',
    corBadge: 'bg-gray-900',
    corTextoBadge: 'text-white'
  },
  { 
    id: 'Vistoria agendada', 
    titulo: 'Vistoria agendada', 
    cor: 'bg-gray-700',
    corClara: 'bg-gray-100',
    corTexto: 'text-gray-700',
    corBadge: 'bg-gray-700',
    corTextoBadge: 'text-white'
  },
  { 
    id: 'Reparo agendado', 
    titulo: 'Reparo agendado', 
    cor: 'bg-gray-600',
    corClara: 'bg-gray-100',
    corTexto: 'text-gray-600',
    corBadge: 'bg-gray-600',
    corTextoBadge: 'text-white'
  },
  { 
    id: 'Aguardando assinatura', 
    titulo: 'Aguardando assinatura', 
    cor: 'bg-gray-500',
    corClara: 'bg-gray-100',
    corTexto: 'text-gray-500',
    corBadge: 'bg-gray-500',
    corTextoBadge: 'text-white'
  }
];

// Função para obter data/hora mínima (agora)
const getMinDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Verificar se a solicitação foi criada nas últimas 2 horas
const isNovo = (createdAt: string): boolean => {
  const dataAbertura = new Date(createdAt);
  const agora = new Date();
  const diferencaHoras = (agora.getTime() - dataAbertura.getTime()) / (1000 * 60 * 60);
  return diferencaHoras <= 2;
};

interface GerenciamentoAssistenciaProps {
  onNavigate?: (route: string) => void;
}

// Re-export para compatibilidade - agora usa react-router internamente

// Componente para seleção de data com popover
function DateTimePicker({ 
  label, 
  value, 
  onConfirm, 
  iconColor = 'text-gray-900',
  buttonColor = 'bg-black hover:bg-gray-800',
  showAsEditButton = false
}: { 
  label: string; 
  value: string | null; 
  onConfirm: (date: string) => Promise<void>;
  iconColor?: string;
  buttonColor?: string;
  showAsEditButton?: boolean;
}) {
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [horario, setHorario] = useState(() => {
    if (value) {
      const data = new Date(value);
      return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
    }
    return '09:00';
  });

  const formatarDataHora = (dataString: string | null) => {
    if (!dataString) return '';
    try {
      const data = new Date(dataString);
      if (isNaN(data.getTime())) return '';
      // 🌎 Formatar no fuso horário de São Paulo (UTC-3)
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
    } catch {
      return '';
    }
  };

  const confirmar = async () => {
    if (!dataSelecionada) return;
    
    const [horas, minutos] = horario.split(':');
    
    // 🌎 Criar data no fuso horário de São Paulo (UTC-3)
    const ano = dataSelecionada.getFullYear();
    const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionada.getDate()).padStart(2, '0');
    const dataISO = `${ano}-${mes}-${dia}T${horas}:${minutos}:00-03:00`;
    
    console.log('📅 Data confirmada (São Paulo):', dataISO);
    
    try {
      await onConfirm(dataISO);
      setPopoverAberto(false);
    } catch (error) {
      console.error('Erro ao confirmar data:', error);
    }
  };

  return (
    <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
      <PopoverTrigger asChild>
        {showAsEditButton ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            title="Editar data"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-left text-xs h-10 font-normal"
          >
            <Calendar className={`mr-2 h-4 w-4 ${iconColor}`} />
            {value ? formatarDataHora(value) : `Selecionar ${label.toLowerCase()}`}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          <CalendarComponent
            mode="single"
            selected={dataSelecionada}
            onSelect={setDataSelecionada}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
          />
          <div className="space-y-2 px-1">
            <Label className="text-xs">Horário</Label>
            <Input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="text-xs"
            />
          </div>
          <Button
            onClick={confirmar}
            disabled={!dataSelecionada}
            className={`w-full ${buttonColor} text-white`}
            size="sm"
          >
            <Check className="mr-2 h-4 w-4" />
            {showAsEditButton ? 'Atualizar' : 'Confirmar'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GerenciamentoAssistencia() {
  console.log('🔵 GerenciamentoAssistencia: Renderizando componente');
  
  const router = useRouter();
  
  // 🔒 Proteção de acesso — submenu "Gerenciar" de Assistência
  const { hasPermission, loading: permissionLoading } = usePermissionGuard(
    'assistencia.gerenciar'
  );

  // ⚠️ IMPORTANTE: Todos os hooks devem vir ANTES de qualquer return condicional
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'kanban' | 'calendario' | 'dashboard' | 'historico'>('kanban');
  const isReloadingRef = useRef(false);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMaisPaginas, setTemMaisPaginas] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [contagemPorStatus, setContagemPorStatus] = useState<Record<string, number>>({});
  
  // Estados para o Dialog de Finalização
  const [solicitacaoParaFinalizar, setSolicitacaoParaFinalizar] = useState<Solicitacao | null>(null);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [providencias, setProvidencias] = useState('');
  const [fotoReparo, setFotoReparo] = useState<File | null>(null);
  const [previewFotoReparo, setPreviewFotoReparo] = useState<string | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (hasPermission && !permissionLoading) {
      carregarSolicitacoes();
    }
  }, [hasPermission, permissionLoading]);

  // Se não tem permissão, o hook já redirecionou - apenas mostrar loading
  if (permissionLoading || !hasPermission) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // 🤖 Buscar análises GPT existentes e mesclar com solicitações
  const fetchGptAnalyses = async (ids: number[]) => {
    try {
      if (ids.length === 0) return;
      const idsStr = ids.join(',');
      console.log(`🤖 Buscando análises GPT para ${ids.length} chamados...`);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/ai/analyses?ids=${idsStr}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (!response.ok) {
        console.warn(`⚠️ Erro ${response.status} ao buscar análises GPT`);
        return;
      }
      const result = await response.json();
      if (result.success && result.data) {
        const analyses = result.data as Record<number, { classificacao: string; analise: string }>;
        console.log(`✅ ${Object.keys(analyses).length} análises GPT encontradas`);
        setSolicitacoes(prev =>
          prev.map(sol => {
            const realId = typeof sol.id === 'string' && sol.id.startsWith('finalizada-')
              ? sol.id_assistencia_original
              : typeof sol.id === 'number' ? sol.id : parseInt(String(sol.id));
            if (realId && analyses[realId]) {
              return {
                ...sol,
                gpt_classificacao: analyses[realId].classificacao as Solicitacao['gpt_classificacao'],
                gpt_analise: analyses[realId].analise,
              };
            }
            return sol;
          })
        );
      }
    } catch (err) {
      console.warn('⚠️ Erro ao buscar análises GPT:', err);
    }
  };

  const carregarSolicitacoes = async (resetar = true) => {
    // Prevenir múltiplos recarregamentos simultâneos
    if (isReloadingRef.current) {
      console.log('⚠️ Recarregamento já em andamento, ignorando chamada duplicada');
      return;
    }

    try {
      isReloadingRef.current = true;
      
      // Se resetar = true, é uma recarga completa (volta pra página 1)
      if (resetar) {
        setLoading(true);
        setPaginaAtual(1);
      } else {
        setCarregandoMais(true);
      }
      
      setError(null);

      const ITENS_POR_PAGINA = 50;
      const paginaParaCarregar = resetar ? 1 : paginaAtual + 1;
      console.log(`=== CARREGANDO SOLICITAÇÕES VIA BACKEND - Página ${paginaParaCarregar} (${ITENS_POR_PAGINA} itens/página) ===`);

      // ⚡ PAGINAÇÃO: Carregar 50 registros por vez
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia?page=${paginaParaCarregar}&limit=${ITENS_POR_PAGINA}`;
      
      console.log('URL do backend:', url);
      console.log('ProjectId:', projectId);
      console.log('PublicAnonKey disponível:', publicAnonKey ? 'Sim' : 'Não');

      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (fetchError) {
        console.error('❌ Erro de rede ao buscar solicitações:', fetchError);
        throw new Error(`Erro de rede: Não foi possível conectar ao servidor. Verifique sua conexão com a internet.`);
      }

      console.log('Status da resposta:', response.status);
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta do backend:', errorText);
        throw new Error(`Erro ao carregar dados: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Resposta do backend:', result);
      console.log('Tipo de result:', typeof result);
      console.log('É array?', Array.isArray(result));
      console.log('Tem propriedade data?', 'data' in result);

      let solicitacoesAtivas: Solicitacao[] = [];

      // ⚡ NOVO FORMATO: { data, pagination }
      if (result.data && Array.isArray(result.data)) {
        console.log(`✅ ${result.data.length} solicitações carregadas (Página ${paginaParaCarregar})`);
        console.log(`📊 Total no banco: ${result.pagination.total} total (${result.pagination.totalAtivos} ativos, ${result.pagination.totalDesqualificados} desqualificados)`);
        
        // Processar dados para extrair o nome da empresa do objeto aninhado
        // (backend já filtra por situacao='Ativo' e consulta por status independente)
        solicitacoesAtivas = result.data.map((item: any) => ({
          ...item,
          empresa_nome: item.Empresa?.nome || null
        }));
        
        console.log(`✅ ${solicitacoesAtivas.length} solicitações processadas`);
        
        // Atualizar informações de paginação usando dados do backend
        setTotalRegistros(result.pagination.totalAtivos || 0);
        setTemMaisPaginas(result.pagination.hasMore === true);
        
        // 📊 Atualizar contagem por status (totais reais do banco)
        if (result.pagination.contagemPorStatus) {
          setContagemPorStatus(result.pagination.contagemPorStatus);
        }
        
        if (!resetar) {
          // Se não está resetando, incrementar a página atual
          setPaginaAtual(paginaParaCarregar);
        }
      } 
      // RETROCOMPATIBILIDADE: Array direto
      else if (Array.isArray(result)) {
        console.log(`✓ ${result.length} solicitações carregadas (formato antigo)`);
        solicitacoesAtivas = result;
        setTemMaisPaginas(false);
      } 
      // FALLBACK: Formato legado
      else if (result.solicitacoes && Array.isArray(result.solicitacoes)) {
        console.log(`✓ ${result.solicitacoes.length} solicitações carregadas (fallback)`);
        solicitacoesAtivas = result.solicitacoes;
        setTemMaisPaginas(false);
      } else {
        console.warn('Resposta sem dados válidos:', result);
        solicitacoesAtivas = [];
        setTemMaisPaginas(false);
      }

      // 🆕 BUSCAR ASSISTÊNCIAS FINALIZADAS COM STATUS "Aguardando assinatura"
      // ⚠️ IMPORTANTE: Só buscar finalizadas na primeira página (resetar = true)
      console.log('=== CARREGANDO ASSISTÊNCIAS FINALIZADAS (Aguardando assinatura) ===');
      
      if (resetar) {
        try {
          const urlFinalizadas = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada?status=Aguardando assinatura`;
          
          // 🔧 FIX v5: Adicionar timeout de 15s para evitar hanging
          const controllerFin = new AbortController();
          const timerFin = setTimeout(() => controllerFin.abort(), 15000);
          const responseFinalizadas = await fetch(urlFinalizadas, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            signal: controllerFin.signal,
          });
          clearTimeout(timerFin);

          if (responseFinalizadas.ok) {
            const resultFinalizadas = await responseFinalizadas.json();
            console.log('Resposta de assistências finalizadas:', resultFinalizadas);
            
            if (resultFinalizadas.data && Array.isArray(resultFinalizadas.data)) {
              console.log(`✅ ${resultFinalizadas.data.length} registros retornados pelo endpoint`);
              
              // 🔧 FIX v9: Filtro de segurança - garantir que só inclui status "Aguardando assinatura"
              const apenasAguardando = resultFinalizadas.data.filter(
                (f: any) => f.status === 'Aguardando assinatura'
              );
              console.log(`🔍 Filtro: ${apenasAguardando.length}/${resultFinalizadas.data.length} são "Aguardando assinatura" (excluídos ${resultFinalizadas.data.length - apenasAguardando.length} finalizados)`);

              // Para cada assistência com status "Aguardando assinatura", buscar os dados completos
              const assistenciasAguardandoAssinatura = await Promise.all(
                apenasAguardando.map(async (finalizada: any) => {
                  try {
                    // Buscar dados da assistência original
                    const urlAssistencia = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia/${finalizada.id_assistencia}`;
                    // 🔧 FIX v5: Timeout de 10s por request individual
                    const ctrlAss = new AbortController();
                    const tmrAss = setTimeout(() => ctrlAss.abort(), 10000);
                    const respAssistencia = await fetch(urlAssistencia, {
                      headers: {
                        'Authorization': `Bearer ${publicAnonKey}`,
                      },
                      signal: ctrlAss.signal,
                    });
                    clearTimeout(tmrAss);
                    
                    if (respAssistencia.ok) {
                      const assistenciaOriginal = await respAssistencia.json();
                      
                      // Mesclar dados da assistência original com dados da finalização
                      // ⚠️ IMPORTANTE: Usar ID único para evitar conflito de keys no React
                      return {
                        ...assistenciaOriginal.data,
                        id: `finalizada-${finalizada.id}`, // 🔑 ID único composto para evitar duplicatas
                        id_assistencia_original: assistenciaOriginal.data.id, // Manter referência ao ID original
                        status_chamado: 'Aguardando assinatura',
                        responsaveis: finalizada.responsaveis,
                        providencias: finalizada.providencias,
                        nps: finalizada.nps,
                        id_finalizacao: finalizada.id,
                        created_at_finalizacao: finalizada.created_at, // 📅 Data de criação da finalização
                        empresa_nome: assistenciaOriginal.data.Empresa?.nome || null, // Extrair nome da empresa
                      };
                    }
                    
                    return null;
                  } catch (error) {
                    console.error(`Erro ao buscar assistência ${finalizada.id_assistencia}:`, error);
                    return null;
                  }
                })
              );
              
              // Filtrar nulls e adicionar às solicitações ativas
              const assistenciasValidas = assistenciasAguardandoAssinatura.filter(Boolean) as Solicitacao[];
              console.log(`✅ ${assistenciasValidas.length} assistências aguardando assinatura processadas`);

              // 🔧 DEDUPLICAÇÃO: Remover da lista ativa os chamados que já têm registro finalizado
              // Isso evita que o card apareça SEM dados de finalização (responsáveis, providências, NPS)
              const idsOriginaisFinalizados = new Set(
                assistenciasValidas.map(a => a.id_assistencia_original).filter(Boolean)
              );
              solicitacoesAtivas = solicitacoesAtivas.filter(s => {
                const idNumerico = typeof s.id === 'number' ? s.id : parseInt(String(s.id));
                return !idsOriginaisFinalizados.has(idNumerico);
              });
              console.log(`🔄 Deduplicação: ${idsOriginaisFinalizados.size} registros ativos substituídos por versões finalizadas`);

              // Combinar as solicitações ativas com as aguardando assinatura (agora sem duplicatas)
              solicitacoesAtivas = [...solicitacoesAtivas, ...assistenciasValidas];
            }
          } else {
            const errorBody = await responseFinalizadas.text().catch(() => 'sem corpo');
            console.warn(`❌ Erro ao buscar assistências finalizadas (status ${responseFinalizadas.status}): ${errorBody}`);
          }
        } catch (errorFinalizadas) {
          console.error('❌ Erro ao buscar assistências finalizadas:', errorFinalizadas);
          console.warn('⚠️ Continuando sem assistências finalizadas...');
        }
      } else {
        console.log('⏭️ Pulando busca de finalizadas (carregando mais páginas)');
      }

      // Se está resetando, substituir todas as solicitações
      // Se está carregando mais, adicionar às existentes
      if (resetar) {
        setSolicitacoes(solicitacoesAtivas);
      } else {
        setSolicitacoes(prev => [...prev, ...solicitacoesAtivas]);
      }
      
      setError(null);

      // 🤖 Buscar análises GPT existentes para os chamados carregados (fire-and-forget)
      const idsParaAnalise = solicitacoesAtivas
        .map(s => {
          if (typeof s.id === 'string' && s.id.startsWith('finalizada-')) {
            return s.id_assistencia_original;
          }
          return typeof s.id === 'number' ? s.id : parseInt(String(s.id));
        })
        .filter((id): id is number => typeof id === 'number' && !isNaN(id));

      if (idsParaAnalise.length > 0) {
        fetchGptAnalyses(idsParaAnalise).catch(err => {
          console.warn('⚠️ Erro ao buscar análises GPT (não crítico):', err);
        });
      }

    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao carregar dados');
    } finally {
      setLoading(false);
      setCarregandoMais(false);
      // Delay antes de permitir novo recarregamento
      setTimeout(() => {
        isReloadingRef.current = false;
      }, 300);
    }
  };

  // Função para carregar mais registros
  const carregarMaisSolicitacoes = async () => {
    if (!temMaisPaginas || carregandoMais || isReloadingRef.current) {
      console.log('⚠️ Não pode carregar mais: temMaisPaginas=', temMaisPaginas, 'carregandoMais=', carregandoMais);
      return;
    }
    
    console.log('📥 Carregando mais solicitações...');
    await carregarSolicitacoes(false);
  };

  const atualizarStatus = async (id: number | string, novoStatus: string) => {
    try {
      console.log(`=== ATUALIZANDO STATUS VIA BACKEND ===`);
      console.log(`ID recebido: ${id}, Novo Status: ${novoStatus}`);

      // 🔑 Se o ID for composto (string começando com "finalizada-"), extrair o ID original
      let idReal = id;
      if (typeof id === 'string' && id.startsWith('finalizada-')) {
        const solicitacao = solicitacoes.find(s => s.id === id);
        if (solicitacao?.id_assistencia_original) {
          idReal = solicitacao.id_assistencia_original;
          console.log(`📋 ID composto detectado. Usando ID original: ${idReal}`);
        }
      }

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia/${idReal}/status`;
      console.log('URL:', url);

      const requestBody = { status_chamado: novoStatus };
      console.log('Request body:', requestBody);

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }).catch(err => {
        console.error('Erro de rede ao fazer fetch:', err);
        throw new Error(`Erro de conexão: ${err.message}`);
      });

      console.log('Status da resposta:', response.status);
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao atualizar (resposta):', errorText);
        throw new Error(`Erro ao atualizar status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✓ Status atualizado com sucesso!', data);

      // Atualizar estado local
      setSolicitacoes(prev =>
        prev.map(sol => sol.id === id ? { ...sol, status_chamado: novoStatus } : sol)
      );

    } catch (error) {
      console.error('=== ERRO COMPLETO ===');
      console.error('Tipo:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Mensagem:', error instanceof Error ? error.message : String(error));
      console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
      
      alert(`Erro ao atualizar status:\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\nVerifique o console para mais detalhes.`);
    }
  };

  const desqualificarAssistencia = async (id: number | string, motivo: string, justificativa?: string) => {
    try {
      console.log(`=== DESQUALIFICANDO ASSISTÊNCIA #${id} ===`);
      console.log('Motivo:', motivo);
      console.log('Justificativa:', justificativa);
      console.log('Estado ANTES:', solicitacoes.map(s => ({ id: s.id, status: s.status_chamado })));

      // 🔑 Se o ID for composto (string começando com "finalizada-"), extrair o ID original
      let idReal = id;
      if (typeof id === 'string' && id.startsWith('finalizada-')) {
        const solicitacao = solicitacoes.find(s => s.id === id);
        if (solicitacao?.id_assistencia_original) {
          idReal = solicitacao.id_assistencia_original;
          console.log(`📋 ID composto detectado. Usando ID original: ${idReal}`);
        }
      }

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia/${idReal}/desqualificar`;
      console.log('URL:', url);

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ motivo, justificativa }),
      });

      console.log('Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao desqualificar:', errorText);
        throw new Error(`Erro ao desqualificar: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✓ Assistência desqualificada com sucesso!', data);

      // Remover da lista local
      console.log(`Removendo assistência #${id} da lista...`);
      setSolicitacoes(prev => {
        const novaLista = prev.filter(sol => sol.id !== id);
        console.log('Estado DEPOIS:', novaLista.map(s => ({ id: s.id, status: s.status_chamado })));
        return novaLista;
      });
      
      toast.success('Assistência desqualificada com sucesso!');

    } catch (error) {
      console.error('=== ERRO AO DESQUALIFICAR ===');
      console.error('Mensagem:', error instanceof Error ? error.message : String(error));
      
      toast.error(`Erro ao desqualificar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const formatarData = (data: string) => {
    try {
      // 🌎 Formatar no fuso horário de São Paulo (UTC-3)
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
    } catch {
      return data;
    }
  };

  // Funções para o Dialog de Finalização
  const abrirDialogFinalizar = (sol: Solicitacao) => {
    setSolicitacaoParaFinalizar(sol);
    setResponsaveis([]);
    setProvidencias('');
    setFotoReparo(null);
    setPreviewFotoReparo(null);
    setNps(null);
    setMensagemErro(null);
    setMensagemSucesso(null);
  };

  const fecharDialogFinalizar = () => {
    setSolicitacaoParaFinalizar(null);
    setResponsaveis([]);
    setProvidencias('');
    setFotoReparo(null);
    setPreviewFotoReparo(null);
    setNps(null);
    setMensagemErro(null);
    setMensagemSucesso(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoReparo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewFotoReparo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removerFoto = () => {
    setFotoReparo(null);
    setPreviewFotoReparo(null);
  };

  const toggleResponsavel = (nome: string) => {
    setResponsaveis(prev => 
      prev.includes(nome) 
        ? prev.filter(r => r !== nome)
        : [...prev, nome]
    );
  };

  const finalizarChamado = async () => {
    if (!solicitacaoParaFinalizar) return;
    
    // Validar campos obrigatórios
    if (responsaveis.length === 0 || !providencias.trim() || !fotoReparo || !nps) {
      setMensagemErro('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setCarregando(true);
      setMensagemErro(null);
      
      console.log('=== INICIANDO FINALIZAÇÃO DE ASSISTÊNCIA ===');
      console.log('ID da assistência:', solicitacaoParaFinalizar.id);
      console.log('Responsáveis selecionados:', responsaveis);
      console.log('Providências (length):', providencias.length);
      console.log('Foto selecionada:', fotoReparo?.name);
      
      // Converter foto para base64
      const fotoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fotoReparo);
      });

      console.log('Foto convertida para base64 (tamanho):', fotoBase64.length);

      // ✅ REMOVIDO id_assistencia do body - agora vai na URL
      const requestBody = {
        responsaveis: responsaveis,
        providencias: providencias, // ✅ PLURAL - igual ao nome da coluna no banco
        foto_reparo: fotoBase64,
        nps: nps,
        cpf_assistencia: solicitacaoParaFinalizar.cpf, // CPF do cliente
      };

      console.log('Dados que serão enviados:', {
        ...requestBody,
        foto_reparo: `[BASE64 - ${fotoBase64.length} caracteres]`
      });

      // ID vai como parâmetro de URL
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${solicitacaoParaFinalizar.id}`;
      console.log('URL do endpoint:', url);
      console.log('🚀 Enviando requisição para o servidor...');
      
      // Enviar dados para o servidor
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(requestBody),
      }).catch(error => {
        console.error('❌ ERRO DE REDE ao fazer fetch:', error);
        throw new Error(`Erro de conexão com o servidor: ${error.message}`);
      });

      console.log('✅ Resposta recebida!');
      console.log('Status da resposta:', response.status);
      console.log('Response OK?', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro retornado pelo servidor (text):', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
        }
        
        console.error('Erro retornado pelo servidor (parsed):', errorData);
        throw new Error(errorData.details || errorData.error || `Erro ${response.status} ao finalizar assistência`);
      }

      const resultado = await response.json();
      console.log('=== ASSISTÊNCIA FINALIZADA COM SUCESSO ===');
      console.log('Resposta do servidor:', resultado);

      // Atualizar a lista de solicitações localmente
      setSolicitacoes(prev =>
        prev.map(sol =>
          sol.id === solicitacaoParaFinalizar.id
            ? { ...sol, status_chamado: 'Aguardando assinatura' }
            : sol
        )
      );

      // Fechar dialog e limpar estados
      alert(`✅ Assistência Finalizada com Sucesso!\n\nChamado #${solicitacaoParaFinalizar.id}\nStatus: Aguardando assinatura\n\nResponsáveis:\n${responsaveis.map(r => `• ${r}`).join('\n')}`);
      
      // Mostrar mensagem de sucesso
      toast.success('Assistência finalizada!', {
        description: 'Chamado movido para aguardar assinatura.',
      });
      
      // Fechar o dialog de finalização
      fecharDialogFinalizar();
      
    } catch (error) {
      console.error('=== ERRO AO FINALIZAR ASSISTÊNCIA ===');
      console.error('Erro completo:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao finalizar chamado';
      setMensagemErro(mensagem);
      alert(`❌ Erro ao finalizar assistência:\n\n${mensagem}`);
    } finally {
      setCarregando(false);
    }
  };

  const converterParaInputValue = (dataString: string | null) => {
    if (!dataString) return '';
    try {
      const data = new Date(dataString);
      if (isNaN(data.getTime())) return '';
      return data.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };



  // Função para validar movimento de status
  const validarMovimento = (solicitacao: Solicitacao, statusDestino: string): { permitido: boolean; mensagem?: string } => {
    const statusOrigem = solicitacao.status_chamado;

    // Ordem das etapas
    const ORDEM_ETAPAS = ['Abertos', 'Vistoria agendada', 'Reparo agendado', 'Aguardando assinatura'];
    
    // Regra 2: Validação de movimento apenas para frente
    const indiceOrigem = ORDEM_ETAPAS.indexOf(statusOrigem);
    const indiceDestino = ORDEM_ETAPAS.indexOf(statusDestino);
    
    if (indiceDestino <= indiceOrigem) {
      return {
        permitido: false,
        mensagem: '⚠️ Não é permitido retroceder etapas. O chamado só pode avançar para as próximas etapas.'
      };
    }

    // Validação: de "Abertos" para "Vistoria agendada" requer data_vistoria
    if (statusOrigem === 'Abertos' && statusDestino === 'Vistoria agendada') {
      if (!solicitacao.data_vistoria) {
        return {
          permitido: false,
          mensagem: 'Para mover para "Vistoria agendada", é necessário agendar a data da vistoria.'
        };
      }
    }

    // Validação: de "Vistoria agendada" para "Reparo agendado" requer data_reparo
    if (statusOrigem === 'Vistoria agendada' && statusDestino === 'Reparo agendado') {
      if (!solicitacao.data_reparo) {
        return {
          permitido: false,
          mensagem: 'Para mover para "Reparo agendado", é necessário agendar a data do reparo.'
        };
      }
    }

    return { permitido: true };
  };

  // Atualizar data na lista




  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
              <p className="text-gray-500">Carregando solicitações...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('🔴 GerenciamentoAssistencia: Renderizando estado de erro');
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-black p-2.5 rounded-xl shadow-sm">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-[26px] text-gray-900">
              Erro ao Carregar Dados
            </h1>
          </div>
          
          <Alert variant="destructive" className="border-2">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-[15px]">
              <strong>Erro de conexão:</strong> {error}
              <br /><br />
              <strong>Possíveis causas:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Sem conexão com a internet</li>
                <li>Servidor backend temporariamente indisponível</li>
                <li>Problemas de configuração no Supabase</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => carregarSolicitacoes(true)} 
              className="gap-2 bg-black hover:bg-gray-800 text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="gap-2"
            >
              Recarregar página
            </Button>
          </div>
        </div>
      </div>
    );
  }

  console.log('🟢 GerenciamentoAssistencia: Renderizando conteúdo principal');
  
  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 pt-6 md:pt-8 pb-20 md:pb-8 overflow-x-hidden">
      <div className="w-full space-y-6">
          {/* Título Principal */}
          <div className="flex items-center gap-3">
            <div className="bg-black p-2.5 rounded-xl shadow-sm">
              <LayoutGrid className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-[26px] text-gray-900">
              Gerenciamento pós obra
            </h1>
          </div>

          {/* Informações e Botões */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-gray-600 text-[14px]">
              Total de <span className="font-semibold text-black">{totalRegistros > 0 ? totalRegistros : solicitacoes.length}</span> solicitações ativas
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={() => router.push('/solicitacao-assistencia-tecnica')}
                className="gap-2 bg-black hover:bg-gray-800 text-white shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nova Solicitação
              </Button>
              <Button
                onClick={() => carregarSolicitacoes(true)}
                variant="outline"
                className="gap-2 border-2 hover:bg-gray-50 transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Debug Info */}
          {solicitacoes.length === 0 && (
            <Alert className="bg-[#FEF3C7] border border-amber-200 shadow-sm">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Nenhum chamado encontrado. Verifique se há dados cadastrados ou se o servidor backend está funcionando corretamente.
              </AlertDescription>
            </Alert>
          )}

          {/* Views Tabs */}
          <Tabs defaultValue="kanban" className="w-full" onValueChange={(v) => setActiveView(v as 'kanban' | 'calendario' | 'dashboard' | 'historico')}>
            <TabsList className="grid w-full max-w-4xl grid-cols-4 bg-white p-1.5 h-auto shadow-sm border border-gray-200 rounded-xl">
              <TabsTrigger value="kanban" className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-3 rounded-lg transition-all duration-200">
                <LayoutGrid className="h-5 w-5" />
                <span className="hidden md:inline">Quadro</span>
              </TabsTrigger>
              <TabsTrigger value="calendario" className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-3 rounded-lg transition-all duration-200">
                <CalendarIcon className="h-5 w-5" />
                <span className="hidden md:inline">Calendário</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-3 rounded-lg transition-all duration-200">
                <BarChart3 className="h-5 w-5" />
                <span className="hidden md:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center justify-center gap-2 data-[state=active]:bg-black data-[state=active]:text-white py-3 rounded-lg transition-all duration-200">
                <History className="h-5 w-5" />
                <span className="hidden md:inline">Histórico</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-6">
              <KanbanBoard
                solicitacoes={solicitacoes}
                colunas={COLUNAS}
                onAtualizarStatus={atualizarStatus}
                formatarData={formatarData}
                onAtualizarSolicitacao={(id, campo, valor) => {
                  setSolicitacoes(prev =>
                    prev.map(sol => sol.id === id ? { ...sol, [campo]: valor } : sol)
                  );
                }}
                onRecarregarDados={carregarSolicitacoes}
                onDesqualificar={desqualificarAssistencia}
                onCarregarMais={carregarMaisSolicitacoes}
                temMaisPaginas={temMaisPaginas}
                carregandoMais={carregandoMais}
                totalCarregados={solicitacoes.length}
                totalRegistros={totalRegistros}
                contagemPorStatus={contagemPorStatus}
              />
            </TabsContent>

            <TabsContent value="calendario" className="mt-6">
              <CalendarioAssistencia solicitacoes={solicitacoes} />
            </TabsContent>

            <TabsContent value="dashboard" className="mt-6">
              <DashboardAssistencia />
            </TabsContent>

            <TabsContent value="historico" className="mt-6">
              <HistoricoAssistencias onRecarregarKanban={carregarSolicitacoes} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialog para Finalizar Chamado */}
        <Dialog open={!!solicitacaoParaFinalizar} onOpenChange={fecharDialogFinalizar}>
          <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden">
            <DialogTitle className="sr-only">Finalizar Chamado #{solicitacaoParaFinalizar?.id}</DialogTitle>
            <DialogDescription className="sr-only">
              Revise os dados e preencha as informações do reparo realizado
            </DialogDescription>
            
            {/* Header */}
            <div className="bg-white px-6 py-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#10B981] rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Finalizar Chamado #{solicitacaoParaFinalizar?.id}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Revise os dados e preencha as informações do reparo</p>
                </div>
              </div>
            </div>
            
            <ScrollArea className="max-h-[calc(95vh-180px)] px-6">
              <div className="space-y-5 py-6">
                {/* Mensagens de erro e sucesso */}
                {mensagemErro && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{mensagemErro}</AlertDescription>
                  </Alert>
                )}
                
                {mensagemSucesso && (
                  <Alert className="mb-4 border-green-500 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{mensagemSucesso}</AlertDescription>
                  </Alert>
                )}

                {/* Resumo dos Dados - Card Moderno */}
                {solicitacaoParaFinalizar && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-green-600 rounded-full"></div>
                        <h3 className="font-semibold text-sm text-gray-900">Resumo da Solicitação</h3>
                      </div>
                      
                      <div className="bg-[#F9FAFB] rounded-xl p-5 border border-[#E5E7EB] shadow-sm space-y-4">
                        {/* Informações pessoais */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                              <User className="h-3 w-3" />
                              Proprietário
                            </Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.proprietario}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                              <Phone className="h-3 w-3" />
                              Telefone
                            </Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.telefone}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              Email
                            </Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 truncate">
                              {solicitacaoParaFinalizar.email}
                            </div>
                          </div>
                        </div>

                        {/* Informações do imóvel */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                              <Building2 className="h-3 w-3" />
                              Empreendimento
                            </Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.empreendimento}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Bloco</Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.bloco}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Unidade</Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.unidade}
                            </div>
                          </div>
                        </div>

                        {/* Informações do reparo */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                              <Wrench className="h-3 w-3" />
                              Categoria
                            </Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.categoria_reparo}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 col-span-2">
                            <Label className="text-xs font-medium text-gray-500">Empresa Responsável</Label>
                            <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                              {solicitacaoParaFinalizar.empresa_nome || 'Não atribuído'}
                            </div>
                          </div>
                        </div>

                        {/* Descrição */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500">Descrição do Problema</Label>
                          <div className="bg-white rounded-lg px-3 py-2.5 text-sm text-gray-700 border border-gray-200 min-h-[60px]">
                            {solicitacaoParaFinalizar.descricao_cliente}
                          </div>
                        </div>

                        {/* Datas */}
                        <div className="grid grid-cols-2 gap-3">
                          {solicitacaoParaFinalizar.data_vistoria && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                Data Vistoria
                              </Label>
                              <div className="bg-green-50 rounded-lg px-3 py-2 text-sm font-medium text-green-700 border border-green-200">
                                {formatarData(solicitacaoParaFinalizar.data_vistoria)}
                              </div>
                            </div>
                          )}
                          
                          {solicitacaoParaFinalizar.data_reparo && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                Data Reparo
                              </Label>
                              <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200">
                                {formatarData(solicitacaoParaFinalizar.data_reparo)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Campos Editáveis - Card Moderno */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-green-600 rounded-full"></div>
                        <h3 className="font-semibold text-sm text-gray-900">Informações do Reparo</h3>
                      </div>

                      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-5">
                        {/* 1. Responsável pelo reparo - Multiselect */}
                        <div className="space-y-2.5">
                          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <User className="h-4 w-4 text-green-600" />
                            Responsável(is) pelo reparo
                            <span className="text-red-500">*</span>
                          </Label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {['Adroaldo Rodrigues', 'Alessandro Alves', 'André Lopes', 'Edinaldo Abreu', 'Erivaldo', 'Emanuelly', 'Manoel Eziquiel', 'Ruil Rames', 'Paulo Sérgio', 'Raimundo da Cunha', 'Heliton Antônio', 'David Custódio', 'Kaio Vinicius', 'Manoel Francisco', 'Letícia Barcelos', 'Juliana Fonteles', 'Flávio Galdino', 'Rosana', 'Evânia', 'Marta', 'Francisco Paulo'].map((nome) => (
                              <label
                                key={nome}
                                htmlFor={`resp-lista-${nome}`}
                                className={`flex items-center space-x-2.5 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  responsaveis.includes(nome)
                                    ? 'bg-green-50 border-green-500 shadow-sm'
                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <Checkbox
                                  id={`resp-lista-${nome}`}
                                  checked={responsaveis.includes(nome)}
                                  onCheckedChange={() => toggleResponsavel(nome)}
                                  className="h-4 w-4"
                                />
                                <span className={`text-sm ${responsaveis.includes(nome) ? 'font-medium text-green-900' : 'text-gray-700'}`}>
                                  {nome}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 2. Providências tomadas */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-700">
                              Providências tomadas
                              <span className="text-red-500 ml-1">*</span>
                            </Label>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              providencias.length > 300 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {providencias.length}/350
                            </span>
                          </div>
                          <Textarea
                            value={providencias}
                            onChange={(e) => {
                              if (e.target.value.length <= 350) {
                                setProvidencias(e.target.value);
                              }
                            }}
                            placeholder="Descreva detalhadamente as providências tomadas durante o reparo..."
                            className="min-h-[100px] resize-none text-sm border-gray-200 focus:border-black focus:ring-black"
                            maxLength={350}
                          />
                        </div>

                        {/* 3. Foto do reparo realizado */}
                        <div className="space-y-2.5">
                          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4 text-green-600" />
                            Foto do reparo realizado
                            <span className="text-red-500">*</span>
                          </Label>
                          
                          {!previewFotoReparo ? (
                            <div className="relative group">
                              <input
                                type="file"
                                id="foto-reparo-lista"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                              />
                              <label
                                htmlFor="foto-reparo-lista"
                                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer transition-all hover:border-green-500 hover:bg-green-50 group-hover:shadow-md"
                              >
                                <div className="p-3 bg-green-100 rounded-full mb-3 group-hover:bg-green-200 transition-colors">
                                  <Upload className="h-6 w-6 text-green-600" />
                                </div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Clique para fazer upload</p>
                                <p className="text-xs text-gray-500">PNG, JPG até 10MB</p>
                              </label>
                            </div>
                          ) : (
                            <div className="relative group rounded-xl overflow-hidden border-2 border-green-200 shadow-md">
                              <img
                                src={previewFotoReparo}
                                alt="Preview do reparo"
                                className="w-full h-48 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all"></div>
                              <button
                                onClick={removerFoto}
                                className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-all shadow-lg hover:scale-110"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 4. Avaliação do Atendimento (NPS) */}
                        <div className="space-y-2.5">
                          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-green-600" />
                            Nota do Atendimento (1 a 10)
                            <span className="text-red-500">*</span>
                          </Label>
                          <div className="grid grid-cols-10 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((nota) => (
                              <button
                                key={nota}
                                type="button"
                                onClick={() => setNps(nota)}
                                className={`h-12 rounded-lg font-semibold text-sm transition-all duration-150 ${
                                  nps === nota
                                    ? 'bg-[#10B981] text-white shadow-sm scale-110'
                                    : 'bg-[#F3F3F3] text-gray-700 hover:bg-gray-200 hover:scale-105'
                                }`}
                              >
                                {nota}
                              </button>
                            ))}
                          </div>
                          {nps && (
                            <div className="text-center mt-2">
                              <span className="text-sm font-medium text-green-600">
                                ✓ Nota selecionada: {nps}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Footer com botões */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={fecharDialogFinalizar}
                className="px-6"
              >
                Cancelar
              </Button>
              <Button
                onClick={finalizarChamado}
                disabled={responsaveis.length === 0 || !providencias.trim() || !fotoReparo || !nps || carregando}
                className="bg-[#10B981] hover:bg-[#059669] text-white px-6 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {carregando ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar Finalização
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Loading */}
        <Dialog open={carregando} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogTitle className="sr-only">Processando</DialogTitle>
            <DialogDescription className="sr-only">Aguarde enquanto processamos sua solicitação</DialogDescription>
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-gray-900" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Aguarde um momento</h3>
                <p className="text-sm text-gray-600">
                  Processando sua solicitação...
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
  );
}