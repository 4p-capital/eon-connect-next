"use client";

import React, { useState, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
const ChatWhatsApp = lazy(() => import('@/components/ChatWhatsApp').then(m => ({ default: m.ChatWhatsApp })));
import { WebhookResponseModal } from '@/components/WebhookResponseModal';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Wrench, 
  Clock, 
  Calendar,
  Image as ImageIcon,
  AlertCircle,
  Sparkles,
  LayoutGrid,
  CheckCircle2,
  Check,
  Upload,
  X,
  Package,
  Plus,
  XCircle,
  Send,
  RefreshCw,
  Edit,
  Search,
  Hash,
  Brain,
  ShieldAlert,
  Loader2,
  Zap
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Solicitacao } from '@/components/GerenciamentoAssistencia';
import type { TermoDados } from '@/components/TermoAssistenciaPDF';
const TermoAssistenciaViewer = lazy(() => import('@/components/TermoAssistenciaViewer').then(m => ({ default: m.TermoAssistenciaViewer })));
// gerarTermoBlob é importado dinamicamente apenas quando necessário (na função que gera o PDF)
import { FileText, Download, Save } from 'lucide-react';

// Ordem das etapas no Kanban
const ORDEM_ETAPAS = ['Abertos', 'Vistoria agendada', 'Reparo agendado', 'Aguardando assinatura'];

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

// Validar se o movimento é para frente
const validarMovimentoParaFrente = (statusAtual: string, novoStatus: string): boolean => {
  const indiceAtual = ORDEM_ETAPAS.indexOf(statusAtual);
  const indiceNovo = ORDEM_ETAPAS.indexOf(novoStatus);
  return indiceNovo > indiceAtual;
};

// Verificar se a solicitação foi criada nas últimas 2 horas
const isNovo = (createdAt: string): boolean => {
  const dataAbertura = new Date(createdAt);
  const agora = new Date();
  const diferencaHoras = (agora.getTime() - dataAbertura.getTime()) / (1000 * 60 * 60);
  return diferencaHoras <= 2;
};

interface KanbanBoardProps {
  solicitacoes: Solicitacao[];
  colunas: Array<{ 
    id: string; 
    titulo: string; 
    cor: string;
    corClara?: string;
    corTexto?: string;
    corBadge?: string;
    corTextoBadge?: string;
  }>;
  onAtualizarStatus: (id: number | string, novoStatus: string) => void;
  formatarData: (data: string) => string;
  onAtualizarSolicitacao?: (id: number | string, campo: string, valor: string) => void;
  onRecarregarDados?: () => Promise<void>;
  onDesqualificar?: (id: number | string, motivo: string, justificativa?: string) => void;
  onCarregarMais?: () => void;
  temMaisPaginas?: boolean;
  carregandoMais?: boolean;
  totalCarregados?: number;
  totalRegistros?: number;
  contagemPorStatus?: Record<string, number>;
}

interface KanbanCardProps {
  solicitacao: Solicitacao;
  formatarData: (data: string) => string;
  onAtualizarDatas: (id: number | string, campo: 'data_vistoria' | 'data_reparo', valor: string) => void;
  onAtualizarStatus: (id: number | string, novoStatus: string) => void;
  onDesqualificar?: (id: number | string, motivo: string, justificativa?: string) => void;
  onWebhookResponse?: (status: number, response: string) => void;
  onRecarregarDados?: () => Promise<void>;
}

interface KanbanColumnProps {
  coluna: {
    id: string;
    titulo: string;
    cor: string;
    corClara?: string;
    corTexto?: string;
    corBadge?: string;
    corTextoBadge?: string;
  };
  solicitacoes: Solicitacao[];
  onAtualizarStatus: (id: number | string, novoStatus: string) => void;
  onAtualizarDatas: (id: number | string, campo: 'data_vistoria' | 'data_reparo', valor: string) => void;
  formatarData: (data: string) => string;
  onDesqualificar?: (id: number | string, motivo: string, justificativa?: string) => void;
  onWebhookResponse?: (status: number, response: string) => void;
  onRecarregarDados?: () => Promise<void>;
  totalReal?: number;
}

const ItemTypes = {
  CARD: 'card',
};

const MOTIVOS_DESQUALIFICACAO = [
  'Improcedente',
  'Solicitação duplicada',
  'Dados incorretos',
  'Indisponibilidade',
  'Ausência na data da vistoria',
  'Ausência na data do reparo',
  'Falha na comunicação - ausência de resposta',
  'Aguardando chegada do material para reparo',
  'Aguardando execução conforme cronograma',
] as const;

// Função para validar se o card pode ser movido
function validarMovimento(solicitacao: Solicitacao, statusDestino: string): { permitido: boolean; mensagem?: string } {
  const statusOrigem = solicitacao.status_chamado;

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
}

const KanbanCard = memo(function KanbanCard(props: KanbanCardProps) {
  const { solicitacao, formatarData, onAtualizarDatas, onAtualizarStatus, onDesqualificar, onWebhookResponse, onRecarregarDados } = props;
  // Desabilitar drag para cards já finalizados (Aguardando assinatura)
  const podeArrastar = solicitacao.status_chamado !== 'Aguardando assinatura';
  
  // Estados para a modal de foto
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [urlFoto, setUrlFoto] = useState<string | null>(null);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  
  // ═══════════════════════════════════════════════════════════════════
  // 🖼️ FUNÇÃO: Abrir foto do problema (lazy loading via Assistência Técnica.url_foto)
  // ═══════════════════════════════════════════════════════════════════
  const abrirFotoProblema = async () => {
    try {
      setCarregandoFoto(true);
      setMostrarModalFoto(true);
      setUrlFoto(null);
      
      // Resolver ID real (para itens finalizados, usar id_assistencia_original)
      let idParaBuscar: number | string = solicitacao.id;
      if (typeof solicitacao.id === 'string' && solicitacao.id.startsWith('finalizada-')) {
        if (solicitacao.id_assistencia_original) {
          idParaBuscar = solicitacao.id_assistencia_original;
          console.log(`📸 ID composto detectado. Usando ID original: ${idParaBuscar}`);
        } else {
          console.error('❌ ID composto sem id_assistencia_original');
          toast.error('Não foi possível identificar a assistência');
          setMostrarModalFoto(false);
          setCarregandoFoto(false);
          return;
        }
      }
      
      console.log(`📸 Buscando url_foto da Assistência Técnica #${idParaBuscar}...`);
      
      // Buscar url_foto da tabela Assistência Técnica via endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia/${idParaBuscar}/foto`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.url_foto) {
          console.log(`✅ Foto encontrada para assistência #${idParaBuscar}`);
          setUrlFoto(data.url_foto);
        } else {
          console.log(`⚠️ Assistência #${idParaBuscar} não possui foto`);
          // Não fecha a modal - mostra estado "Foto não disponível" dentro dela
        }
      } else {
        console.error(`❌ Erro HTTP ${response.status} ao buscar foto`);
        toast.error('Erro ao carregar foto');
        setMostrarModalFoto(false);
      }
    } catch (error) {
      console.error('Erro ao carregar foto:', error);
      toast.error('Erro ao carregar foto');
      setMostrarModalFoto(false);
    } finally {
      setCarregandoFoto(false);
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // 🤖 FUNÇÃO: Solicitar análise GPT para este chamado
  // ═══════════════════════════════════════════════════════════════════
  const solicitarAnaliseGPT = async () => {
    try {
      setAnalisandoGPT(true);
      
      // Resolver ID real
      let idReal: number | string = solicitacao.id;
      if (typeof solicitacao.id === 'string' && solicitacao.id.startsWith('finalizada-')) {
        if (solicitacao.id_assistencia_original) {
          idReal = solicitacao.id_assistencia_original;
        }
      }
      
      console.log(`🤖 Solicitando análise GPT para chamado #${idReal}...`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/ai/analyze/${idReal}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            descricao_cliente: solicitacao.descricao_cliente,
            categoria_reparo: solicitacao.categoria_reparo,
            empreendimento: solicitacao.empreendimento,
            bloco: solicitacao.bloco,
            unidade: solicitacao.unidade,
            proprietario: solicitacao.proprietario,
          }),
        }
      );
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Atualizar estado local da análise GPT (causa re-render)
        setGptClassificacao(result.data.classificacao);
        setGptAnalise(result.data.analise);
        toast.success(`Análise concluída: ${result.data.classificacao}`);
      }
    } catch (error) {
      console.error('❌ Erro ao solicitar análise GPT:', error);
      toast.error(`Erro na análise: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAnalisandoGPT(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 📅 FUNÇÃO: Validar se passaram 7 dias desde a criação da finalização
  // ═══════════════════════════════════════════════════════════════════
  const passaram7Dias = (): boolean => {
    if (!solicitacao.created_at_finalizacao) {
      return false;
    }
    
    const dataFinalizacao = new Date(solicitacao.created_at_finalizacao);
    const hoje = new Date();
    const diferencaMs = hoje.getTime() - dataFinalizacao.getTime();
    const diferencaDias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));
    
    return diferencaDias >= 7;
  };
  
  // Estado para controlar o loading do botão de finalizar automaticamente
  const [carregandoFinalizacaoAutomatica, setCarregandoFinalizacaoAutomatica] = React.useState(false);
  
  // Estado para controlar o dialog de confirmação de finalização automática
  const [mostrarDialogFinalizarAutomatico, setMostrarDialogFinalizarAutomatico] = React.useState(false);

  // Estado para controlar o visualizador do termo vencido
  const [mostrarPDFViewer, setMostrarPDFViewer] = React.useState(false);
  const [salvandoPDF, setSalvandoPDF] = React.useState(false);
  const [pdfSalvo, setPdfSalvo] = React.useState(false);
  const [verificandoTermo, setVerificandoTermo] = React.useState(false);
  const [termoSalvoUrl, setTermoSalvoUrl] = React.useState<string | null>(null);

  // Estado para controle de envio ao Sienge
  const [enviandoSienge, setEnviandoSienge] = React.useState(false);
  const [enviadoSienge, setEnviadoSienge] = React.useState(solicitacao.enviado_sienge || false);
  const [dataEnvioSienge, setDataEnvioSienge] = React.useState<string | null>(solicitacao.data_envio_sienge || null);
  
  // Estado para erro do Sienge → habilita finalização manual
  const [erroSienge, setErroSienge] = React.useState(false);
  const [erroSiengeMsg, setErroSiengeMsg] = React.useState<string | null>(null);
  const [finalizandoManual, setFinalizandoManual] = React.useState(false);

  // Sincronizar estado do Sienge com props
  React.useEffect(() => {
    if (solicitacao.enviado_sienge !== undefined) {
      setEnviadoSienge(solicitacao.enviado_sienge);
    }
    if (solicitacao.data_envio_sienge) {
      setDataEnvioSienge(solicitacao.data_envio_sienge);
    }
  }, [solicitacao.enviado_sienge, solicitacao.data_envio_sienge]);

  // Verificar se o termo já foi salvo no banco ao abrir o painel PDF
  React.useEffect(() => {
    if (!mostrarPDFViewer || !solicitacao.id_finalizacao) return;
    
    let cancelado = false;
    const verificar = async () => {
      setVerificandoTermo(true);
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${solicitacao.id_finalizacao}/termo-pdf`;
        const resp = await fetch(url, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        if (cancelado) return;
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.pdf_url) {
            console.log('✅ Termo já salvo no banco:', data);
            setPdfSalvo(true);
            setTermoSalvoUrl(data.pdf_url);
          }
        }
      } catch (err) {
        console.error('❌ Erro ao verificar termo salvo:', err);
      } finally {
        if (!cancelado) setVerificandoTermo(false);
      }
    };
    verificar();
    return () => { cancelado = true; };
  }, [mostrarPDFViewer, solicitacao.id_finalizacao]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CARD,
    item: { solicitacao },
    canDrag: podeArrastar,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [podeArrastar, solicitacao]);

  const [drawerOpen, setDrawerOpenLocal] = useState(() => {
    // Na montagem, abrir se a URL tiver ?chamado=<id deste card>
    if (typeof window === "undefined") return false;
    const urlId = new URLSearchParams(window.location.search).get("chamado");
    return urlId === String(solicitacao.id);
  });

  // Sincronizar URL como efeito colateral (sem re-render externo)
  const setDrawerOpen = (open: boolean) => {
    setDrawerOpenLocal(open);
    const params = new URLSearchParams(window.location.search);
    if (open) {
      params.set("chamado", String(solicitacao.id));
    } else {
      params.delete("chamado");
    }
    const qs = params.toString();
    const path = window.location.pathname;
    window.history.replaceState(null, "", qs ? `${path}?${qs}` : path);
  };

  const [mostrarDialogFinalizar, setMostrarDialogFinalizar] = useState(false);
  const [popoverVistoriaAberto, setPopoverVistoriaAberto] = useState(false);
  const [popoverReparoAberto, setPopoverReparoAberto] = useState(false);
  
  // Estados para o formulário de finalização
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [providencias, setProvidencias] = useState('');
  const [fotoReparo, setFotoReparo] = useState<File | null>(null);
  const [previewFotoReparo, setPreviewFotoReparo] = useState<string | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  
  // Estados para pilhas de materiais
  const [itensReparo, setItensReparo] = useState<Array<{
    material: string;
    unidade: string;
    quantidade: string;
  }>>([{ material: '', unidade: '', quantidade: '' }]);
  
  // Estado para loading durante finalização e reenvio
  const [carregando, setCarregando] = useState(false);

  // Estados para modal de preview do termo antes de enviar ao Clicksign
  const [mostrarPreviewTermo, setMostrarPreviewTermo] = useState(false);
  const [dadosTermoPreview, setDadosTermoPreview] = useState<TermoDados | null>(null);
  const [fotoBase64Preview, setFotoBase64Preview] = useState<string | null>(null);
  const [requestBodyPreview, setRequestBodyPreview] = useState<Record<string, unknown> | null>(null);
  const [enviandoClicksign, setEnviandoClicksign] = useState(false);

  // Loading steps para o envio ao Clicksign
  type StepStatus = 'pending' | 'loading' | 'success' | 'error';
  const [envioSteps, setEnvioSteps] = useState<{ label: string; status: StepStatus }[]>([
    { label: 'Registrando finalização', status: 'pending' },
    { label: 'Gerando termo', status: 'pending' },
    { label: 'Enviando para assinatura', status: 'pending' },
  ]);
  
  const [listaMateriais, setListaMateriais] = useState<string[]>([]);
  
  // Estados para o mini-modal de adicionar material
  const [mostrarModalNovoMaterial, setMostrarModalNovoMaterial] = useState(false);
  const [novoMaterialNome, setNovoMaterialNome] = useState('');
  const [salvandoNovoMaterial, setSalvandoNovoMaterial] = useState(false);
  
  const [dataSelecionadaVistoria, setDataSelecionadaVistoria] = useState<Date | undefined>(
    solicitacao.data_vistoria ? new Date(solicitacao.data_vistoria) : undefined
  );
  const [dataSelecionadaReparo, setDataSelecionadaReparo] = useState<Date | undefined>(
    solicitacao.data_reparo ? new Date(solicitacao.data_reparo) : undefined
  );
  const [horarioVistoria, setHorarioVistoria] = useState(() => {
    if (solicitacao.data_vistoria) {
      const data = new Date(solicitacao.data_vistoria);
      return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
    }
    return '09:00';
  });
  const [horarioReparo, setHorarioReparo] = useState(() => {
    if (solicitacao.data_reparo) {
      const data = new Date(solicitacao.data_reparo);
      return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
    }
    return '09:00';
  });

  // Estado para análise GPT
  const [analisandoGPT, setAnalisandoGPT] = useState(false);
  const [gptClassificacao, setGptClassificacao] = useState<'Moderado' | 'Médio' | 'Crítico' | null>(solicitacao.gpt_classificacao || null);
  const [gptAnalise, setGptAnalise] = useState<string | null>(solicitacao.gpt_analise || null);

  // Sincronizar estado local com prop (quando vem do batch fetch)
  React.useEffect(() => {
    if (solicitacao.gpt_classificacao && solicitacao.gpt_classificacao !== gptClassificacao) {
      setGptClassificacao(solicitacao.gpt_classificacao);
    }
    if (solicitacao.gpt_analise && solicitacao.gpt_analise !== gptAnalise) {
      setGptAnalise(solicitacao.gpt_analise);
    }
  }, [solicitacao.gpt_classificacao, solicitacao.gpt_analise]);

  // Estados para desqualificação
  const [showModalDesqualificacao, setShowModalDesqualificacao] = useState(false);
  const [motivoDesqualificacao, setMotivoDesqualificacao] = useState('');
  const [justificativaDesqualificacao, setJustificativaDesqualificacao] = useState('');

  // ✏️ Estados para edição de contato (nome, cpf, email)
  const [editandoContato, setEditandoContato] = useState(false);
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [editNome, setEditNome] = useState(solicitacao.proprietario || '');
  const [editCpf, setEditCpf] = useState(solicitacao.cpf || '');
  const [editEmail, setEditEmail] = useState(solicitacao.email || '');
  // motivosDesqualificacao movido para constante do módulo (MOTIVOS_DESQUALIFICACAO)

  // Buscar materiais quando o dialog abrir
  React.useEffect(() => {
    if (mostrarDialogFinalizar && listaMateriais.length === 0) {
      buscarMateriais();
    }
  }, [mostrarDialogFinalizar]);

  const buscarMateriais = async () => {
    try {
      console.log('🔍 Buscando materiais da tabela materiais_reparo_pos_obra...');
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        console.error('Erro ao buscar materiais:', response.status);
        toast.error('Erro ao carregar lista de materiais');
        return;
      }

      const dados = await response.json();
      console.log('✅ Materiais carregados:', dados);
      
      if (dados.data && Array.isArray(dados.data)) {
        setListaMateriais(dados.data);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar materiais:', error);
      toast.error('Erro ao carregar lista de materiais');
    }
  };

  // 📸 Componente de foto removido conforme solicitação

  const confirmarDesqualificacao = () => {
    if (!motivoDesqualificacao) {
      toast.error('Selecione o motivo da desqualificação');
      return;
    }
    
    // Validar justificativa se o motivo for "Improcedente"
    if (motivoDesqualificacao === 'Improcedente' && !justificativaDesqualificacao.trim()) {
      toast.error('Por favor, informe a justificativa da improcedência');
      return;
    }
    
    if (onDesqualificar) {
      onDesqualificar(solicitacao.id, motivoDesqualificacao, justificativaDesqualificacao);
      setShowModalDesqualificacao(false);
      setMotivoDesqualificacao('');
      setJustificativaDesqualificacao('');
    }
  };

  // ✏️ Formatar CPF enquanto digita
  const formatarCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // ✏️ Salvar dados de contato editados
  const salvarContato = async () => {
    try {
      setSalvandoContato(true);

      // Resolver ID real
      let idReal: number | string = solicitacao.id;
      if (typeof solicitacao.id === 'string' && solicitacao.id.startsWith('finalizada-')) {
        if (solicitacao.id_assistencia_original) {
          idReal = solicitacao.id_assistencia_original;
        } else {
          toast.error('Não foi possível identificar a assistência');
          return;
        }
      }

      const payload: Record<string, string> = {};
      if (editNome.trim() !== solicitacao.proprietario) payload.proprietario = editNome.trim();
      if (editCpf.trim() !== solicitacao.cpf) payload.cpf = editCpf.trim();
      if (editEmail.trim() !== solicitacao.email) payload.email = editEmail.trim();

      if (Object.keys(payload).length === 0) {
        toast.info('Nenhuma alteração detectada');
        setEditandoContato(false);
        return;
      }

      console.log(`✏️ Salvando contato da assistência #${idReal}:`, payload);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia/${idReal}/contato`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erro ao salvar contato:', data);
        toast.error(data.error || 'Erro ao salvar dados de contato');
        return;
      }

      console.log('✅ Contato salvo:', data);
      toast.success('Dados de contato atualizados!');
      setEditandoContato(false);

      // Recarregar dados para refletir alterações
      if (onRecarregarDados) {
        await onRecarregarDados();
      }
    } catch (error) {
      console.error('❌ Erro ao salvar contato:', error);
      toast.error('Erro ao salvar dados de contato');
    } finally {
      setSalvandoContato(false);
    }
  };

  const cancelarEdicaoContato = () => {
    setEditNome(solicitacao.proprietario || '');
    setEditCpf(solicitacao.cpf || '');
    setEditEmail(solicitacao.email || '');
    setEditandoContato(false);
  };

  const handleDesqualificar = () => {
    if (!onDesqualificar) return;
    setShowModalDesqualificacao(true);
  };

  const handleDesqualificarOLD = () => {
    if (!onDesqualificar) return;
    
    const confirmar = window.confirm(
      `Deseja desqualificar a assistência #${solicitacao.id} de ${solicitacao.proprietario}?\n\nEsta ação não poderá ser desfeita.`
    );
    
    if (confirmar) {
      onDesqualificar(solicitacao.id, 'Desqualificado');
    }
  };

  const confirmarDataVistoria = async () => {
    if (!dataSelecionadaVistoria) return;
    
    const [horas, minutos] = horarioVistoria.split(':');
    
    // 🌎 Criar data no fuso horário de São Paulo (UTC-3)
    const ano = dataSelecionadaVistoria.getFullYear();
    const mes = String(dataSelecionadaVistoria.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionadaVistoria.getDate()).padStart(2, '0');
    // 🔧 Enviar sem timezone para o Postgres salvar exatamente o horário informado
    const dataISO = `${ano}-${mes}-${dia} ${horas}:${minutos}:00`;
    
    console.log('📅 Data Vistoria selecionada (São Paulo):', dataISO);
    
    try {
      await onAtualizarDatas(solicitacao.id, 'data_vistoria', dataISO);
      setPopoverVistoriaAberto(false);
    } catch (error) {
      console.error('Erro ao atualizar data da vistoria:', error);
      alert('Erro ao salvar a data. Tente novamente.');
    }
  };

  const confirmarDataReparo = async () => {
    if (!dataSelecionadaReparo) return;
    
    const [horas, minutos] = horarioReparo.split(':');
    
    // 🌎 Criar data no fuso horário de São Paulo (UTC-3)
    const ano = dataSelecionadaReparo.getFullYear();
    const mes = String(dataSelecionadaReparo.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionadaReparo.getDate()).padStart(2, '0');
    // 🔧 Enviar sem timezone para o Postgres salvar exatamente o horário informado
    const dataISO = `${ano}-${mes}-${dia} ${horas}:${minutos}:00`;
    
    console.log('📅 Data Reparo selecionada (São Paulo):', dataISO);
    
    try {
      await onAtualizarDatas(solicitacao.id, 'data_reparo', dataISO);
      setPopoverReparoAberto(false);
    } catch (error) {
      console.error('Erro ao atualizar data do reparo:', error);
      alert('Erro ao salvar a data. Tente novamente.');
    }
  };

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

  // Funções para manipular pilhas de itens de reparo
  const adicionarItemReparo = () => {
    setItensReparo([...itensReparo, { material: '', unidade: '', quantidade: '' }]);
  };

  const removerItemReparo = (index: number) => {
    if (itensReparo.length > 1) {
      const novosItens = itensReparo.filter((_, i) => i !== index);
      setItensReparo(novosItens);
    }
  };

  const atualizarItemReparo = (index: number, campo: 'material' | 'unidade' | 'quantidade', valor: string) => {
    const novosItens = [...itensReparo];
    novosItens[index][campo] = valor;
    
    // Se selecionou "Nenhum material", limpar unidade e quantidade
    if (campo === 'material' && valor === 'Nenhum material') {
      novosItens[index].unidade = '';
      novosItens[index].quantidade = '';
    }
    
    setItensReparo(novosItens);
  };

  // Função para adicionar novo material ao catálogo
  const adicionarNovoMaterial = async () => {
    if (!novoMaterialNome.trim()) {
      toast.error('Digite o nome do material');
      return;
    }

    try {
      setSalvandoNovoMaterial(true);
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ material: novoMaterialNome.trim() }),
      });

      if (!response.ok) {
        throw new Error('Erro ao adicionar material');
      }

      const resultado = await response.json();
      console.log('✅ Material adicionado:', resultado);
      
      // Atualizar lista de materiais
      await buscarMateriais();
      
      // Fechar modal e limpar campo
      setMostrarModalNovoMaterial(false);
      setNovoMaterialNome('');
      
      toast.success(`Material "${novoMaterialNome.trim()}" adicionado com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao adicionar material:', error);
      toast.error('Erro ao adicionar material');
    } finally {
      setSalvandoNovoMaterial(false);
    }
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



  const abrirDialogFinalizar = () => {
    setMostrarDialogFinalizar(true);
  };

  // Função para enviar dados ao webhook após confirmação do backend
  const enviarParaWebhook = async (idFinalizacao: number, dadosCard: any) => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📤 INICIANDO ENVIO PARA WEBHOOK');
      console.log('═══════════════════════════════════════════════════════');
      console.log('ID da finalização:', idFinalizacao);
      console.log('ID da assistência:', dadosCard.id);
      console.log('Proprietário:', dadosCard.proprietario);
      console.log('───────────────────────────────────────────────────────');
      
      const webhookUrl = 'https://hook.us1.make.com/fuxkf8iscdgqw5k9ppiw8ivm1wibemmw';
      console.log('URL do webhook:', webhookUrl);
      
      // 🧹 Função helper para remover pontos finais (ClickSign não aceita)
      const removePontoFinal = (text: string | null | undefined): string => {
        if (!text) return '';
        const trimmed = text.trim();
        const original = trimmed;
        // Remove pontos finais consecutivos
        const cleaned = trimmed.replace(/\.+$/, '');
        if (original !== cleaned) {
          console.log(`   🧹 Ponto final removido: "${original}" → "${cleaned}"`);
        }
        return cleaned;
      };
      
      // 🔍 Buscar dados da assistencia_finalizada
      console.log('🔍 ETAPA 1: Buscando dados da assistencia_finalizada...');
      const idAssistenciaReal = dadosCard.id_assistencia_original || dadosCard.id;
      const urlFinalizacao = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/by-assistencia/${idAssistenciaReal}`;
      console.log('   URL:', urlFinalizacao);
      console.log('   ID Assistência:', idAssistenciaReal);
      
      const controllerFinalizacao = new AbortController();
      const timeoutFinalizacao = setTimeout(() => controllerFinalizacao.abort(), 10000);
      
      console.log('   → Fazendo requisição GET...');
      const responseFinalizacao = await fetch(urlFinalizacao, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: controllerFinalizacao.signal,
      });
      
      clearTimeout(timeoutFinalizacao);
      console.log('   ✅ Resposta recebida! Status:', responseFinalizacao.status);

      let dadosFinalizacao = null;
      if (responseFinalizacao.ok) {
        const resultFinalizacao = await responseFinalizacao.json();
        // by-assistencia retorna um array, pegar o primeiro elemento
        dadosFinalizacao = Array.isArray(resultFinalizacao.data) ? resultFinalizacao.data[0] : resultFinalizacao.data;
        console.log('✅ Dados da finalização recuperados:', dadosFinalizacao);
        console.log('   📋 Responsáveis:', dadosFinalizacao?.responsaveis);
        console.log('   📝 Providências:', dadosFinalizacao?.providencias);
        console.log('   ⭐ NPS:', dadosFinalizacao?.nps);
      } else {
        const errorText = await responseFinalizacao.text();
        console.error('⚠️ Não foi possível buscar dados da finalização');
        console.error('⚠️ Status:', responseFinalizacao.status);
        console.error('⚠️ Resposta:', errorText);
      }
      
      // 🖼️ Verificar tamanho da foto (se houver)
      let fotoInfo = null;
      if (dadosFinalizacao?.foto_reparo) {
        const fotoSizeKB = (dadosFinalizacao.foto_reparo.length * 0.75) / 1024;
        const fotoSizeMB = fotoSizeKB / 1024;
        fotoInfo = {
          tamanho_kb: Math.round(fotoSizeKB),
          tamanho_mb: fotoSizeMB.toFixed(2),
          formato: dadosFinalizacao.foto_reparo.substring(5, dadosFinalizacao.foto_reparo.indexOf(';'))
        };
        console.log(`   📸 Foto detectada: ${fotoInfo.tamanho_kb} KB (${fotoInfo.tamanho_mb} MB) - ${fotoInfo.formato}`);
      }

      const webhookData = {
        // Dados da assistência técnica
        id_finalizacao: idFinalizacao,
        id_assistencia: dadosCard.id_assistencia_original || dadosCard.id, // ✅ Usar ID original se disponível
        id_chamado: String(dadosCard.id_assistencia_original || dadosCard.id), // 🔧 Campo adicional para compatibilidade
        proprietario: dadosCard.proprietario,
        nome_proprietario: dadosCard.proprietario, // 🔧 Alias
        email: dadosCard.email,
        cpf: dadosCard.cpf,
        telefone: dadosCard.telefone,
        bloco: dadosCard.bloco,
        unidade: dadosCard.unidade,
        apartamento: dadosCard.unidade, // 🔧 Alias
        empreendimento: dadosCard.empreendimento,
        categoria_reparo: dadosCard.categoria_reparo,
        descricao_cliente: removePontoFinal(dadosCard.descricao_cliente), // 🧹 Remove ponto final
        descricao_problema: removePontoFinal(dadosCard.descricao_cliente), // 🔧 Alias
        data_vistoria: dadosCard.data_vistoria,
        data_reparo: dadosCard.data_reparo,
        empresa_nome: dadosCard.empresa_nome,
        status_chamado: 'Aguardando assinatura',
        created_at: dadosCard.created_at,
        
        // 📋 Campos da finalização no nível raiz (compatibilidade)
        responsaveis: dadosFinalizacao?.responsaveis || [],
        tec_responsavel: dadosFinalizacao?.responsaveis && dadosFinalizacao.responsaveis.length > 0 ? dadosFinalizacao.responsaveis.join(' e ') : 'Não informado', // 🔧 String formatada
        providencias: removePontoFinal(dadosFinalizacao?.providencias || 'Não informado'), // 🧹 Remove ponto final
        itens_reparo: dadosFinalizacao?.itens_reparo || [],
        quantidade_itens: (dadosFinalizacao?.itens_reparo || []).length, // 🔢 Quantidade de itens
        data_finalizacao: dadosFinalizacao?.data_finalizacao || null,
        nps: dadosFinalizacao?.nps || null,
        nps_valor: dadosFinalizacao?.nps || 0, // 🔢 NPS como número
        
        // 🖼️ Informações da foto (sem base64 para reduzir tamanho)
        tem_foto_reparo: !!dadosFinalizacao?.foto_reparo,
        foto_info: fotoInfo,

        // Flag para o webhook saber se tem finalização (alinhado com SolicitacaoAssistencia2)
        tem_finalizacao: !!dadosFinalizacao,
        
        // 📋 Objeto completo da finalização (estruturado) - SEM IMAGEM BASE64
        assistencia_finalizada: dadosFinalizacao ? {
          id: dadosFinalizacao.id,
          id_assistencia: dadosFinalizacao.id_assistencia,
          responsaveis: dadosFinalizacao.responsaveis || [],
          itens_reparo: dadosFinalizacao.itens_reparo || [],
          quantidade_itens: (dadosFinalizacao.itens_reparo || []).length,
          providencias: removePontoFinal(dadosFinalizacao.providencias || 'Não informado'), // 🧹 Remove ponto final
          tem_foto: !!dadosFinalizacao.foto_reparo,
          foto_info: fotoInfo,
          data_finalizacao: dadosFinalizacao.data_finalizacao || null,
          created_at: dadosFinalizacao.created_at,
          status: dadosFinalizacao.status || 'Aguardando assinatura',
          nps: dadosFinalizacao.nps || null,
          nps_valor: dadosFinalizacao.nps || 0,
        } : null,
        
        // 📌 NOTA: Para obter a foto, use o endpoint GET /assistencia-finalizada/{id}
        // A foto base64 foi removida do webhook para evitar payload muito grande
        endpoint_foto: `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${idFinalizacao}`
      };

      // 🧹 Limpar campos vazios/nulos que podem causar erro 400
      const cleanWebhookData = Object.fromEntries(
        Object.entries(webhookData).filter(([key, value]) => {
          // Sempre enviar id_finalizacao, mesmo null (Make.com precisa saber se existe ou não)
          if (key === 'id_finalizacao') return true;
          // Manter valores 0, false, strings vazias
          if (value === null || value === undefined) return false;
          // Manter arrays vazios e objetos
          return true;
        })
      );

      console.log('📋 Resumo dos dados para webhook:', {
        id_finalizacao: cleanWebhookData.id_finalizacao,
        id_assistencia: cleanWebhookData.id_assistencia,
        proprietario: cleanWebhookData.proprietario,
        tem_foto: cleanWebhookData.tem_foto_reparo,
        foto_info: cleanWebhookData.foto_info,
        responsaveis: cleanWebhookData.responsaveis?.length || 0,
        itens_reparo: cleanWebhookData.itens_reparo?.length || 0,
        nps: cleanWebhookData.nps,
        endpoint_foto: cleanWebhookData.endpoint_foto
      });
      console.log('   ℹ️ IMAGENS BASE64 REMOVIDAS do webhook para reduzir tamanho');
      console.log('   ℹ️ Use o endpoint_foto para buscar a imagem se necessário');
      console.log('   ✅ Campos null/undefined removidos do payload');
      console.log('   🧹 Pontos finais removidos (compatibilidade ClickSign)');

      // Validar tamanho do payload
      console.log('───────────────────────────────────────────────────────');
      console.log('🔍 ETAPA 2: Preparando payload...');
      const payload = JSON.stringify(cleanWebhookData);
      const payloadSizeKB = (payload.length / 1024).toFixed(2);
      const payloadSizeMB = (payload.length / 1024 / 1024).toFixed(2);
      console.log(`   📦 Tamanho do payload: ${payloadSizeKB} KB (${payloadSizeMB} MB)`);
      
      // Limites do Make.com
      const MAKE_COM_LIMIT_KB = 500; // Limite aproximado do Make.com
      const payloadKB = payload.length / 1024;
      
      if (payloadKB > MAKE_COM_LIMIT_KB) {
        console.error(`   ❌ ERRO: Payload excede limite do Make.com (${MAKE_COM_LIMIT_KB} KB)!`);
        toast.error(`Payload muito grande (${payloadSizeKB} KB). Limite: ${MAKE_COM_LIMIT_KB} KB`, {
          duration: 5000
        });
        return;
      } else if (payloadKB > MAKE_COM_LIMIT_KB * 0.8) {
        console.warn(`   ⚠️ ATENÇÃO: Payload próximo do limite (${payloadSizeKB} KB / ${MAKE_COM_LIMIT_KB} KB)`);
      } else {
        console.log(`   ✅ Tamanho OK (${((payloadKB / MAKE_COM_LIMIT_KB) * 100).toFixed(1)}% do limite)`);
      }

      // Timeout de 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      console.log('───────────────────────────────────────────────────────');
      console.log('🚀 ETAPA 3: Enviando via PROXY do servidor...');
      console.log('   URL Make.com:', webhookUrl);
      console.log('   Timeout:', '30 segundos');
      console.log('   ℹ️ Usando proxy para evitar CORS');
      console.log('───────────────────────────────────────────────────────');
      console.log('📋 PAYLOAD COMPLETO QUE SERÁ ENVIADO:');
      console.log(JSON.stringify(cleanWebhookData, null, 2));
      console.log('───────────────────────────────────────────────────────');
      
      // Usar proxy do servidor para evitar CORS
      const proxyUrl = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/webhook/makecom`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          webhookUrl: webhookUrl,
          data: cleanWebhookData
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('✅ Resposta recebida do proxy!');
      console.log('Status da resposta:', response.status);
      
      const responseJson = await response.json();
      console.log('📦 Resposta parseada:', responseJson);

      if (!response.ok || !responseJson.success) {
        console.error('═══════════════════════════════════════════════════════');
        console.error('❌ WEBHOOK MAKE.COM - ERRO');
        console.error('═══════════════════════════════════════════════════════');
        console.error('Status HTTP:', response.status);
        console.error('Erro:', responseJson.error);
        console.error('Detalhes:', responseJson.details);
        console.error('Status Make.com:', responseJson.status);
        console.error('Resposta Make.com:', responseJson.response);
        console.error('───────────────────────────────────────────────────────');
        console.error('📦 Resumo dos dados enviados:', {
          id_finalizacao: cleanWebhookData.id_finalizacao,
          id_assistencia: cleanWebhookData.id_assistencia,
          proprietario: cleanWebhookData.proprietario,
          tec_responsavel: cleanWebhookData.tec_responsavel,
          providencias: cleanWebhookData.providencias,
          tem_dados_finalizacao: !!cleanWebhookData.assistencia_finalizada,
          quantidade_responsaveis: cleanWebhookData.responsaveis?.length || 0,
          quantidade_itens: cleanWebhookData.itens_reparo?.length || 0,
          nps: cleanWebhookData.nps,
          tem_foto: cleanWebhookData.tem_foto_reparo,
        });
        console.error('📋 PAYLOAD COMPLETO QUE FOI ENVIADO:');
        console.error(JSON.stringify(cleanWebhookData, null, 2));
        console.error('');
        console.error('💡 DICAS PARA DEBUG:');
        console.error('1. Copie o payload acima e teste manualmente no Make.com');
        console.error('2. Verifique se algum campo está vazio quando deveria ter valor');
        console.error('3. Confira se os tipos de dados estão corretos (string, number, etc)');
        console.error('4. No Make.com, veja o histórico de execuções para detalhes do erro');
        console.error('═══════════════════════════════════════════════════════');
        
        // Abrir modal com o erro
        if (onWebhookResponse) {
          onWebhookResponse(responseJson.status || response.status, JSON.stringify(responseJson, null, 2));
        }
        
        const errorMsg = responseJson.error || 'Erro desconhecido';
        const errorDetails = responseJson.details || '';
        
        // Mensagem mais amigável para o usuário
        let userMessage = errorMsg;
        if (response.status === 410 || responseJson.status === 410) {
          userMessage = '⚠️ Webhook desativado! Configure novamente no Make.com';
        } else if (response.status >= 500 || responseJson.status >= 500) {
          // Mensagem específica para erro 500
          const tentativas = responseJson.attempts || 3;
          userMessage = `❌ Make.com retornou erro: ${responseJson.status || 500}\n\n` +
            `Detalhes: ${responseJson.details || 'Scenario failed to complete'}\n\n` +
            `Possíveis causas:\n` +
            `• O cenário no Make.com pode ter um erro de configuração\n` +
            `• Algum módulo do cenário pode estar falhando\n` +
            `• O cenário pode estar esperando dados em formato diferente\n\n` +
            `💡 Recomendações:\n` +
            `1. Verifique o histórico de execuções no Make.com\n` +
            `2. Confira se todos os módulos estão configurados corretamente\n` +
            `3. Veja os logs de erro detalhados no console do navegador\n\n` +
            `Tentamos ${tentativas} vez(es) mas o erro persistiu.`;
        } else if (errorDetails) {
          userMessage = `${errorMsg}: ${errorDetails}`;
        }
        
        toast.error(userMessage, {
          duration: 10000,
          style: {
            maxWidth: '600px',
            whiteSpace: 'pre-wrap'
          }
        });
      } else {
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ WEBHOOK MAKE.COM - SUCESSO');
        console.log('═══════════════════════════════════════════════════════');
        console.log('Status HTTP:', response.status);
        console.log('Status Proxy:', responseJson.status);
        console.log('Mensagem:', responseJson.message);
        console.log('───────────────────────────────────────────────────────');
        console.log('📩 RESPOSTA DO MAKE.COM:');
        console.log(responseJson.response);
        console.log('═══════════════════════════════════════════════════════');
        
        const mensagemSucesso = responseJson.message || 'Termo enviado com sucesso!';
        
        // Abrir modal com sucesso
        if (onWebhookResponse) {
          onWebhookResponse(responseJson.status || 200, responseJson.response || 'Sucesso');
        }
        
        toast.success(mensagemSucesso);
      }
    } catch (error) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ ERRO AO ENVIAR PARA WEBHOOK');
      console.error('═══════════════════════════════════════════════════════');
      console.error('Tipo de erro:', error);
      console.error('Mensagem:', error instanceof Error ? error.message : String(error));
      console.error('Nome do erro:', error instanceof Error ? error.name : 'N/A');
      console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
      console.error('───────────────────────────────────────────────────────');
      
      // Detectar tipo de erro
      let errorMsg = 'Erro desconhecido';
      let possiveisCausas: string[] = [];
      
      if (error instanceof Error) {
        errorMsg = error.message;
        
        if (error.name === 'AbortError') {
          errorMsg = 'Timeout - Servidor não respondeu em 30 segundos';
          possiveisCausas = [
            'Servidor Make.com está lento',
            'Payload muito grande',
            'Problema de conexão'
          ];
        } else if (error.message.includes('Failed to fetch')) {
          errorMsg = 'Falha ao conectar com o webhook';
          possiveisCausas = [
            'URL do webhook inválida ou inacessível',
            'Problema de CORS no servidor Make.com',
            'Servidor Make.com está offline',
            'Bloqueio de firewall ou rede'
          ];
        } else if (error.message.includes('NetworkError')) {
          errorMsg = 'Erro de rede';
          possiveisCausas = [
            'Sem conexão com internet',
            'Firewall bloqueando requisição',
            'DNS não resolveu o domínio'
          ];
        }
      }
      
      console.error('🔍 Possíveis causas:');
      possiveisCausas.forEach((causa, i) => {
        console.error(`  ${i + 1}. ${causa}`);
      });
      console.error('═══════════════════════════════════════════════════════');
      
      // Não bloqueamos o fluxo se o webhook falhar
      toast.error(`Dados salvos, mas falha ao notificar webhook: ${errorMsg}`, {
        duration: 5000
      });
      
      // Abrir modal com o erro
      if (onWebhookResponse) {
        onWebhookResponse(0, `Erro: ${errorMsg}\n\nPossíveis causas:\n${possiveisCausas.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);
      }
    }
  };

  // Função para reenviar termo (webhook)
  const reenviarTermo = async (solicitacao: Solicitacao) => {
    try {
      setCarregando(true);
      console.log('🔄 Reenviando termo para assistência #', solicitacao.id);
      
      // Obter ID de finalização
      let idFinalizacao = solicitacao.id_finalizacao;

      if (!idFinalizacao) {
        // Buscar o ID da finalização usando a rota by-assistencia
        const urlFinalizacao = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/by-assistencia/${solicitacao.id}`;
        const responseFinalizacao = await fetch(urlFinalizacao, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });

        if (!responseFinalizacao.ok) {
          toast.error(responseFinalizacao.status === 404
            ? 'Esta assistência ainda não foi finalizada'
            : 'Erro ao buscar dados da finalização');
          return;
        }

        const resultFinalizacao = await responseFinalizacao.json();
        idFinalizacao = resultFinalizacao.data?.id;

        if (!idFinalizacao) {
          toast.error('Dados de finalização não encontrados');
          return;
        }
      }

      // Gerar PDF SEM carimbo e enviar para Clicksign (cria novo envelope)
      toast.info('Gerando termo e enviando para assinatura digital...');

      const { gerarTermoBlobComFoto } = await import('@/components/TermoAssistenciaPDF');

      // Buscar foto_reparo da finalização
      let fotoReparoBase64: string | undefined;
      try {
        const fotoResp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${idFinalizacao}/foto-reparo`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        );
        if (fotoResp.ok) {
          const fotoData = await fotoResp.json();
          if (fotoData.foto_reparo) {
            fotoReparoBase64 = fotoData.foto_reparo.includes(',')
              ? fotoData.foto_reparo.split(',')[1]
              : fotoData.foto_reparo;
          }
        }
      } catch (e) {
        console.warn('⚠️ Não foi possível carregar foto do reparo:', e);
      }

      const dadosTermo: TermoDados = {
        id: solicitacao.id,
        id_finalizacao: idFinalizacao,
        id_assistencia_original: solicitacao.id_assistencia_original,
        proprietario: solicitacao.proprietario,
        cpf: solicitacao.cpf,
        email: solicitacao.email,
        telefone: solicitacao.telefone,
        bloco: solicitacao.bloco,
        unidade: solicitacao.unidade,
        empreendimento: solicitacao.empreendimento,
        descricao_cliente: solicitacao.descricao_cliente,
        categoria_reparo: solicitacao.categoria_reparo,
        created_at: solicitacao.created_at,
        data_vistoria: solicitacao.data_vistoria,
        data_reparo: solicitacao.data_reparo,
        empresa_nome: solicitacao.empresa_nome,
        responsaveis: solicitacao.responsaveis,
        providencias: solicitacao.providencias,
        nps: solicitacao.nps,
        created_at_finalizacao: solicitacao.created_at_finalizacao,
        assinaturaVencida: false, // SEM carimbo
        foto_reparo_base64: fotoReparoBase64,
      };
      const pdfBlob = await gerarTermoBlobComFoto(dadosTermo);

      // Converter blob para base64
      const pdfBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(pdfBlob);
      });

      // Enviar para Clicksign
      const { enviarTermoParaAssinatura } = await import('@/services/clicksign.service');
      const idReal = solicitacao.id_assistencia_original || solicitacao.id;
      const clicksignResult = await enviarTermoParaAssinatura({
        pdf_base64: pdfBase64,
        filename: `termo-assistencia-${idReal}.pdf`,
        signer_name: solicitacao.proprietario,
        signer_email: solicitacao.email,
        signer_phone: solicitacao.telefone,
        signer_cpf: solicitacao.cpf,
        id_assistencia: typeof idReal === 'string' ? parseInt(idReal) : idReal,
        id_finalizacao: idFinalizacao,
      });

      if (clicksignResult.success) {
        toast.success('Termo enviado para assinatura digital via WhatsApp!');
      } else {
        toast.error(clicksignResult.error || 'Erro ao enviar para Clicksign');
      }
      
    } catch (error) {
      console.error('❌ Erro ao reenviar termo:', error);
      toast.error('Erro ao reenviar termo');
    } finally {
      setCarregando(false);
    }
  };

  // Montar dados do termo para o PDF
  const montarDadosTermo = (): TermoDados => ({
    id: solicitacao.id,
    id_finalizacao: solicitacao.id_finalizacao,
    id_assistencia_original: solicitacao.id_assistencia_original,
    proprietario: solicitacao.proprietario,
    cpf: solicitacao.cpf,
    email: solicitacao.email,
    telefone: solicitacao.telefone,
    bloco: solicitacao.bloco,
    unidade: solicitacao.unidade,
    empreendimento: solicitacao.empreendimento,
    descricao_cliente: solicitacao.descricao_cliente,
    categoria_reparo: solicitacao.categoria_reparo,
    created_at: solicitacao.created_at,
    data_vistoria: solicitacao.data_vistoria,
    data_reparo: solicitacao.data_reparo,
    empresa_nome: solicitacao.empresa_nome,
    responsaveis: solicitacao.responsaveis,
    providencias: solicitacao.providencias,
    nps: solicitacao.nps,
    created_at_finalizacao: solicitacao.created_at_finalizacao,
    assinaturaVencida: true,
    foto_reparo_base64: solicitacao.foto_reparo
      ? (solicitacao.foto_reparo.includes(',') ? solicitacao.foto_reparo.split(',')[1] : solicitacao.foto_reparo)
      : undefined,
  });

  // Função para salvar PDF no Supabase Storage e finalizar chamado
  const salvarPDFeFinalizar = async () => {
    try {
      if (!solicitacao.id_finalizacao) {
        toast.error('Não foi possível identificar o registro de finalização');
        return;
      }

      const idFinalizacao = solicitacao.id_finalizacao;
      const idReal = solicitacao.id_assistencia_original || solicitacao.id;

      setSalvandoPDF(true);
      console.log('📄 Gerando PDF do termo de assistência...');

      // 1️⃣ Gerar blob do PDF
      const dadosTermo = montarDadosTermo();
      const { gerarTermoBlobComFoto } = await import('@/components/TermoAssistenciaPDF');
      const blob = await gerarTermoBlobComFoto(dadosTermo);
      console.log(`✅ PDF gerado: ${(blob.size / 1024).toFixed(1)} KB`);

      // 2️⃣ Converter blob para base64 para enviar ao servidor
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
      const pdfBase64 = await base64Promise;

      // 3️⃣ Enviar PDF + finalizar via endpoint
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${idFinalizacao}/finalizar-vencida`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdf_base64: pdfBase64,
          pdf_filename: `termo-assistencia-${idReal}.pdf`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erro ao salvar PDF do termo:', data);
        throw new Error(data.error || 'Erro ao salvar PDF do termo');
      }

      console.log('✅ PDF do termo salvo com sucesso:', data);
      setPdfSalvo(true);
      if (data.pdf_url) {
        setTermoSalvoUrl(data.pdf_url);
      }

      toast.success('Termo salvo com sucesso!', {
        duration: 4000,
      });

      // NÃO recarregar dados aqui — o reload destrói a UI e tira o usuário da visualização do termo.
      // O estado local (pdfSalvo, termoSalvoUrl) já reflete a mudança corretamente.
      // Os dados serão sincronizados quando o usuário fechar o painel ou atualizar o Kanban.

    } catch (error) {
      console.error('❌ Erro ao salvar PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar termo');
    } finally {
      setSalvandoPDF(false);
    }
  };

  // Função para baixar o PDF localmente
  const baixarPDF = async () => {
    try {
      const idReal = solicitacao.id_assistencia_original || solicitacao.id;
      const dadosTermo = montarDadosTermo();
      const { gerarTermoBlobComFoto } = await import('@/components/TermoAssistenciaPDF');
      const blob = await gerarTermoBlobComFoto(dadosTermo);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `termo-assistencia-${idReal}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF baixado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao baixar PDF:', error);
      toast.error('Erro ao gerar PDF para download');
    }
  };

  // Função para enviar o termo PDF ao Sienge (ERP)
  const enviarParaSienge = async () => {
    if (!solicitacao.id_finalizacao) {
      toast.error('Registro de finalização não encontrado');
      return;
    }

    // Confirmação antes de enviar
    const confirmar = window.confirm(
      `Deseja enviar o termo de ${solicitacao.proprietario} ao Sienge?\n\nApós o envio, o status será alterado para "Finalizado" e o card será removido da esteira.`
    );
    if (!confirmar) return;

    try {
      setEnviandoSienge(true);
      console.log('🏢 Enviando termo ao Sienge...');
      console.log(`   Finalização #${solicitacao.id_finalizacao}`);
      console.log(`   Proprietário: ${solicitacao.proprietario}`);
      console.log(`   CPF: ${solicitacao.cpf}`);

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${solicitacao.id_finalizacao}/enviar-sienge`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('❌ Erro ao enviar ao Sienge:', data);
        const errorMsg = data.error || 'Erro desconhecido ao enviar ao Sienge';
        const siengeError = data.sienge_error ? `\n\nDetalhes Sienge: ${typeof data.sienge_error === 'string' ? data.sienge_error : JSON.stringify(data.sienge_error)}` : '';
        toast.error(`${errorMsg}${siengeError}`, { duration: 8000 });
        
        // Marcar erro → habilita botão de finalização manual
        setErroSienge(true);
        setErroSiengeMsg(errorMsg);
        return;
      }

      console.log('✅ Termo enviado ao Sienge com sucesso!', data);
      setEnviadoSienge(true);
      setDataEnvioSienge(data.data?.enviado_em || new Date().toISOString());

      toast.success('Termo enviado ao Sienge com sucesso! Status atualizado para Finalizado.', {
        duration: 5000,
      });

      // Recarregar dados para refletir mudança de status (card sairá da esteira)
      if (onRecarregarDados) {
        await onRecarregarDados();
      }

    } catch (error) {
      console.error('❌ Erro ao enviar ao Sienge:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar ao Sienge');
      
      // Marcar erro → habilita botão de finalização manual
      setErroSienge(true);
      setErroSiengeMsg(error instanceof Error ? error.message : 'Erro de conexão com o Sienge');
    } finally {
      setEnviandoSienge(false);
    }
  };

  // Função para finalizar manualmente (quando Sienge falha)
  const finalizarManualmente = async () => {
    if (!solicitacao.id_finalizacao) {
      toast.error('Registro de finalização não encontrado');
      return;
    }

    const confirmar = window.confirm(
      `Deseja finalizar manualmente o chamado de ${solicitacao.proprietario}?\n\nO PDF já foi salvo. O chamado será movido para "Finalizado" sem sincronização com o Sienge.\n\nVocê poderá subir o PDF manualmente no Sienge depois, se necessário.`
    );
    if (!confirmar) return;

    try {
      setFinalizandoManual(true);
      console.log('🔧 Finalizando manualmente...');
      console.log(`   Finalização #${solicitacao.id_finalizacao}`);

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${solicitacao.id_finalizacao}/finalizar-manual`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('❌ Erro ao finalizar manualmente:', data);
        toast.error(data.error || 'Erro ao finalizar manualmente');
        return;
      }

      console.log('✅ Chamado finalizado manualmente!', data);
      toast.success('Chamado finalizado manualmente com sucesso!', { duration: 5000 });

      // Recarregar dados para refletir mudança de status (card sairá da esteira)
      if (onRecarregarDados) {
        await onRecarregarDados();
      }
    } catch (error) {
      console.error('❌ Erro ao finalizar manualmente:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao finalizar manualmente');
    } finally {
      setFinalizandoManual(false);
    }
  };

  const finalizarChamado = async () => {
    // Validar campos obrigatórios
    const itensValidos = itensReparo.every(item => {
      if (item.material.trim() !== '') {
        if (item.material === 'Nenhum material') return true;
        return item.unidade.trim() !== '' && item.quantidade.trim() !== '';
      }
      return false;
    });

    if (responsaveis.length === 0 || !itensValidos || !providencias.trim() || !fotoReparo) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setCarregando(true);

      // Converter foto para base64
      const fotoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fotoReparo);
      });

      // Montar dados do termo para preview (sem salvar no backend)
      const dadosTermo: TermoDados = {
        id: solicitacao.id,
        id_assistencia_original: solicitacao.id_assistencia_original,
        proprietario: solicitacao.proprietario,
        cpf: solicitacao.cpf,
        email: solicitacao.email,
        telefone: solicitacao.telefone,
        bloco: solicitacao.bloco,
        unidade: solicitacao.unidade,
        empreendimento: solicitacao.empreendimento,
        descricao_cliente: solicitacao.descricao_cliente,
        categoria_reparo: solicitacao.categoria_reparo,
        created_at: solicitacao.created_at,
        data_vistoria: solicitacao.data_vistoria,
        data_reparo: solicitacao.data_reparo,
        empresa_nome: solicitacao.empresa_nome,
        responsaveis: responsaveis,
        providencias: providencias,
        nps: nps,
        assinaturaVencida: false,
        foto_reparo_base64: fotoBase64.includes(',') ? fotoBase64.split(',')[1] : fotoBase64,
      };

      // Guardar requestBody para enviar ao backend depois
      const requestBody = {
        responsaveis: responsaveis,
        itens_reparo: itensReparo,
        providencias: providencias,
        foto_reparo: fotoBase64,
        nps: nps,
        cpf_assistencia: solicitacao.cpf,
      };

      // Abrir modal de preview
      setDadosTermoPreview(dadosTermo);
      setFotoBase64Preview(fotoBase64);
      setRequestBodyPreview(requestBody);
      setMostrarPreviewTermo(true);

      // Fechar dialog de finalização e resetar campos
      setMostrarDialogFinalizar(false);
      setResponsaveis([]);
      setItensReparo([{ material: '', unidade: '', quantidade: '' }]);
      setProvidencias('');
      setFotoReparo(null);
      setPreviewFotoReparo(null);
      setNps(null);

    } catch (error) {
      console.error('❌ ERRO ao preparar preview:', error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCarregando(false);
    }
  };

  // Função para salvar + gerar PDF + enviar ao Clicksign (com loading steps)
  const enviarParaClicksign = async () => {
    if (!dadosTermoPreview || !requestBodyPreview) return;

    const updateStep = (index: number, status: StepStatus) => {
      setEnvioSteps(prev => prev.map((s, i) => i === index ? { ...s, status } : s));
    };

    try {
      setEnviandoClicksign(true);
      // Reset steps
      setEnvioSteps([
        { label: 'Registrando finalização', status: 'pending' },
        { label: 'Gerando termo', status: 'pending' },
        { label: 'Enviando para assinatura', status: 'pending' },
      ]);

      // ── STEP 1: Registrar finalização no backend ──
      updateStep(0, 'loading');
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${solicitacao.id}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(requestBodyPreview),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let msg = `Erro ${response.status}`;
        try { msg = JSON.parse(errorText).error || msg; } catch {}
        updateStep(0, 'error');
        throw new Error(msg);
      }

      const resultado = await response.json();
      const idFinalizacao = resultado.data?.id;
      if (!idFinalizacao) {
        updateStep(0, 'error');
        throw new Error('Backend não retornou ID de finalização');
      }
      updateStep(0, 'success');

      // ── STEP 2: Gerar PDF do termo ──
      updateStep(1, 'loading');
      const dadosTermoComId = { ...dadosTermoPreview, id_finalizacao: idFinalizacao };
      const { gerarTermoBlob: gerarBlob } = await import('@/components/TermoAssistenciaPDF');
      const pdfBlob = gerarBlob(dadosTermoComId);

      const pdfBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(pdfBlob);
      });
      updateStep(1, 'success');

      // ── STEP 3: Enviar para Clicksign + WhatsApp ──
      updateStep(2, 'loading');
      const { enviarTermoParaAssinatura } = await import('@/services/clicksign.service');
      const idReal = solicitacao.id_assistencia_original || solicitacao.id;
      const clicksignResult = await enviarTermoParaAssinatura({
        pdf_base64: pdfBase64,
        filename: `termo-assistencia-${typeof idReal === 'string' ? idReal.replace(/\D/g, '') : idReal}.pdf`,
        signer_name: solicitacao.proprietario,
        signer_email: solicitacao.email,
        signer_phone: solicitacao.telefone,
        signer_cpf: solicitacao.cpf,
        id_assistencia: typeof idReal === 'string' ? parseInt(idReal.replace(/\D/g, '')) : idReal,
        id_finalizacao: idFinalizacao,
      });

      if (!clicksignResult.success) {
        updateStep(2, 'error');
        throw new Error(clicksignResult.error || 'Erro ao enviar para Clicksign');
      }
      updateStep(2, 'success');

      // ── Sucesso total ──
      toast.success('Termo enviado para assinatura digital via WhatsApp!');
      setTimeout(() => {
        setMostrarPreviewTermo(false);
        setDadosTermoPreview(null);
        setFotoBase64Preview(null);
        setRequestBodyPreview(null);
        onAtualizarStatus(solicitacao.id, 'Aguardando assinatura');
      }, 1500);

    } catch (error) {
      console.error('❌ Erro no envio:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar envio');
    } finally {
      setEnviandoClicksign(false);
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

  return (
    <>
      {/* ═══ CARD SIMPLIFICADO ═══ */}
      <div
        data-kanban-card
        ref={podeArrastar ? (drag as any) : null}
        onClick={() => !isDragging && setDrawerOpen(true)}
        className={`${podeArrastar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-[opacity,transform] duration-200 ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}`}
      >
        <div className={`bg-white border rounded-xl overflow-hidden shadow-sm ${podeArrastar ? 'hover:shadow-md hover:border-gray-300' : 'hover:shadow-md'} transition-[box-shadow,border-color] duration-200`}>
          <div className="p-3 space-y-2">
            {/* Linha 1: Badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isNovo(solicitacao.created_at) && (
                  <Badge className="bg-black text-white text-[10px] px-1.5 py-0 flex items-center gap-0.5 h-4">
                    <Sparkles className="h-2.5 w-2.5" />
                    NOVO
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {solicitacao.empresa_nome && (
                  <Badge className={`text-[10px] px-1.5 py-0 h-4 ${
                    solicitacao.empresa_nome === 'SPITI' 
                      ? 'bg-black text-white' 
                      : solicitacao.empresa_nome === 'BP Incorporadora'
                      ? 'bg-blue-900 text-white'
                      : 'bg-gray-700 text-white'
                  }`}>
                    {solicitacao.empresa_nome === 'BP Incorporadora' ? 'BP' : solicitacao.empresa_nome}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] border-gray-300 h-4 px-1.5">
                  #{solicitacao.id_assistencia_original || solicitacao.id}
                </Badge>
              </div>
            </div>

            {/* Linha 2: Nome */}
            <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{solicitacao.proprietario}</p>

            {/* Linha 3: Empreendimento + Unidade (compacto) */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{solicitacao.empreendimento} · Bl. {solicitacao.bloco} - Ap. {solicitacao.unidade}</span>
            </div>

            {/* Linha 4: Categoria + Badge de Risco GPT */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Wrench className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-600 truncate">{solicitacao.categoria_reparo}</span>
              </div>
              {gptClassificacao && (
                <Badge className={`text-[9px] px-1.5 py-0 h-4 flex-shrink-0 font-semibold ${
                  gptClassificacao === 'Crítico'
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : gptClassificacao === 'Médio'
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}>
                  {gptClassificacao === 'Crítico' ? '● ' : gptClassificacao === 'Médio' ? '● ' : '● '}
                  {gptClassificacao}
                </Badge>
              )}
            </div>

            {/* Linha 5: Rodapé - data + indicador de status */}
            <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
              {solicitacao.status_chamado === 'Aguardando assinatura' ? (
                <span className={`text-[10px] flex items-center gap-0.5 ${passaram7Dias() ? 'text-green-500' : 'text-gray-400'}`}>
                  <Clock className="h-2.5 w-2.5" />
                  {solicitacao.created_at_finalizacao ? formatarDataHora(solicitacao.created_at_finalizacao) : formatarDataHora(solicitacao.created_at)}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400">{formatarDataHora(solicitacao.created_at)}</span>
              )}
              {solicitacao.status_chamado === 'Aguardando assinatura' && (
                <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Finalizado
                </span>
              )}
              {solicitacao.data_vistoria && (solicitacao.status_chamado === 'Abertos' || solicitacao.status_chamado === 'Vistoria agendada') && (
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  Vistoria
                </span>
              )}
              {solicitacao.data_reparo && solicitacao.status_chamado === 'Reparo agendado' && (
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  Reparo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DRAWER DE DETALHES ═══ */}
      {/* Overlay customizado permanente - substitui o overlay do Radix (modal=false) */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          if (!salvandoPDF) {
            setDrawerOpen(false);
            setMostrarPDFViewer(false);
            setPdfSalvo(false);
            setTermoSalvoUrl(null);
          }
        }}
      />
      <Sheet open={drawerOpen} modal={false} onOpenChange={(open) => {
        setDrawerOpen(open);
        if (!open && mostrarPDFViewer) {
          setMostrarPDFViewer(false);
          setPdfSalvo(false);
          setTermoSalvoUrl(null);
        }
      }}>
        <SheetContent 
          side="right" 
          className="sm:max-w-[520px] w-full p-0 flex flex-col gap-0 overflow-hidden"
          onPointerDownOutside={(e) => {
            // Prevent Sheet from closing when clicking on the PDF viewer panel
            if (mostrarPDFViewer) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            // Prevent Sheet from closing when interacting with the PDF viewer panel
            if (mostrarPDFViewer) {
              e.preventDefault();
            }
          }}
        >
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                {isNovo(solicitacao.created_at) && (
                  <Badge className="bg-black text-white text-[10px] px-1.5 py-0 flex items-center gap-0.5 h-5">
                    <Sparkles className="h-3 w-3" />
                    NOVO
                  </Badge>
                )}
                {solicitacao.empresa_nome && (
                  <Badge className={`text-[10px] px-2 py-0 h-5 ${
                    solicitacao.empresa_nome === 'SPITI' ? 'bg-black text-white' 
                      : solicitacao.empresa_nome === 'BP Incorporadora' ? 'bg-blue-900 text-white'
                      : 'bg-gray-700 text-white'
                  }`}>
                    {solicitacao.empresa_nome === 'BP Incorporadora' ? 'BP' : solicitacao.empresa_nome}
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="text-xs border-gray-300 h-5 px-2">
                #{solicitacao.id_assistencia_original || solicitacao.id}
              </Badge>
            </div>
            <SheetTitle className="text-base leading-tight">{solicitacao.proprietario}</SheetTitle>
            <SheetDescription className="text-xs">
              {solicitacao.empreendimento} · Bl. {solicitacao.bloco} - Ap. {solicitacao.unidade}
            </SheetDescription>
          </SheetHeader>

          {/* Conteúdo com Scroll */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-5 py-4 space-y-4">

              {/* Seção: Contato */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Contato</h4>
                  {!editandoContato ? (
                    <button
                      onClick={() => {
                        setEditNome(solicitacao.proprietario || '');
                        setEditCpf(solicitacao.cpf || '');
                        setEditEmail(solicitacao.email || '');
                        setEditandoContato(true);
                      }}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Editar nome, CPF e e-mail"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={cancelarEdicaoContato}
                        disabled={salvandoContato}
                        className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={salvarContato}
                        disabled={salvandoContato}
                        className="p-1 rounded-md hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors"
                        title="Salvar alterações"
                      >
                        {salvandoContato ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {editandoContato ? (
                  <div className="space-y-2">
                    {/* Nome */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Nome</label>
                      <input
                        type="text"
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="w-full h-8 bg-gray-50 border border-gray-200 rounded-lg px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                        placeholder="Nome do proprietário"
                      />
                    </div>
                    {/* CPF */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">CPF</label>
                      <input
                        type="text"
                        value={editCpf}
                        onChange={(e) => setEditCpf(formatarCPF(e.target.value))}
                        className="w-full h-8 bg-gray-50 border border-gray-200 rounded-lg px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                    </div>
                    {/* Email */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">E-mail</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full h-8 bg-gray-50 border border-gray-200 rounded-lg px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    {/* Botão Salvar mobile-friendly */}
                    <button
                      onClick={salvarContato}
                      disabled={salvandoContato}
                      className="w-full h-8 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {salvandoContato ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          Salvar alterações
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate text-xs">{solicitacao.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs">{solicitacao.telefone}</span>
                    </div>
                  </div>
                )}
                <Suspense fallback={<div className="h-9 w-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <ChatWhatsApp
                    assistenciaId={solicitacao.id}
                    telefoneCliente={solicitacao.telefone}
                    nomeCliente={solicitacao.proprietario}
                  />
                </Suspense>
              </div>

              {/* Seção: Detalhes do Chamado */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Detalhes do Chamado</h4>
                <div className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5 text-gray-500" />
                  <Badge variant="secondary" className="text-xs">{solicitacao.categoria_reparo}</Badge>
                </div>
                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2.5 border border-gray-100 max-h-[120px] overflow-y-auto">
                  {solicitacao.descricao_cliente}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawerOpen(false);
                    setTimeout(abrirFotoProblema, 300);
                  }}
                  className="flex items-center justify-center gap-2 text-xs font-medium border rounded-lg px-3 py-2 w-full transition-all duration-150 text-gray-700 hover:text-black border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Ver foto do problema
                </button>
              </div>

              {/* Seção: Análise IA */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="h-3 w-3" />
                  Análise IA
                </h4>
                {gptClassificacao ? (
                  <div className={`rounded-lg p-2.5 border ${
                    gptClassificacao === 'Crítico'
                      ? 'bg-red-50 border-red-200'
                      : gptClassificacao === 'Médio'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <Badge className={`text-xs font-semibold px-2 py-0.5 ${
                        gptClassificacao === 'Crítico'
                          ? 'bg-red-600 text-white'
                          : gptClassificacao === 'Médio'
                          ? 'bg-amber-500 text-white'
                          : 'bg-green-600 text-white'
                      }`}>
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        {gptClassificacao}
                      </Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          solicitarAnaliseGPT();
                        }}
                        disabled={analisandoGPT}
                        className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                      >
                        {analisandoGPT ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Reanalisar
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{gptAnalise}</p>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      solicitarAnaliseGPT();
                    }}
                    disabled={analisandoGPT}
                    className="flex items-center justify-center gap-2 text-xs font-medium border border-dashed rounded-lg px-3 py-2.5 w-full transition-all duration-150 text-gray-500 hover:text-gray-800 border-gray-300 hover:border-gray-400 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analisandoGPT ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analisando com IA...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        Analisar com IA
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Seção: Datas */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Datas</h4>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  Aberto em {formatarDataHora(solicitacao.created_at)}
                </div>

                {/* Data Vistoria - Editável em "Abertos" */}
                {solicitacao.status_chamado === 'Abertos' && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Data Vistoria
                    </Label>
                    <Popover open={popoverVistoriaAberto} onOpenChange={setPopoverVistoriaAberto}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left text-sm h-10 font-normal">
                          <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                          {solicitacao.data_vistoria ? formatarDataHora(solicitacao.data_vistoria) : 'Selecionar data e hora'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[60]" align="start">
                        <div className="p-3 space-y-3">
                          <CalendarComponent
                            mode="single"
                            selected={dataSelecionadaVistoria}
                            onSelect={setDataSelecionadaVistoria}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                          <div className="space-y-2 px-1">
                            <Label className="text-xs">Horário</Label>
                            <Input type="time" value={horarioVistoria} onChange={(e) => setHorarioVistoria(e.target.value)} className="text-sm" />
                          </div>
                          <Button onClick={confirmarDataVistoria} disabled={!dataSelecionadaVistoria} className="w-full bg-black hover:bg-gray-800 text-white" size="sm">
                            <Check className="mr-2 h-4 w-4" />
                            Confirmar
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Data Vistoria - Editável em "Vistoria agendada" */}
                {solicitacao.status_chamado === 'Vistoria agendada' && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Data Vistoria
                    </Label>
                    <Popover open={popoverVistoriaAberto} onOpenChange={setPopoverVistoriaAberto}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                          {formatarDataHora(solicitacao.data_vistoria)}
                        </div>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 px-3" title="Editar data">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                      </div>
                      <PopoverContent className="w-auto p-0 z-[60]" align="start">
                        <div className="p-3 space-y-3">
                          <CalendarComponent
                            mode="single"
                            selected={dataSelecionadaVistoria}
                            onSelect={setDataSelecionadaVistoria}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                          <div className="space-y-2 px-1">
                            <Label className="text-xs">Horário</Label>
                            <Input type="time" value={horarioVistoria} onChange={(e) => setHorarioVistoria(e.target.value)} className="text-sm" />
                          </div>
                          <Button onClick={confirmarDataVistoria} disabled={!dataSelecionadaVistoria} className="w-full bg-black hover:bg-gray-800 text-white" size="sm">
                            <Check className="mr-2 h-4 w-4" />
                            Atualizar
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Data Vistoria - Leitura em "Reparo agendado" */}
                {solicitacao.status_chamado === 'Reparo agendado' && solicitacao.data_vistoria && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Vistoria Realizada
                    </Label>
                    <div className="text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                      {formatarDataHora(solicitacao.data_vistoria)}
                    </div>
                  </div>
                )}

                {/* Data Reparo - Editável em "Vistoria agendada" */}
                {solicitacao.status_chamado === 'Vistoria agendada' && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Data Reparo
                    </Label>
                    <Popover open={popoverReparoAberto} onOpenChange={setPopoverReparoAberto}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left text-sm h-10 font-normal">
                          <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                          {solicitacao.data_reparo ? formatarDataHora(solicitacao.data_reparo) : 'Selecionar data e hora'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[60]" align="start">
                        <div className="p-3 space-y-3">
                          <CalendarComponent
                            mode="single"
                            selected={dataSelecionadaReparo}
                            onSelect={setDataSelecionadaReparo}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                          <div className="space-y-2 px-1">
                            <Label className="text-xs">Horário</Label>
                            <Input type="time" value={horarioReparo} onChange={(e) => setHorarioReparo(e.target.value)} className="text-sm" />
                          </div>
                          <Button onClick={confirmarDataReparo} disabled={!dataSelecionadaReparo} className="w-full bg-black hover:bg-gray-800 text-white" size="sm">
                            <Check className="mr-2 h-4 w-4" />
                            Confirmar
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Data Reparo - Editável em "Reparo agendado" */}
                {solicitacao.status_chamado === 'Reparo agendado' && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Data Reparo
                    </Label>
                    <Popover open={popoverReparoAberto} onOpenChange={setPopoverReparoAberto}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                          {solicitacao.data_reparo ? formatarDataHora(solicitacao.data_reparo) : 'Não agendado'}
                        </div>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 px-3" title="Editar data">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                      </div>
                      <PopoverContent className="w-auto p-0 z-[60]" align="start">
                        <div className="p-3 space-y-3">
                          <CalendarComponent
                            mode="single"
                            selected={dataSelecionadaReparo}
                            onSelect={setDataSelecionadaReparo}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                          <div className="space-y-2 px-1">
                            <Label className="text-xs">Horário</Label>
                            <Input type="time" value={horarioReparo} onChange={(e) => setHorarioReparo(e.target.value)} className="text-sm" />
                          </div>
                          <Button onClick={confirmarDataReparo} disabled={!dataSelecionadaReparo} className="w-full bg-black hover:bg-gray-800 text-white" size="sm">
                            <Check className="mr-2 h-4 w-4" />
                            Atualizar
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Seção: Datas (Aguardando assinatura) */}
              {solicitacao.status_chamado === 'Aguardando assinatura' && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cronologia</h4>
                  <div className="space-y-1.5">
                    {solicitacao.data_vistoria && (
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-400">Vistoria:</span>
                        <span className="font-medium">{formatarDataHora(solicitacao.data_vistoria)}</span>
                      </div>
                    )}
                    {solicitacao.data_reparo && (
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-400">Reparo:</span>
                        <span className="font-medium">{formatarDataHora(solicitacao.data_reparo)}</span>
                      </div>
                    )}
                    {solicitacao.created_at_finalizacao && (
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-400">Finalizado:</span>
                        <span className="font-medium">{formatarDataHora(solicitacao.created_at_finalizacao)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seção: Finalização - Aguardando assinatura */}
              {solicitacao.status_chamado === 'Aguardando assinatura' && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dados da Finalização</h4>
                  
                  {solicitacao.responsaveis && solicitacao.responsaveis.length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 space-y-1.5">
                      <div className="text-xs">
                        <span className="font-medium text-gray-500">Responsáveis Técnicos</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {solicitacao.responsaveis.map((resp, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] bg-white px-1.5 py-0">{resp}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {solicitacao.providencias && (
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                      <span className="text-xs font-medium text-gray-500">Providências</span>
                      <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{solicitacao.providencias}</p>
                    </div>
                  )}

                  {/* NPS */}
                  {solicitacao.nps != null && (() => {
                    const npsVal = Number(solicitacao.nps);
                    return (
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Nota NPS</span>
                        <Badge className={`text-xs font-bold px-2 py-0.5 ${
                          npsVal >= 9 ? 'bg-green-600 text-white'
                          : npsVal >= 7 ? 'bg-blue-600 text-white'
                          : npsVal >= 5 ? 'bg-amber-500 text-white'
                          : 'bg-red-600 text-white'
                        }`}>
                          {npsVal}/10
                        </Badge>
                      </div>
                    );
                  })()}

                  {/* Contador de Dias */}
                  {solicitacao.created_at_finalizacao && (() => {
                    const dataFinalizacao = new Date(solicitacao.created_at_finalizacao);
                    const hoje = new Date();
                    const diferencaMs = hoje.getTime() - dataFinalizacao.getTime();
                    const diasPassados = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));
                    const diasRestantes = 7 - diasPassados;
                    if (diasPassados >= 7) {
                      return (
                        <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                          <span className="font-semibold text-green-700">Prazo de 7 dias expirado</span>
                          <p className="text-green-600 mt-0.5 text-[10px]">Disponível para finalizar com termo vencido</p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                          <span className="font-semibold text-blue-700">Aguardando assinatura do cliente</span>
                          <p className="text-blue-600 mt-0.5 text-[10px]">
                            {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
                          </p>
                        </div>
                      );
                    }
                  })()}

                  {!solicitacao.id_finalizacao && (
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                      Assistência movida manualmente. Finalize pelo botão para enviar o termo.
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer com Ações - compacto e fixo */}
          <div className="border-t border-gray-200 px-5 py-3 space-y-1.5 flex-shrink-0 bg-white">
            {/* Finalizar Chamado - Reparo agendado */}
            {solicitacao.status_chamado === 'Reparo agendado' && (
              <Button
                onClick={() => { setDrawerOpen(false); setTimeout(abrirDialogFinalizar, 250); }}
                disabled={carregando}
                className="w-full bg-black hover:bg-gray-800 text-white h-9 text-sm"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalizar Chamado
              </Button>
            )}

            {/* Reenviar Termo removido — fluxo automático via webhook */}

            {/* Gerar Termo PDF - 7 dias vencido */}
            {solicitacao.status_chamado === 'Aguardando assinatura' && solicitacao.id_finalizacao && passaram7Dias() && (
              <button
                onClick={() => {
                  setMostrarPDFViewer(true);
                }}
                disabled={mostrarPDFViewer}
                className="flex items-center justify-center gap-2 text-xs text-white bg-black hover:bg-gray-800 font-medium rounded-lg px-3 py-2 w-full transition-all disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5" />
                {mostrarPDFViewer ? 'Termo aberto ao lado' : 'Termo vencido (Visualizar)'}
              </button>
            )}

            {/* Desqualificar */}
            {onDesqualificar && solicitacao.status_chamado !== 'Aguardando assinatura' && (
              <button
                onClick={() => { setDrawerOpen(false); setTimeout(handleDesqualificar, 250); }}
                className="flex items-center justify-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium border border-red-200 rounded-lg px-3 py-2 w-full transition-all hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Desqualificar
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog para Desqualificação */}
      <Dialog open={showModalDesqualificacao} onOpenChange={setShowModalDesqualificacao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desqualificar Assistência #{solicitacao.id_assistencia_original || solicitacao.id}</DialogTitle>
            <DialogDescription>
              Selecione o motivo da desqualificação. Você poderá reverter esta ação através do histórico.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Desqualificação *</Label>
              <select
                id="motivo"
                value={motivoDesqualificacao}
                onChange={(e) => {
                  setMotivoDesqualificacao(e.target.value);
                  // Limpar justificativa se mudar para outro motivo
                  if (e.target.value !== 'Improcedente') {
                    setJustificativaDesqualificacao('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Selecione o motivo...</option>
                {MOTIVOS_DESQUALIFICACAO.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {motivo}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo de justificativa - aparece apenas quando motivo é "Improcedente" */}
            {motivoDesqualificacao === 'Improcedente' && (
              <div className="space-y-2">
                <Label htmlFor="justificativa">Justificativa da Improcedência *</Label>
                <textarea
                  id="justificativa"
                  value={justificativaDesqualificacao}
                  onChange={(e) => {
                    // Remover quebras de linha e limitar a 300 caracteres
                    const texto = e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 300);
                    setJustificativaDesqualificacao(texto);
                  }}
                  onKeyDown={(e) => {
                    // Prevenir quebras de linha
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  maxLength={300}
                  rows={4}
                  placeholder="Descreva o motivo da improcedência (máximo 300 caracteres)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
                <div className="text-xs text-gray-500 text-right">
                  {justificativaDesqualificacao.length}/300 caracteres
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowModalDesqualificacao(false);
                setMotivoDesqualificacao('');
                setJustificativaDesqualificacao('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarDesqualificacao}
              disabled={!motivoDesqualificacao || (motivoDesqualificacao === 'Improcedente' && !justificativaDesqualificacao.trim())}
            >
              Confirmar Desqualificação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de foto removido */}

      {/* Dialog para Finalizar Chamado */}
      <Dialog open={mostrarDialogFinalizar} onOpenChange={setMostrarDialogFinalizar}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden rounded-2xl border-[var(--border)]">
          <DialogTitle className="sr-only">Finalizar Chamado #{solicitacao.id_assistencia_original || solicitacao.id}</DialogTitle>
          <DialogDescription className="sr-only">
            Revise os dados e preencha as informações do reparo realizado
          </DialogDescription>
          
          {/* Header minimalista */}
          <div className="px-6 py-5 border-b border-[var(--border)] bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  Finalizar Chamado <span className="font-mono text-[var(--muted-foreground)]">#{solicitacao.id_assistencia_original || solicitacao.id}</span>
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Revise os dados e preencha as informações do reparo</p>
              </div>
            </div>
          </div>
          
          <ScrollArea className="max-h-[calc(95vh-160px)]">
            <div className="px-6 py-5 space-y-6">

              {/* Seção 1: Resumo da Solicitação */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Resumo da Solicitação</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
                
                <div className="bg-[var(--background-alt)] rounded-xl p-4 sm:p-5 border border-[var(--border)] space-y-4">
                  {/* Informações pessoais */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Proprietário
                      </span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.proprietario}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Telefone
                      </span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.telefone}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email
                      </span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] truncate">
                        {solicitacao.email}
                      </div>
                    </div>
                  </div>

                  {/* Informações do imóvel */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Empreendimento
                      </span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.empreendimento}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Bloco</span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.bloco}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Unidade</span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.unidade}
                      </div>
                    </div>
                  </div>

                  {/* Informações do reparo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        Categoria
                      </span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.categoria_reparo}
                      </div>
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Empresa Responsável</span>
                      <div className="bg-white rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                        {solicitacao.empresa_nome || 'Não atribuído'}
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Descrição do Problema</span>
                    <div className="bg-white rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] border border-[var(--border)] min-h-[52px] leading-relaxed">
                      {solicitacao.descricao_cliente}
                    </div>
                  </div>

                  {/* Datas */}
                  {(solicitacao.data_vistoria || solicitacao.data_reparo) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {solicitacao.data_vistoria && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Data Vistoria
                          </span>
                          <div className="bg-[var(--success-light)] rounded-lg px-3 py-2 text-sm font-medium text-[var(--success-dark)] border border-[var(--success)]/20">
                            {formatarDataHora(solicitacao.data_vistoria)}
                          </div>
                        </div>
                      )}
                      
                      {solicitacao.data_reparo && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Data Reparo
                          </span>
                          <div className="bg-[var(--background-secondary)] rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)]">
                            {formatarDataHora(solicitacao.data_reparo)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 2: Informações do Reparo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Informações do Reparo</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>

                <div className="space-y-5">
                  {/* 1. Responsável pelo reparo - Multiselect */}
                  <div className="space-y-2.5">
                    <Label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-1.5">
                      <User className="h-4 w-4 text-[var(--muted-foreground)]" />
                      Responsável(is) pelo reparo
                      <span className="text-[var(--error)]">*</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {['Adroaldo Rodrigues', 'Alessandro Alves', 'André Lopes', 'Edinaldo Abreu', 'Erivaldo', 'Emanuelly', 'Manoel Eziquiel', 'Ruil Rames', 'Paulo Sérgio', 'Raimundo da Cunha', 'Heliton Antônio', 'David Custódio', 'Kaio Vinicius', 'Manoel Francisco', 'Letícia Barcelos', 'Juliana Fonteles', 'Flávio Galdino', 'Rosana', 'Evânia', 'Marta'].map((nome) => (
                        <label
                          key={nome}
                          htmlFor={`resp-${nome}`}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                            responsaveis.includes(nome)
                              ? 'bg-black text-white border-black'
                              : 'bg-white border-[var(--border)] hover:border-[var(--foreground)]/30 text-[var(--foreground)]'
                          }`}
                        >
                          <Checkbox
                            id={`resp-${nome}`}
                            checked={responsaveis.includes(nome)}
                            onCheckedChange={() => toggleResponsavel(nome)}
                            className={`h-4 w-4 ${responsaveis.includes(nome) ? 'border-white data-[state=checked]:bg-white data-[state=checked]:text-black' : ''}`}
                          />
                          <span className="text-sm">{nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 2. Itens de Reparo */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-[var(--muted-foreground)]" />
                      Materiais Utilizados
                      <span className="text-[var(--error)]">*</span>
                    </Label>

                    {itensReparo.map((item, index) => (
                      <div key={index} className="bg-[var(--background-alt)] rounded-xl p-4 border border-[var(--border)] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Item {index + 1}</span>
                          {itensReparo.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removerItemReparo(index)}
                              className="h-6 px-2 text-xs text-[var(--error)] hover:text-[var(--error-dark)] hover:bg-[var(--error-light)]"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[40%_30%_25%] gap-2 sm:gap-[2.5%]">
                          {/* Material */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase">Material</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setMostrarModalNovoMaterial(true)}
                                className="h-5 px-1.5 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)]"
                              >
                                <Plus className="h-3 w-3 mr-0.5" />
                                Novo
                              </Button>
                            </div>
                            <select
                              value={item.material}
                              onChange={(e) => atualizarItemReparo(index, 'material', e.target.value)}
                              className="w-full h-9 px-2.5 py-1 text-sm border border-[var(--border)] rounded-lg focus:border-black focus:ring-1 focus:ring-black/10 bg-white text-[var(--foreground)] outline-none transition-all"
                            >
                              <option value="">Selecione...</option>
                              <option value="Nenhum material">⛔ Nenhum material</option>
                              {listaMateriais.map((material, idx) => (
                                <option key={idx} value={material}>{material}</option>
                              ))}
                            </select>
                          </div>

                          {/* Unidade de Medida */}
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase">Medida</span>
                            <select
                              value={item.unidade}
                              onChange={(e) => atualizarItemReparo(index, 'unidade', e.target.value)}
                              disabled={item.material === 'Nenhum material'}
                              className="w-full h-9 px-2.5 py-1 text-sm border border-[var(--border)] rounded-lg focus:border-black focus:ring-1 focus:ring-black/10 bg-white text-[var(--foreground)] outline-none transition-all disabled:bg-[var(--background-secondary)] disabled:cursor-not-allowed disabled:text-[var(--muted-foreground)]"
                            >
                              <option value="">Selecione...</option>
                              <option value="Metro">Metro</option>
                              <option value="m2">m2</option>
                              <option value="m3">m3 (Metros cúbicos)</option>
                              <option value="Litro">Litro</option>
                              <option value="Mililitro">Mililitro</option>
                              <option value="Unidade">Unidade</option>
                              <option value="Saco">Saco</option>
                              <option value="Lata">Lata</option>
                              <option value="Caixa">Caixa</option>
                              <option value="Grama">Grama</option>
                              <option value="Balde">Balde</option>
                              <option value="Quilograma">Quilograma</option>
                              <option value="Pacote">Pacote</option>
                              <option value="Centímetro">Centímetro</option>
                              <option value="Milímetro">Milímetro</option>
                            </select>
                          </div>

                          {/* Quantidade */}
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase">Qtd</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantidade}
                              onChange={(e) => atualizarItemReparo(index, 'quantidade', e.target.value)}
                              disabled={item.material === 'Nenhum material'}
                              placeholder="0"
                              className="h-9 text-sm border-[var(--border)] focus:border-black focus:ring-1 focus:ring-black/10 disabled:bg-[var(--background-secondary)] disabled:cursor-not-allowed disabled:text-[var(--muted-foreground)]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Botão + Item */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={adicionarItemReparo}
                      className="w-full border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background-alt)] hover:border-[var(--foreground)]/30"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar item
                    </Button>
                  </div>

                  {/* 3. Providências tomadas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-[var(--foreground)]">
                        Providências tomadas
                        <span className="text-[var(--error)] ml-1">*</span>
                      </Label>
                      <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md ${
                        providencias.length > 300 ? 'bg-[var(--warning-light)] text-[var(--warning-dark)]' : 'bg-[var(--background-secondary)] text-[var(--muted-foreground)]'
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
                      className="min-h-[100px] resize-none text-sm border-[var(--border)] focus:border-black focus:ring-1 focus:ring-black/10"
                      maxLength={350}
                    />
                  </div>

                  {/* 4. Foto do reparo realizado */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-[var(--muted-foreground)]" />
                      Foto do reparo realizado
                      <span className="text-[var(--error)]">*</span>
                    </Label>
                    
                    {!previewFotoReparo ? (
                      <div className="relative group">
                        <input
                          type="file"
                          id="foto-reparo"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="foto-reparo"
                          className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-xl p-8 cursor-pointer transition-all hover:border-black/40 hover:bg-[var(--background-alt)] group-hover:shadow-sm"
                        >
                          <div className="w-12 h-12 bg-[var(--background-secondary)] rounded-xl flex items-center justify-center mb-3 group-hover:bg-[var(--border)] transition-colors">
                            <Upload className="h-5 w-5 text-[var(--muted-foreground)]" />
                          </div>
                          <p className="text-sm font-medium text-[var(--foreground)] mb-0.5">Clique para fazer upload</p>
                          <p className="text-xs text-[var(--muted-foreground)]">PNG, JPG até 10MB</p>
                        </label>
                      </div>
                    ) : (
                      <div className="relative group rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
                        <img
                          src={previewFotoReparo}
                          alt="Preview do reparo"
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                        <button
                          onClick={removerFoto}
                          className="absolute top-3 right-3 bg-black/80 text-white p-2 rounded-lg hover:bg-black transition-all shadow-lg backdrop-blur-sm"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* NPS removido — coletado via fluxo de avaliação pós-assinatura */}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer minimalista */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--background-alt)] border-t border-[var(--border)]">
            <Button
              variant="outline"
              onClick={() => setMostrarDialogFinalizar(false)}
              className="px-5 rounded-lg border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-secondary)]"
            >
              Cancelar
            </Button>
            <Button
              onClick={finalizarChamado}
              disabled={
                responsaveis.length === 0 || 
                !itensReparo.every(item => {
                  if (item.material) {
                    if (item.material === 'Nenhum material') return true;
                    return item.unidade && item.quantidade;
                  }
                  return false;
                }) || 
                !providencias.trim() || 
                !fotoReparo
              }
              className="bg-black hover:bg-[var(--primary-hover)] text-white px-5 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Finalização
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Preview do Termo antes de enviar ao Clicksign */}
      <Dialog open={mostrarPreviewTermo} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-3xl max-h-[90vh] overflow-y-auto [&>button:last-child]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Termo de Assistência Técnica
            </DialogTitle>
            <DialogDescription>
              Verifique os dados do termo antes de enviar para assinatura do cliente.
            </DialogDescription>
          </DialogHeader>

          {dadosTermoPreview && (
            <div className="space-y-4">
              <Suspense fallback={<div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
                <TermoAssistenciaViewer dados={dadosTermoPreview} />
              </Suspense>

              {/* Foto do Reparo */}
              {fotoBase64Preview && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Foto do Reparo</p>
                  <img
                    src={fotoBase64Preview}
                    alt="Foto do reparo"
                    className="max-h-64 rounded-lg object-contain mx-auto"
                  />
                </div>
              )}

              {/* Loading Steps */}
              {enviandoClicksign && (
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  {envioSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {step.status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      )}
                      {step.status === 'loading' && (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      )}
                      {step.status === 'success' && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {step.status === 'error' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className={`text-sm ${
                        step.status === 'loading' ? 'text-blue-700 font-medium' :
                        step.status === 'success' ? 'text-green-700' :
                        step.status === 'error' ? 'text-red-700' :
                        'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center pt-4 border-t">
                <Button
                  onClick={enviarParaClicksign}
                  disabled={enviandoClicksign}
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                >
                  {enviandoClicksign ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Criar e enviar para assinatura
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mini-Modal para Adicionar Novo Material */}
      <Dialog open={mostrarModalNovoMaterial} onOpenChange={setMostrarModalNovoMaterial}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-900" />
              Adicionar Material
            </DialogTitle>
            <DialogDescription>
              Digite o nome do novo material para adicionar ao catálogo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="novo-material">Nome do Material</Label>
              <Input
                id="novo-material"
                value={novoMaterialNome}
                onChange={(e) => setNovoMaterialNome(e.target.value)}
                placeholder="Ex: Rejunte branco"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && novoMaterialNome.trim()) {
                    adicionarNovoMaterial();
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setMostrarModalNovoMaterial(false);
                setNovoMaterialNome('');
              }}
              disabled={salvandoNovoMaterial}
            >
              Cancelar
            </Button>
            <Button
              onClick={adicionarNovoMaterial}
              disabled={!novoMaterialNome.trim() || salvandoNovoMaterial}
              className="bg-black hover:bg-gray-800"
            >
              {salvandoNovoMaterial ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
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
                <Clock className="h-6 w-6 text-gray-600" />
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

      {/* Painel lateral direito - Visualizador do Termo (adjacente ao drawer) */}
      <div
        className={`fixed inset-y-0 z-[55] lg:z-[52] flex flex-col bg-white shadow-2xl border-l border-gray-200 transition-all duration-300 ease-in-out right-0 ${
          drawerOpen ? 'lg:right-[520px]' : ''
        } ${
          mostrarPDFViewer
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0 pointer-events-none'
        }`}
        style={{ width: 'min(480px, 100vw)' }}
      >
        {/* Header minimalista */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">Termo de Assistência</p>
            <p className="text-[11px] text-gray-400 leading-tight">
              Protocolo #{String(solicitacao.id_assistencia_original || solicitacao.id)}
            </p>
          </div>
          <button
            onClick={() => {
              if (!salvandoPDF) {
                setMostrarPDFViewer(false);
                setPdfSalvo(false);
                setTermoSalvoUrl(null);
              }
            }}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Conteúdo do Termo - HTML renderizado com scroll */}
        <div className="h-0 flex-1 overflow-y-auto bg-white">
          <Suspense fallback={<div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
            <TermoAssistenciaViewer dados={montarDadosTermo()} />
          </Suspense>
        </div>

        {/* Footer com ações - compacto */}
        <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0 bg-white">
          {verificandoTermo ? (
            <div className="flex items-center justify-center gap-2 py-1 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando termo...
            </div>
          ) : pdfSalvo ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 py-1 text-sm text-green-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Termo já salvo
              </div>
              {termoSalvoUrl && (
                <button
                  onClick={() => window.open(termoSalvoUrl, '_blank')}
                  className="flex items-center justify-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium border border-gray-200 rounded-lg px-3 py-2 w-full transition-colors hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Abrir PDF salvo
                </button>
              )}
              {/* Botão Enviar ao Sienge */}
              {enviadoSienge ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600 font-medium bg-blue-50 rounded-lg border border-blue-200">
                    <Building2 className="h-4 w-4" />
                    Enviado ao Sienge
                  </div>
                  {dataEnvioSienge && (
                    <p className="text-[10px] text-center text-gray-400">
                      em {new Date(dataEnvioSienge).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={enviarParaSienge}
                    disabled={enviandoSienge}
                    className="flex items-center justify-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg px-3 py-2.5 w-full transition-colors disabled:opacity-50"
                  >
                    {enviandoSienge ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Enviando ao Sienge...
                      </>
                    ) : (
                      <>
                        <Building2 className="h-3.5 w-3.5" />
                        Enviar ao Sienge
                      </>
                    )}
                  </button>

                  {/* Alerta + Botão de finalização manual (só aparece após erro do Sienge) */}
                  {erroSienge && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-medium text-amber-800">Sincronização falhou</p>
                          <p className="text-[10px] text-amber-600 leading-tight">
                            {erroSiengeMsg || 'Cliente não encontrado no Sienge.'}
                          </p>
                          <p className="text-[10px] text-amber-500 leading-tight">
                            Você pode subir o PDF manualmente no Sienge e finalizar o chamado aqui.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={finalizarManualmente}
                        disabled={finalizandoManual}
                        className="flex items-center justify-center gap-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 font-medium rounded-lg px-3 py-2.5 w-full transition-colors disabled:opacity-50"
                      >
                        {finalizandoManual ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Finalizando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Finalizar Manualmente
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={baixarPDF}
                disabled={salvandoPDF}
                className="flex items-center justify-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium border border-gray-200 rounded-lg px-3 py-2 flex-1 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF
              </button>
              <button
                onClick={salvarPDFeFinalizar}
                disabled={salvandoPDF}
                className="flex items-center justify-center gap-1.5 text-xs text-white bg-black hover:bg-gray-800 font-medium rounded-lg px-3 py-2 flex-[2] transition-colors disabled:opacity-50"
              >
                {salvandoPDF ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Salvar Termo
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Foto do Problema */}
      <Dialog open={mostrarModalFoto} onOpenChange={setMostrarModalFoto}>
        <DialogContent className="max-w-4xl w-full p-0 h-[700px] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ImageIcon className="h-5 w-5 text-gray-900" />
              Foto do Problema - {solicitacao.proprietario}
            </DialogTitle>
            <DialogDescription>
              Unidade: {solicitacao.bloco} {solicitacao.unidade} • {solicitacao.empreendimento}
            </DialogDescription>
          </DialogHeader>
          
          <div className="w-full bg-black flex items-center justify-center flex-1 overflow-auto">
            {carregandoFoto ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-white rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <p className="text-white text-sm">Carregando foto...</p>
              </div>
            ) : urlFoto ? (
              <img 
                src={urlFoto} 
                alt="Foto do problema" 
                className="max-w-full max-h-full object-contain"
                onError={() => {
                  toast.error('Erro ao carregar imagem');
                  setMostrarModalFoto(false);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-white text-sm">Foto não disponível</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
            <div className="text-xs text-gray-600">
              {urlFoto && (
                <span>Assistência #{solicitacao.id_assistencia_original || solicitacao.id}</span>
              )}
            </div>
            <div className="flex gap-2">
              {urlFoto && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const idReal = solicitacao.id_assistencia_original || solicitacao.id;
                    const link = document.createElement('a');
                    link.href = urlFoto;
                    link.download = `assistencia-${idReal}-foto.jpg`;
                    link.target = '_blank';
                    link.click();
                  }}
                  className="px-4"
                >
                  Baixar Foto
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setMostrarModalFoto(false)}
                className="px-6"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

KanbanCard.displayName = 'KanbanCard';

const KanbanColumn = memo(function KanbanColumn({ coluna, solicitacoes, onAtualizarStatus, onAtualizarDatas, formatarData, onDesqualificar, onWebhookResponse, onRecarregarDados, totalReal }: KanbanColumnProps) {
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.CARD,
    canDrop: (item: { solicitacao: Solicitacao }) => {
      // Não permitir drop na coluna "Aguardando assinatura"
      if (coluna.id === 'Aguardando assinatura') {
        return false;
      }
      return true;
    },
    drop: (item: { solicitacao: Solicitacao }) => {
      const validacao = validarMovimento(item.solicitacao, coluna.id);
      
      if (!validacao.permitido) {
        setErroValidacao(validacao.mensagem || 'Movimento não permitido');
        setTimeout(() => setErroValidacao(null), 5000);
        return;
      }

      if (item.solicitacao.status_chamado !== coluna.id) {
        console.log(`Card ${item.solicitacao.id} movido de "${item.solicitacao.status_chamado}" para "${coluna.id}"`);
        onAtualizarStatus(item.solicitacao.id, coluna.id);
        setErroValidacao(null);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const isActive = isOver && canDrop;

  return (
    <div
      ref={drop as any}
      className={`flex-1 min-w-[280px] flex flex-col rounded-2xl border transition-[border-color,background-color,box-shadow] duration-200 ${
        isActive 
          ? 'border-black border-dashed bg-gray-50 shadow-lg' 
          : 'border-gray-200 bg-[#FAFAFA]'
      }`}
    >
      {/* Header integrado */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-2xl">
        <h3 className="text-sm font-semibold text-gray-900">{coluna.titulo}</h3>
        <div className="flex items-center gap-1.5">
          {totalReal != null && totalReal > 0 && solicitacoes.length < totalReal && (
            <span className="text-[10px] text-gray-400 tabular-nums">
              {solicitacoes.length}/
            </span>
          )}
          <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 tabular-nums">
            {totalReal != null ? totalReal : solicitacoes.length}
          </span>
        </div>
      </div>

      {erroValidacao && (
        <div className="mx-3 mt-3">
          <Alert className="border border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700 text-sm">
              {erroValidacao}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 min-h-[500px] space-y-3 p-3">
        {solicitacoes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {totalReal != null && totalReal > 0 ? (
              <>
                <p className="text-sm font-medium text-gray-500">{totalReal} {totalReal === 1 ? 'chamado' : 'chamados'} no banco</p>
                <p className="text-xs mt-1">Carregue mais registros para visualizar</p>
              </>
            ) : (
              <p className="text-sm">Nenhuma solicitação</p>
            )}
          </div>
        ) : (
          solicitacoes.map((sol) => (
            <KanbanCard
              key={sol.id}
              solicitacao={sol}
              formatarData={formatarData}
              onAtualizarDatas={onAtualizarDatas}
              onAtualizarStatus={onAtualizarStatus}
              onDesqualificar={onDesqualificar}
              onWebhookResponse={onWebhookResponse}
              onRecarregarDados={onRecarregarDados}
            />
          ))
        )}
      </div>
    </div>
  );
});

KanbanColumn.displayName = 'KanbanColumn';

export function KanbanBoard({
  solicitacoes,
  colunas, 
  onAtualizarStatus, 
  formatarData, 
  onAtualizarSolicitacao, 
  onRecarregarDados, 
  onDesqualificar,
  onCarregarMais,
  temMaisPaginas,
  carregandoMais,
  totalCarregados,
  totalRegistros,
  contagemPorStatus
}: KanbanBoardProps) {
  // ═══ Drag-to-scroll horizontal ═══
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleScrollMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Não iniciar scroll se clicar em cards ou elementos interativos
    if (target.closest('[data-kanban-card], button, input, select, textarea, a, label, [role="dialog"], [data-slot]')) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;
    // Só se o container for scrollável
    if (container.scrollWidth <= container.clientWidth) return;

    const startX = e.pageX;
    const scrollLeftStart = container.scrollLeft;
    let hasMoved = false;

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.pageX - startX;
      if (Math.abs(dx) > 5) {
        hasMoved = true;
        container.scrollLeft = scrollLeftStart - dx;
        container.style.cursor = 'grabbing';
        container.style.userSelect = 'none';
      }
    };

    const onMouseUp = () => {
      if (hasMoved) {
        container.style.cursor = '';
        container.style.userSelect = '';
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Estados para modal de resposta do webhook
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(200);
  const [webhookResponse, setWebhookResponse] = useState('');
  
  // 🔍 Estados para filtros
  const [filtroId, setFiltroId] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  
  // 🤖 Estado para batch analysis
  const [analisandoBatch, setAnalisandoBatch] = useState(false);
  
  // 🤖 Analisar em batch apenas chamados sem análise (coluna "Abertos")
  const analisarTodosSemAnalise = async () => {
    try {
      setAnalisandoBatch(true);
      
      // Filtrar chamados da coluna "Abertos" que não têm análise GPT
      const chamadosSemAnalise = solicitacoes
        .filter(s => 
          s.status_chamado === 'Abertos' && 
          !s.gpt_classificacao &&
          s.descricao_cliente && 
          s.categoria_reparo
        )
        .map(s => ({
          id: typeof s.id === 'string' && s.id.startsWith('finalizada-') ? s.id_assistencia_original : s.id,
          descricao_cliente: s.descricao_cliente,
          categoria_reparo: s.categoria_reparo,
          empreendimento: s.empreendimento,
          bloco: s.bloco,
          unidade: s.unidade,
          proprietario: s.proprietario,
        }))
        .filter(s => s.id); // Garantir ID válido
      
      if (chamadosSemAnalise.length === 0) {
        toast.success('Todos os chamados abertos já possuem análise');
        return;
      }
      
      toast(`Analisando ${chamadosSemAnalise.length} chamados...`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/ai/analyze-batch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chamados: chamadosSemAnalise }),
        }
      );
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }
      
      const result = await response.json();
      toast.success(`${result.analisados} chamados analisados com sucesso`);
      
      // Recarregar dados para atualizar as análises
      if (onRecarregarDados) {
        await onRecarregarDados();
      }
    } catch (error) {
      console.error('❌ Erro no batch analysis:', error);
      toast.error(`Erro na análise: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAnalisandoBatch(false);
    }
  };
  
  // 🔍 Filtrar solicitações com memoização (evita recálculo a cada render)
  const solicitacoesFiltradas = useMemo(() => solicitacoes.filter((sol) => {
    const matchId = filtroId === '' || sol.id.toString().includes(filtroId);
    const matchNome = filtroNome === '' ||
      sol.proprietario?.toLowerCase().includes(filtroNome.toLowerCase());
    return matchId && matchNome;
  }), [solicitacoes, filtroId, filtroNome]);
  
  // Função para abrir o modal com a resposta do webhook
  const handleWebhookResponse = useCallback((status: number, response: string) => {
    setWebhookStatus(status);
    setWebhookResponse(response);
    setWebhookModalOpen(true);
  }, []);
  
  const atualizarDatas = useCallback(async (id: number | string, campo: 'data_vistoria' | 'data_reparo', valor: string) => {
    console.log(`Iniciando atualização de ${campo} para solicitação #${id}`);
    console.log('Valor recebido (já com fuso horário):', valor);
    
    try {
      // 🌎 Não converter novamente - o valor já vem no formato ISO com fuso horário correto
      const isoDate = valor;
      console.log('Data que será salva:', isoDate);
      
      // 🔑 Se o ID for composto (string começando com "finalizada-"), extrair o ID original
      let idReal = id;
      if (typeof id === 'string' && id.startsWith('finalizada-')) {
        const solicitacao = solicitacoes.find(s => s.id === id);
        if (solicitacao?.id_assistencia_original) {
          idReal = solicitacao.id_assistencia_original;
          console.log(`📋 ID composto detectado. Usando ID original: ${idReal}`);
        }
      }
      
      // Atualizar estado local imediatamente (otimistic update)
      if (onAtualizarSolicitacao) {
        onAtualizarSolicitacao(id, campo, isoDate);
      }
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia/${idReal}/data`;
      console.log('URL da requisição:', url);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ [campo]: isoDate }),
      });

      console.log('Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta:', errorText);
        throw new Error(`Erro ao atualizar ${campo}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`✓ ${campo} atualizado com sucesso para solicitação #${id}`, result);
      
      // Recarregar dados do backend para sincronizar
      if (onRecarregarDados) {
        console.log('🔄 Recarregando dados do servidor...');
        await onRecarregarDados();
        console.log('✓ Dados recarregados com sucesso!');
      }
      
    } catch (error) {
      console.error(`Erro ao atualizar ${campo}:`, error);
      throw error;
    }
  }, [solicitacoes, onAtualizarSolicitacao, onRecarregarDados]);

  return (
    <div className="space-y-4">
      {/* 🔍 Filtros (fora do scroll, sempre visíveis) */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="filtro-id"
            type="text"
            placeholder="Buscar por ID..."
            value={filtroId}
            onChange={(e) => setFiltroId(e.target.value)}
            className="h-9 pl-9 text-sm bg-[#F3F3F3] border-0 rounded-lg focus:ring-1 focus:ring-black transition-all"
          />
        </div>
        
        <div className="relative flex-1 max-w-xs">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="filtro-nome"
            type="text"
            placeholder="Buscar por nome..."
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            className="h-9 pl-9 text-sm bg-[#F3F3F3] border-0 rounded-lg focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        {(filtroId || filtroNome) && (
          <>
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
              {solicitacoesFiltradas.length} {solicitacoesFiltradas.length === 1 ? 'resultado' : 'resultados'}
            </span>
            <button
              onClick={() => {
                setFiltroId('');
                setFiltroNome('');
              }}
              className="text-xs text-gray-400 hover:text-black transition-colors whitespace-nowrap"
            >
              Limpar
            </button>
          </>
        )}
        
        {/* Botão Analisar com IA */}
        <div className="ml-auto">
          <button
            onClick={analisarTodosSemAnalise}
            disabled={analisandoBatch}
            className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {analisandoBatch ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Brain className="h-3.5 w-3.5" />
                Analisar com IA
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Mensagem quando não há resultados */}
      {(filtroId || filtroNome) && solicitacoesFiltradas.length === 0 && (
        <div className="rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Nenhum chamado encontrado com os filtros aplicados.</p>
          <button
            onClick={() => {
              setFiltroId('');
              setFiltroNome('');
            }}
            className="text-sm font-medium text-black hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Board do Kanban — container com scroll horizontal */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleScrollMouseDown}
        className="overflow-x-auto pb-2 kanban-scroll w-full max-w-full"
      >
        <div className="flex gap-4 pb-2 items-stretch" style={{ minWidth: '1100px' }}>
          {colunas.map((coluna) => {
            const solicitacoesDaColuna = solicitacoesFiltradas.filter(
              (sol) => sol.status_chamado === coluna.id
            );
            return (
              <KanbanColumn
                key={coluna.id}
                coluna={coluna}
                solicitacoes={solicitacoesDaColuna}
                onAtualizarStatus={onAtualizarStatus}
                onAtualizarDatas={atualizarDatas}
                formatarData={formatarData}
                onDesqualificar={onDesqualificar}
                onWebhookResponse={handleWebhookResponse}
                onRecarregarDados={onRecarregarDados}
                totalReal={contagemPorStatus?.[coluna.id]}
              />
            );
          })}
        </div>
      </div>

      {/* Contador + Botão "Carregar mais" */}
      <div className="flex flex-col items-center gap-3 pt-4">
        {/* Contador de registros carregados */}
        {(totalRegistros ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 tabular-nums">
              {totalCarregados} de {totalRegistros} chamados carregados
            </span>
            {(totalCarregados ?? 0) < (totalRegistros ?? 0) && (
              <div className="h-1.5 w-32 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-black rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((totalCarregados ?? 0) / (totalRegistros || 1)) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {temMaisPaginas && onCarregarMais && (
          <button
            onClick={onCarregarMais}
            disabled={carregandoMais}
            className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-3"
          >
            {carregandoMais ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Carregando mais chamados...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span>Carregar mais 50 chamados</span>
              </>
            )}
          </button>
        )}

        {!temMaisPaginas && (totalRegistros ?? 0) > 0 && (totalCarregados ?? 0) >= (totalRegistros ?? 0) && (
          <span className="text-xs text-gray-400">Todos os chamados foram carregados</span>
        )}
      </div>
      
      {/* Modal de resposta do webhook */}
      <WebhookResponseModal
        isOpen={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
        status={webhookStatus}
        response={webhookResponse}
      />
    </div>
  );
}