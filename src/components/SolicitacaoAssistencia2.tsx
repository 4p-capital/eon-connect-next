"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2, AlertCircle, Upload, User, Mail, CreditCard, Phone,
  Building2, Home, Wrench, ImageIcon, X, Shield, FileCheck, ArrowRight,
  Search, UserPlus, Loader2, ChevronLeft, ClipboardList, Pencil, Camera,
  ChevronDown, Clock, Tag, RefreshCw, Send
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { PoliticaPrivacidade } from '@/components/PoliticaPrivacidade';
import { TermoAssistenciaTecnica } from '@/components/TermoAssistenciaTecnica';
import { CpfValidator } from '@/components/CpfValidator';
import logoBP from '@/assets/88bb647dfb4b82c653ac9fce1996fdda2b3c8f17.png';

interface ChamadoResumo {
  id: number;
  categoria_reparo: string;
  status_chamado: string;
  descricao_cliente: string;
  situacao: string;
  created_at: string;
  status_finalizacao?: string;
  // Dados do chamado (podem vir do backend)
  data_vistoria?: string;
  data_reparo?: string;
  empresa_nome?: string;
  // Dados da finalização (enriquecidos pelo backend para reenvio direto)
  id_finalizacao?: number;
  fin_responsaveis?: string[];
  fin_providencias?: string;
  fin_itens_reparo?: unknown[];
  fin_nps?: number;
  fin_data_finalizacao?: string;
  fin_status?: string;
}

// MODO MANUTENCAO
const EM_MANUTENCAO = false;

// Removido: EMPREENDIMENTOS estático — agora carrega dinamicamente do banco

const CATEGORIAS = [
  'Infiltração',
  'Entupimento das Tubulações',
  'Cerâmica Piso ou Parede',
  'Piso de Madeira',
  'Portas ou Janelas',
  'Tanque, Pia ou Vaso Sanitário',
  'Elétrica e Fiação',
  'Pintura, Trincas ou Fissuras',
  'Área Comum/Condomínio',
  'Outros',
];

interface ClienteData {
  id: number;
  proprietario: string;
  cpf: string;
  email: string;
  telefone: string;
  bloco: string;
  unidade: string;
  empreendimento: string;
  idSindico?: number | null;
}

type Step = 'termos' | 'cpf' | 'cadastro' | 'sindico-empreendimento' | 'solicitacao';

export function SolicitacaoAssistencia2() {
  // Step control
  const [currentStep, setCurrentStep] = useState<Step>('termos');
  const [cliente, setCliente] = useState<ClienteData | null>(null);

  // Termos
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [aceitouTermo, setAceitouTermo] = useState(false);
  const [mostrarPolitica, setMostrarPolitica] = useState(false);
  const [mostrarTermo, setMostrarTermo] = useState(false);

  // CPF step
  const [cpfBusca, setCpfBusca] = useState('');
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [cpfError, setCpfError] = useState('');

  // Cadastro step
  const [cadastroData, setCadastroData] = useState({
    nome: '',
    sobrenome: '',
    email: '',
    telefone: '',
    bloco: '',
    unidade: '',
    empreendimento: '',
  });
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [tipoCadastro, setTipoCadastro] = useState<'cliente' | 'sindico' | null>(null);
  const [empreendimentosList, setEmpreendimentosList] = useState<Record<string, unknown>[]>([]);
  const [sindicosList, setSindicosList] = useState<Record<string, unknown>[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<number | null>(null);
  const [selectedSindicoId, setSelectedSindicoId] = useState<number | null>(null);

  // Chamados do cliente
  const [chamadosCliente, setChamadosCliente] = useState<ChamadoResumo[]>([]);
  const [carregandoChamados, setCarregandoChamados] = useState(false);
  const [chamadosAberto, setChamadosAberto] = useState(false);
  const [temPendenciaAssinatura, setTemPendenciaAssinatura] = useState(false);
  const [reenviandoTermo, setReenviandoTermo] = useState<number | null>(null); // ID do chamado sendo reenviado

  // Sindico empreendimento step
  const [sindicoEmpreendimentoSelecionado, setSindicoEmpreendimentoSelecionado] = useState('');
  const [sindicoEmpreendimentoIdSelecionado, setSindicoEmpreendimentoIdSelecionado] = useState<number | null>(null);
  const [atualizandoEmpreendimento, setAtualizandoEmpreendimento] = useState(false);

  // Solicitacao step
  const [solicitacaoData, setSolicitacaoData] = useState({
    categoria: '',
    descricao: '',
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoError, setFotoError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Edicao de contato
  const [editandoEmail, setEditandoEmail] = useState(false);
  const [editandoTelefone, setEditandoTelefone] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const telefoneInputRef = useRef<HTMLInputElement>(null);

  // General
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alert && alertRef.current) {
      alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [alert]);

  useEffect(() => {
    if (editandoEmail && emailInputRef.current) emailInputRef.current.focus();
  }, [editandoEmail]);

  useEffect(() => {
    if (editandoTelefone && telefoneInputRef.current) telefoneInputRef.current.focus();
  }, [editandoTelefone]);

  // Pré-selecionar o empreendimento do síndico quando a lista carrega
  useEffect(() => {
    if (
      currentStep === 'sindico-empreendimento' &&
      sindicosList.length > 0 &&
      cliente?.empreendimento &&
      !sindicoEmpreendimentoSelecionado
    ) {
      const empreendimentoAtual = cliente.empreendimento;
      const match = sindicosList.find(i => {
        const nome = String(i.nome || i.Nome || i.name || '');
        return nome === empreendimentoAtual;
      });
      if (match) {
        console.log(`🏢 Pré-selecionando empreendimento do síndico: ${empreendimentoAtual}`);
        setSindicoEmpreendimentoSelecionado(empreendimentoAtual);
        // Usar getItemId (mesmo helper do onValueChange do Select) — tabela sindicos não tem coluna "id" padrão
        const matchId = getItemId(match);
        console.log(`🔑 ID do sindico match:`, matchId, `| Colunas:`, Object.keys(match));
        setSindicoEmpreendimentoIdSelecionado(matchId);
      }
    }
  }, [currentStep, sindicosList, cliente?.empreendimento]);

  // Helper: extrair o PK de um item (tenta id, ID, primeiro campo numérico)
  const getItemId = (item: Record<string, unknown>): number | null => {
    if (item.id != null) return Number(item.id);
    if (item.ID != null) return Number(item.ID);
    // Tentar campos comuns de PK
    for (const key of Object.keys(item)) {
      if (key.toLowerCase() === 'id' || key.toLowerCase().startsWith('id_') || key.toLowerCase().endsWith('_id')) {
        const val = item[key];
        if (val != null && !isNaN(Number(val))) return Number(val);
      }
    }
    // Fallback: primeiro campo numérico que não seja timestamp
    for (const key of Object.keys(item)) {
      const val = item[key];
      if (typeof val === 'number' && !key.toLowerCase().includes('created') && !key.toLowerCase().includes('updated')) return val;
    }
    return null;
  };

  // Helper: extrair ID do cliente e normalizar para o campo "id" do state
  const extractClienteWithId = (data: Record<string, unknown>): ClienteData | null => {
    if (!data) {
      console.error('❌ extractClienteWithId chamado com data null/undefined');
      return null;
    }
    const extractedId = getItemId(data);
    if (!extractedId) {
      console.warn('⚠️ Não foi possível extrair ID do cliente. Colunas recebidas:', Object.keys(data), 'Dados:', JSON.stringify(data).substring(0, 500));
      // Prosseguir mesmo sem ID — o backend pode fazer fallback por CPF
      console.warn('⚠️ Prosseguindo sem ID (backend usará CPF como fallback)');
    } else {
      console.log(`✅ Cliente ID extraído: ${extractedId} (colunas: ${Object.keys(data).join(', ')})`);
    }
    return {
      id: extractedId || 0,
      proprietario: String(data.proprietario || data.nome || data.Nome || ''),
      cpf: String(data.cpf || cpfBusca || ''),
      email: String(data.email || ''),
      telefone: String(data.telefone || ''),
      bloco: String(data.bloco || ''),
      unidade: String(data.unidade || ''),
      empreendimento: String(data.empreendimento || ''),
      idSindico: data.idSindico != null ? Number(data.idSindico) : null,
    };
  };

  const getItemNome = (item: Record<string, unknown>): string => {
    return String(item.nome || item.Nome || item.name || '');
  };

  // Carregar lista ao escolher tipo
  const carregarEmpreendimentos = async () => {
    setCarregandoLista(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/empreendimentos`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result = await res.json();
      if (res.ok) {
        console.log('📋 Empreendimentos recebidos:', result.empreendimentos);
        setEmpreendimentosList(result.empreendimentos || []);
      }
    } catch (e) { console.error('Erro ao carregar empreendimentos:', e); }
    finally { setCarregandoLista(false); }
  };

  const carregarSindicos = async () => {
    setCarregandoLista(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/sindicos`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result = await res.json();
      if (res.ok) {
        console.log('📋 Síndicos recebidos:', result.sindicos);
        setSindicosList(result.sindicos || []);
      }
    } catch (e) { console.error('Erro ao carregar síndicos:', e); }
    finally { setCarregandoLista(false); }
  };

  const handleTipoCadastro = (tipo: 'cliente' | 'sindico') => {
    setTipoCadastro(tipo);
    setSelectedEmpreendimentoId(null);
    setSelectedSindicoId(null);
    setCadastroData(prev => ({ ...prev, empreendimento: '', bloco: '', unidade: '' }));
    if (tipo === 'cliente') carregarEmpreendimentos();
    else carregarSindicos();
  };

  // === FORMATTERS ===
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const validarCPF = (cpf: string) => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
    let soma = 0;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;
    return true;
  };

  const formatCelular = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)} ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const cleanPhoneNumber = (value: string) => `55${value.replace(/\D/g, '')}`;

  // === BUSCAR CHAMADOS DO CLIENTE ===
  const carregarChamadosCliente = async (clienteId: number) => {
    setCarregandoChamados(true);
    setChamadosCliente([]);
    setTemPendenciaAssinatura(false);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/chamados-cliente/${clienteId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result = await res.json();
      if (res.ok) {
        const chamados = result.chamados || [];
        console.log(`📋 Chamados do cliente #${clienteId}: ${chamados.length}, pendência assinatura (backend): ${result.temPendenciaAssinatura}`);
        console.log(`📋 Status dos chamados:`, chamados.map((ch: ChamadoResumo) => ({ id: ch.id, status: ch.status_chamado, finalizacao: ch.status_finalizacao, id_finalizacao: ch.id_finalizacao, situacao: ch.situacao })));
        setChamadosCliente(chamados);
        // Derivar flag de AMBAS as fontes: backend flag + verificação local do status_chamado
        const pendenciaBackend = result.temPendenciaAssinatura || false;
        const pendenciaLocal = chamados.some((ch: ChamadoResumo) => 
          ch.status_chamado?.toLowerCase().includes('aguardando') || 
          ch.status_finalizacao?.toLowerCase().includes('aguardando')
        );
        const pendenciaFinal = pendenciaBackend || pendenciaLocal;
        console.log(`🔍 Pendência assinatura: backend=${pendenciaBackend}, local=${pendenciaLocal}, final=${pendenciaFinal}`);
        setTemPendenciaAssinatura(pendenciaFinal);
        // Se há pendência, abrir accordion automaticamente
        if (pendenciaFinal) {
          setChamadosAberto(true);
        }
      } else {
        console.error('❌ Erro ao buscar chamados:', result.error);
      }
    } catch (e) {
      console.error('❌ Erro de conexão ao buscar chamados:', e);
    } finally {
      setCarregandoChamados(false);
    }
  };

  // === REENVIAR TERMO (funciona com ou sem dados de finalização) ===
  // Alinhado com o payload do KanbanBoard: faz fallback via /by-assistencia se cache não tem id_finalizacao
  const reenviarTermo = async (chamadoId: number) => {
    if (!cliente) return;
    setReenviandoTermo(chamadoId);
    setAlert(null);
    try {
      console.log(`🔄 Reenviando termo para chamado #${chamadoId}`);

      // 1. Buscar chamado na lista
      const chamado = chamadosCliente.find(c => c.id === chamadoId);
      if (!chamado) {
        setAlert({ type: 'error', message: 'Chamado não encontrado na lista.' });
        return;
      }

      // 2. Dados de finalização: primeiro tenta do cache (chamados-cliente), senão busca via /by-assistencia
      let idFinalizacao = chamado.id_finalizacao || null;
      let finResponsaveis = chamado.fin_responsaveis || [];
      let finProvidencias = chamado.fin_providencias || 'Não informado';
      let finItensReparo = chamado.fin_itens_reparo || [];
      let finNps = chamado.fin_nps || null;
      let finDataFinalizacao = chamado.fin_data_finalizacao || null;
      let finStatus = chamado.fin_status || 'Aguardando assinatura';
      let finFotoReparo: string | null = null;
      let finCreatedAt: string | null = null;

      // 🔍 FALLBACK: Se não temos id_finalizacao do cache, buscar diretamente (mesmo fluxo do Kanban)
      if (!idFinalizacao) {
        console.log(`⚠️ id_finalizacao ausente no cache. Buscando via /by-assistencia/${chamadoId}...`);
        try {
          const urlFinalizacao = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/by-assistencia/${chamadoId}`;
          const resFin = await fetch(urlFinalizacao, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
            signal: AbortSignal.timeout(10000),
          });

          if (resFin.ok) {
            const resultFin = await resFin.json();
            const dadosFin = Array.isArray(resultFin.data) ? resultFin.data[0] : resultFin.data;
            if (dadosFin && dadosFin.id) {
              console.log(`✅ Finalização encontrada via fallback: id=${dadosFin.id}`);
              idFinalizacao = dadosFin.id;
              finResponsaveis = dadosFin.responsaveis || [];
              finProvidencias = dadosFin.providencias || 'Não informado';
              finItensReparo = dadosFin.itens_reparo || [];
              finNps = dadosFin.nps || null;
              finDataFinalizacao = dadosFin.data_finalizacao || null;
              finStatus = dadosFin.status || 'Aguardando assinatura';
              finFotoReparo = dadosFin.foto_reparo || null;
              finCreatedAt = dadosFin.created_at || null;
            } else {
              console.log(`ℹ️ Nenhuma finalização encontrada para chamado #${chamadoId}`);
            }
          } else {
            const errText = await resFin.text();
            console.warn(`⚠️ Erro ao buscar finalização via fallback (${resFin.status}):`, errText);
          }
        } catch (fetchErr) {
          console.warn('⚠️ Falha no fallback de finalização (timeout ou rede):', fetchErr);
        }
      }

      console.log(`📋 Dados da finalização: id_finalizacao=${idFinalizacao}, tem_dados=${!!idFinalizacao}`);

      // 3. Helper para remover pontos finais (ClickSign não aceita)
      const removePontoFinal = (text: string | null | undefined): string => {
        if (!text) return '';
        return text.trim().replace(/\.+$/, '');
      };

      // 4. Info da foto (sem base64 para reduzir tamanho)
      let fotoInfo = null;
      if (finFotoReparo) {
        const fotoSizeKB = (finFotoReparo.length * 0.75) / 1024;
        const fotoSizeMB = fotoSizeKB / 1024;
        fotoInfo = {
          tamanho_kb: Math.round(fotoSizeKB),
          tamanho_mb: fotoSizeMB.toFixed(2),
          formato: finFotoReparo.substring(5, finFotoReparo.indexOf(';')),
        };
        console.log(`📸 Foto detectada: ${fotoInfo.tamanho_kb} KB (${fotoInfo.tamanho_mb} MB)`);
      }

      // 5. Gerar PDF do termo e enviar via Clicksign + Z-API
      if (!idFinalizacao) {
        setAlert({ type: 'error', message: 'Dados de finalização não encontrados para este chamado.' });
        return;
      }

      console.log('📄 Gerando PDF do termo...');
      const { gerarTermoBlob } = await import('@/components/TermoAssistenciaPDF');
      // Buscar foto do reparo se não veio no cache
      if (!finFotoReparo && idFinalizacao) {
        try {
          const fotoResp = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/${idFinalizacao}/foto-reparo`,
            { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
          );
          if (fotoResp.ok) {
            const fotoData = await fotoResp.json();
            finFotoReparo = fotoData.foto_reparo || null;
          }
        } catch {
          console.warn('Foto do reparo não disponível');
        }
      }

      const dadosTermo = {
        id: chamadoId,
        id_finalizacao: idFinalizacao,
        proprietario: cliente.proprietario,
        cpf: cliente.cpf,
        email: cliente.email,
        telefone: cliente.telefone,
        bloco: cliente.bloco,
        unidade: cliente.unidade,
        empreendimento: cliente.empreendimento,
        descricao_cliente: chamado.descricao_cliente || '',
        categoria_reparo: chamado.categoria_reparo || '',
        created_at: chamado.created_at || '',
        data_vistoria: chamado.data_vistoria || null,
        data_reparo: chamado.data_reparo || null,
        empresa_nome: chamado.empresa_nome || null,
        responsaveis: finResponsaveis,
        providencias: finProvidencias,
        nps: finNps,
        assinaturaVencida: false,
        foto_reparo_base64: finFotoReparo && finFotoReparo.includes(',')
          ? finFotoReparo.split(',')[1]
          : (finFotoReparo || undefined),
      };

      const pdfBlob = gerarTermoBlob(dadosTermo);

      // Converter blob para base64
      const pdfBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(pdfBlob);
      });

      console.log('📤 Enviando para Clicksign...');
      const { enviarTermoParaAssinatura } = await import('@/services/clicksign.service');
      const clicksignResult = await enviarTermoParaAssinatura({
        pdf_base64: pdfBase64,
        filename: `termo-assistencia-${chamadoId}.pdf`,
        signer_name: cliente.proprietario,
        signer_email: cliente.email,
        signer_phone: cliente.telefone,
        signer_cpf: cliente.cpf,
        id_assistencia: chamadoId,
        id_finalizacao: idFinalizacao,
      });

      if (clicksignResult.success) {
        console.log('✅ Termo enviado para assinatura digital:', clicksignResult.data);
        setAlert({ type: 'success', message: 'Termo enviado para assinatura! Verifique seu WhatsApp.' });
      } else {
        console.error('❌ Erro no Clicksign:', clicksignResult.error);
        setAlert({ type: 'error', message: 'Erro ao enviar termo para assinatura. Tente novamente.' });
      }
    } catch (error) {
      console.error('❌ Erro ao reenviar termo:', error);
      setAlert({ type: 'error', message: 'Erro de conexão ao reenviar termo. Verifique sua internet.' });
    } finally {
      setReenviandoTermo(null);
    }
  };

  // === STEP 1: BUSCAR CPF ===
  const handleBuscarCPF = async () => {
    setAlert(null);
    setCpfError('');
    if (!validarCPF(cpfBusca)) {
      setCpfError('CPF inválido. Verifique os dígitos.');
      return;
    }
    setBuscandoCpf(true);
    try {
      const cpfLimpo = cpfBusca.replace(/\D/g, '');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/clientes-cpf/${cpfLimpo}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const result = await response.json();
      if (!response.ok) { setCpfError(result.error || 'Erro ao buscar CPF'); return; }
      if (result.found && result.cliente) {
        console.log('📋 Cliente encontrado por CPF — colunas:', Object.keys(result.cliente), JSON.stringify(result.cliente).substring(0, 500));
        const clienteNormalizado = extractClienteWithId(result.cliente);
        if (!clienteNormalizado) {
          setCpfError('Erro ao processar dados do cliente. Contate o suporte.');
          return;
        }
        setCliente(clienteNormalizado);
        // Carregar chamados existentes do cliente
        if (clienteNormalizado.id) {
          carregarChamadosCliente(clienteNormalizado.id);
        }
        // Se é síndico (tem idSindico), redirecionar para seleção de empreendimento
        if (clienteNormalizado.idSindico) {
          console.log(`🏢 Síndico detectado (idSindico=${clienteNormalizado.idSindico}). Redirecionando para seleção de empreendimento.`);
          carregarSindicos();
          setCurrentStep('sindico-empreendimento');
        } else {
          setCurrentStep('solicitacao');
        }
      } else {
        setCadastroData(prev => ({ ...prev }));
        setCurrentStep('cadastro');
      }
    } catch (error) {
      console.error('Erro ao buscar CPF:', error);
      setCpfError('Erro de conexão. Tente novamente.');
    } finally {
      setBuscandoCpf(false);
    }
  };

  // === STEP 2: CADASTRAR CLIENTE ===
  const handleCadastrarCliente = async () => {
    setAlert(null);

    // Validação diferente para síndico (sem bloco/unidade)
    const isSindico = tipoCadastro === 'sindico';
    if (!cadastroData.nome || !cadastroData.sobrenome || !cadastroData.empreendimento || !cadastroData.email || !cadastroData.telefone) {
      setAlert({ type: 'error', message: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    if (!isSindico && (!cadastroData.bloco || !cadastroData.unidade)) {
      setAlert({ type: 'error', message: 'Preencha o bloco e apartamento.' });
      return;
    }

    setSalvandoCadastro(true);
    try {
      // Merge Nome + Sobrenome → campo único "nome" (salva como "proprietario" no backend)
      const nomeCompleto = `${cadastroData.nome.trim()} ${cadastroData.sobrenome.trim()}`.trim();

      const payload: Record<string, unknown> = {
        nome: nomeCompleto,
        cpf: cpfBusca,
        email: cadastroData.email,
        telefone: cleanPhoneNumber(cadastroData.telefone),
        bloco: isSindico ? null : cadastroData.bloco,
        unidade: isSindico ? null : cadastroData.unidade,
        empreendimento: cadastroData.empreendimento,
      };

      // Adicionar FK conforme o tipo
      if (tipoCadastro === 'cliente' && selectedEmpreendimentoId) {
        payload.id_empreendimento = selectedEmpreendimentoId;
      }
      if (tipoCadastro === 'sindico' && selectedSindicoId) {
        payload.idSindico = selectedSindicoId;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/clientes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      // 409 = CPF já existe — usar o cliente existente retornado pelo backend
      if (response.status === 409 && result.code === 'CPF_EXISTS' && result.cliente) {
        console.log('⚠️ CPF já existe, usando cliente existente:', Object.keys(result.cliente), JSON.stringify(result.cliente).substring(0, 500));
        const clienteExistente = extractClienteWithId(result.cliente);
        if (clienteExistente) {
          setCliente(clienteExistente);
          setCurrentStep('solicitacao');
          return;
        }
      }
      if (!response.ok) { setAlert({ type: 'error', message: result.error || 'Erro ao cadastrar cliente.' }); return; }
      console.log('📋 Cliente criado — colunas:', Object.keys(result.cliente || {}), JSON.stringify(result.cliente).substring(0, 500));
      const clienteNormalizado = extractClienteWithId(result.cliente);
      if (!clienteNormalizado) {
        setAlert({ type: 'error', message: 'Erro ao processar dados do cliente criado. Contate o suporte.' });
        return;
      }
      setCliente(clienteNormalizado);
      setCurrentStep('solicitacao');
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      setAlert({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSalvandoCadastro(false);
    }
  };

  // === STEP 2.5: SÍNDICO SELECIONA EMPREENDIMENTO (PATCH) ===
  const handleSindicoSelecionarEmpreendimento = async () => {
    if (!cliente || !sindicoEmpreendimentoSelecionado) return;

    // Se o empreendimento já é o mesmo e não mudou, pular o PATCH e ir direto
    const mesmoEmpreendimento = sindicoEmpreendimentoSelecionado === cliente.empreendimento;
    if (mesmoEmpreendimento) {
      console.log(`🏢 Empreendimento já é o mesmo (${sindicoEmpreendimentoSelecionado}). Pulando PATCH.`);
      setCurrentStep('solicitacao');
      return;
    }

    // Para mudar o empreendimento, precisa do ID do síndico
    if (!sindicoEmpreendimentoIdSelecionado) {
      console.error('❌ sindicoEmpreendimentoIdSelecionado é null. Colunas disponíveis na lista:', sindicosList.length > 0 ? Object.keys(sindicosList[0]) : 'lista vazia');
      setAlert({ type: 'error', message: 'Erro ao identificar o empreendimento. Tente selecionar novamente.' });
      return;
    }

    setAtualizandoEmpreendimento(true);
    setAlert(null);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/clientes/${cliente.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            idSindico: sindicoEmpreendimentoIdSelecionado,
            empreendimento: sindicoEmpreendimentoSelecionado,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        console.error('❌ Erro ao atualizar idSindico/empreendimento do síndico:', result.error);
        setAlert({ type: 'error', message: result.error || 'Erro ao atualizar empreendimento.' });
        return;
      }
      console.log(`✅ Síndico atualizado — idSindico: ${sindicoEmpreendimentoIdSelecionado}, empreendimento: ${sindicoEmpreendimentoSelecionado}`);
      // Atualizar o cliente local
      setCliente({
        ...cliente,
        empreendimento: sindicoEmpreendimentoSelecionado,
        idSindico: sindicoEmpreendimentoIdSelecionado,
      });
      setCurrentStep('solicitacao');
    } catch (error) {
      console.error('❌ Erro de conexão ao atualizar empreendimento:', error);
      setAlert({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setAtualizandoEmpreendimento(false);
    }
  };

  // === STEP 3: ENVIAR SOLICITACAO ===
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAlert({ type: 'error', message: 'Selecione apenas arquivos de imagem.' }); return; }
    if (file.size > 10 * 1024 * 1024) { setAlert({ type: 'error', message: 'A foto é muito grande. Máximo 10MB.' }); return; }
    setFoto(file);
    setFotoError('');
    setAlert(null);
    const reader = new FileReader();
    reader.onloadend = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEnviarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!foto) { setFotoError('A foto do problema é obrigatória.'); return; }
    if (!solicitacaoData.categoria || !solicitacaoData.descricao) { setAlert({ type: 'error', message: 'Preencha a categoria e a descrição.' }); return; }
    if (!cliente) { setAlert({ type: 'error', message: 'Erro interno: cliente não identificado.' }); return; }
    if (!cliente.id && !cliente.cpf) {
      console.error('❌ cliente.id e cliente.cpf ausentes no momento do envio. Estado do cliente:', JSON.stringify(cliente));
      setAlert({ type: 'error', message: 'Erro interno: dados do cliente insuficientes. Volte e tente novamente.' });
      return;
    }
    if (!cliente.id) {
      console.warn('⚠️ cliente.id ausente, mas CPF disponível para fallback. Estado:', JSON.stringify(cliente));
    }

    setEnviando(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(foto);
      const fotoBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/solicitacao-assistencia-v2`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            cliente_id: cliente.id,
            cpf: cliente.cpf || cpfBusca.replace(/\D/g, ''),
            categoria_reparo: solicitacaoData.categoria,
            descricao_cliente: solicitacaoData.descricao,
            url_foto: fotoBase64,
            idempresa: 1,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        if (result.code === 'MISSING_PHOTO' || result.code === 'INVALID_IMAGE_FORMAT') setFotoError(result.error);
        throw new Error(result.error || 'Erro ao enviar solicitação');
      }

      setAlert({ type: 'success', message: 'Solicitação registrada com sucesso!' });
      setSolicitacaoData({ categoria: '', descricao: '' });
      setFoto(null);
      setFotoPreview(null);
    } catch (error) {
      console.error('Erro:', error);
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Erro ao enviar solicitação.' });
    } finally {
      setEnviando(false);
    }
  };

  // === RENDERS ===
  if (mostrarPolitica) return <PoliticaPrivacidade onVoltar={() => setMostrarPolitica(false)} />;
  if (mostrarTermo) return <TermoAssistenciaTecnica onVoltar={() => setMostrarTermo(false)} />;

  // Steps dinâmicos: síndico tem step extra de empreendimento
  const isSindicoFlow = currentStep === 'sindico-empreendimento' || (cliente?.idSindico && currentStep === 'solicitacao');
  const steps = isSindicoFlow
    ? [
        { key: 'cpf', label: 'CPF', icon: Search },
        { key: 'sindico-empreendimento', label: 'Empreend.', icon: Building2 },
        { key: 'solicitacao', label: 'Solicitação', icon: ClipboardList },
      ]
    : [
        { key: 'cpf', label: 'CPF', icon: Search },
        { key: 'cadastro', label: 'Cadastro', icon: UserPlus },
        { key: 'solicitacao', label: 'Solicitação', icon: ClipboardList },
      ];

  const getStepIndex = () => {
    if (currentStep === 'cpf') return 0;
    if (currentStep === 'cadastro') return 1;
    if (currentStep === 'sindico-empreendimento') return 1;
    if (currentStep === 'solicitacao') return 2;
    return -1;
  };

  // Shared card style
  const cardClass = "bg-white rounded-xl border border-border overflow-hidden";
  const cardHeaderClass = "px-5 py-4 border-b border-border";
  const cardBodyClass = "p-5 sm:p-6";
  const inputClass = "h-12 text-[15px] bg-background-secondary border border-input-border rounded-lg focus:border-black focus:ring-1 focus:ring-black/10 transition-colors";
  const btnPrimary = "h-12 bg-black hover:bg-primary-hover text-white rounded-lg font-medium transition-colors disabled:opacity-40";
  const btnOutline = "h-12 px-4 rounded-lg border border-border hover:bg-background-secondary transition-colors";

  return (
    <div className="min-h-screen bg-background-alt py-5 sm:py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-xl border border-border mb-4">
            <img
              src={typeof logoBP === "string" ? logoBP : logoBP.src}
              alt="BP Incorporadora"
              className="h-10 w-auto sm:h-14"
              style={{ imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)' }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight mb-1">
            Assistência Técnica
          </h1>
          <p className="text-sm text-text-tertiary">
            {currentStep === 'termos' && 'Aceite os termos para solicitar seu reparo'}
            {currentStep === 'cpf' && 'Informe seu CPF para identificação'}
            {currentStep === 'cadastro' && 'Complete seu cadastro para continuar'}
            {currentStep === 'sindico-empreendimento' && 'Selecione o empreendimento para esta solicitação'}
            {currentStep === 'solicitacao' && 'Descreva o problema para concluir'}
          </p>
        </div>

        {/* Step Indicator */}
        {currentStep !== 'termos' && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-3">
              {steps.map((step, index) => {
                const stepIndex = getStepIndex();
                const isActive = index === stepIndex;
                const isCompleted = index < stepIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    {index > 0 && (
                      <div className={`h-px w-8 sm:w-12 transition-colors ${isCompleted || isActive ? 'bg-black' : 'bg-border'}`} />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all ${
                        isActive ? 'bg-black text-white' :
                        isCompleted ? 'bg-success text-white' :
                        'bg-background-secondary text-text-muted'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`text-[11px] font-medium ${isActive ? 'text-text-primary' : isCompleted ? 'text-success-dark' : 'text-text-muted'}`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === STEP: TERMOS === */}
        {currentStep === 'termos' && (
          <div className="space-y-4 animate-fade-in">
            {/* Manutencao */}
            {EM_MANUTENCAO && (
              <div className="bg-error-light border border-error rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-error mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-error-dark">Sistema em Manutenção</p>
                    <p className="text-sm text-error-dark/80 mt-0.5">Solicitação indisponível temporariamente.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Politica */}
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Shield className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">Política de Privacidade</h2>
                </div>
              </div>
              <div className={cardBodyClass + " space-y-4"}>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Para prosseguir, precisamos do seu consentimento para coletar e processar seus dados pessoais de acordo com a LGPD.
                </p>
                <label htmlFor="privacidade2" className="flex items-start gap-3 p-4 bg-background-secondary rounded-lg cursor-pointer border border-transparent hover:border-border transition-colors active:scale-[0.99]">
                  <input
                    type="checkbox"
                    id="privacidade2"
                    checked={aceitouPrivacidade}
                    onChange={(e) => setAceitouPrivacidade(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded bg-white border-2 border-gray-300 text-black focus:ring-black/20 cursor-pointer flex-shrink-0 accent-black"
                  />
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Concordo em fornecer meus dados e receber mensagens de acordo com a{' '}
                    <button type="button" onClick={() => setMostrarPolitica(true)} className="text-text-primary underline underline-offset-2 font-medium hover:no-underline">
                      Política de Privacidade
                    </button>{' '}em conformidade com a LGPD.
                  </p>
                </label>
              </div>
            </div>

            {/* Termo */}
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <FileCheck className="h-4 w-4 text-amber-600" />
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">Termo de Assistência</h2>
                </div>
              </div>
              <div className={cardBodyClass + " space-y-4"}>
                <div className="bg-background-secondary rounded-lg p-4 border border-border-subtle">
                  <p className="text-sm text-text-secondary leading-relaxed">
                    <strong className="text-text-primary">Importante:</strong> Leia o{' '}
                    <button type="button" onClick={() => setMostrarTermo(true)} className="text-text-primary underline underline-offset-2 font-medium hover:no-underline">
                      Termo de Assistência Técnica
                    </button>{' '}antes de prosseguir.
                  </p>
                </div>
                <label htmlFor="termo2" className="flex items-start gap-3 p-4 bg-background-secondary rounded-lg cursor-pointer border border-transparent hover:border-border transition-colors active:scale-[0.99]">
                  <input
                    type="checkbox"
                    id="termo2"
                    checked={aceitouTermo}
                    onChange={(e) => setAceitouTermo(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded bg-white border-2 border-gray-300 text-black focus:ring-black/20 cursor-pointer flex-shrink-0 accent-black"
                  />
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Ao marcar essa opção, você concorda com o{' '}
                    <button type="button" onClick={() => setMostrarTermo(true)} className="text-text-primary underline underline-offset-2 font-medium hover:no-underline">
                      Termo de Assistência Técnica
                    </button>.
                  </p>
                </label>
              </div>
            </div>

            {/* Botao Prosseguir */}
            <div className="pt-2 pb-4">
              <Button
                onClick={() => setCurrentStep('cpf')}
                disabled={!aceitouPrivacidade || !aceitouTermo || EM_MANUTENCAO}
                className={`w-full ${btnPrimary}`}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Prosseguir
              </Button>
            </div>
          </div>
        )}

        {/* === STEP: CPF === */}
        {currentStep === 'cpf' && (
          <CpfValidator
            cpfBusca={cpfBusca}
            setCpfBusca={(v) => setCpfBusca(v)}
            cpfError={cpfError}
            setCpfError={(v) => setCpfError(v)}
            buscandoCpf={buscandoCpf}
            onBuscarCPF={handleBuscarCPF}
            onVoltar={() => setCurrentStep('termos')}
          />
        )}

        {/* === STEP: CADASTRO === */}
        {currentStep === 'cadastro' && (
          <div className="animate-fade-in">
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background-secondary rounded-lg">
                    <UserPlus className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Novo Cadastro</h2>
                    <p className="text-xs text-text-muted mt-0.5">CPF {cpfBusca} não encontrado. Preencha seus dados.</p>
                  </div>
                </div>
              </div>
              <div className={cardBodyClass + " space-y-4"}>
                {/* CPF readonly */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">CPF</Label>
                  <Input value={cpfBusca} disabled className="h-12 text-[15px] bg-background-secondary border border-input-border rounded-lg opacity-60" />
                </div>

                {/* Nome + Sobrenome */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">
                    Proprietário/Inquilino <span className="text-error">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="cad-nome"
                      value={cadastroData.nome}
                      onChange={(e) => setCadastroData({ ...cadastroData, nome: e.target.value })}
                      className={inputClass}
                      placeholder="Nome"
                      required
                    />
                    <Input
                      id="cad-sobrenome"
                      value={cadastroData.sobrenome}
                      onChange={(e) => setCadastroData({ ...cadastroData, sobrenome: e.target.value })}
                      className={inputClass}
                      placeholder="Sobrenome"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="cad-email" className="text-sm text-text-secondary">
                    E-mail <span className="text-error">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input
                      id="cad-email"
                      type="email"
                      value={cadastroData.email}
                      onChange={(e) => setCadastroData({ ...cadastroData, email: e.target.value })}
                      className={`pl-10 ${inputClass}`}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Celular */}
                <div className="space-y-1.5">
                  <Label htmlFor="cad-celular" className="text-sm text-text-secondary">
                    Celular <span className="text-error">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium pointer-events-none">+55</span>
                    <Input
                      id="cad-celular"
                      value={cadastroData.telefone}
                      onChange={(e) => setCadastroData({ ...cadastroData, telefone: formatCelular(e.target.value) })}
                      placeholder="61 98656-2744"
                      maxLength={14}
                      inputMode="numeric"
                      className={`pl-[4.5rem] ${inputClass}`}
                      required
                    />
                  </div>
                </div>

                {/* Empreendimento — Tipo de cadastro */}
                <div className="space-y-3">
                  <Label className="text-sm text-text-secondary">
                    Empreendimento <span className="text-error">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleTipoCadastro('cliente')}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all ${
                        tipoCadastro === 'cliente'
                          ? 'border-black bg-black/5'
                          : 'border-border bg-background-secondary hover:border-black/30'
                      }`}
                    >
                      <Building2 className={`h-5 w-5 ${tipoCadastro === 'cliente' ? 'text-black' : 'text-text-muted'}`} />
                      <span className={`text-sm font-medium ${tipoCadastro === 'cliente' ? 'text-text-primary' : 'text-text-secondary'}`}>Sou cliente</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTipoCadastro('sindico')}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 transition-all ${
                        tipoCadastro === 'sindico'
                          ? 'border-black bg-black/5'
                          : 'border-border bg-background-secondary hover:border-black/30'
                      }`}
                    >
                      <User className={`h-5 w-5 ${tipoCadastro === 'sindico' ? 'text-black' : 'text-text-muted'}`} />
                      <span className={`text-sm font-medium ${tipoCadastro === 'sindico' ? 'text-text-primary' : 'text-text-secondary'}`}>Sou síndico</span>
                    </button>
                  </div>

                  {/* Select do empreendimento/síndico */}
                  {tipoCadastro && (
                    <div className="animate-fade-in">
                      {carregandoLista ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Carregando...</span>
                        </div>
                      ) : (
                        <Select
                          value={cadastroData.empreendimento}
                          onValueChange={(v) => {
                            const lista = tipoCadastro === 'cliente' ? empreendimentosList : sindicosList;
                            const item = lista.find(i => getItemNome(i) === v);
                            setCadastroData({ ...cadastroData, empreendimento: v });
                            if (tipoCadastro === 'cliente') {
                              setSelectedEmpreendimentoId(item ? getItemId(item) : null);
                              setSelectedSindicoId(null);
                            } else {
                              setSelectedSindicoId(item ? getItemId(item) : null);
                              setSelectedEmpreendimentoId(null);
                            }
                          }}
                        >
                          <SelectTrigger className="h-12 text-[15px] bg-background-secondary border border-input-border rounded-lg focus:border-black focus:ring-1 focus:ring-black/10">
                            <SelectValue placeholder={tipoCadastro === 'cliente' ? 'Selecione o empreendimento' : 'Selecione o condomínio/síndico'} />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border border-border">
                            {(tipoCadastro === 'cliente' ? empreendimentosList : sindicosList).map((item, idx) => {
                              const nome = getItemNome(item);
                              const itemId = getItemId(item);
                              return (
                                <SelectItem key={itemId ?? idx} value={nome} className="text-sm rounded-md py-2.5">{nome}</SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>

                {/* Bloco e Unidade (oculto para síndico) */}
                {tipoCadastro !== 'sindico' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cad-bloco" className="text-sm text-text-secondary">
                        Bloco <span className="text-error">*</span>
                      </Label>
                      <Input
                        id="cad-bloco"
                        value={cadastroData.bloco}
                        onChange={(e) => setCadastroData({ ...cadastroData, bloco: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                        placeholder="01"
                        maxLength={2}
                        inputMode="numeric"
                        className={`text-center ${inputClass}`}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cad-unidade" className="text-sm text-text-secondary">
                        Apartamento <span className="text-error">*</span>
                      </Label>
                      <Input
                        id="cad-unidade"
                        value={cadastroData.unidade}
                        onChange={(e) => setCadastroData({ ...cadastroData, unidade: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                        placeholder="101"
                        maxLength={3}
                        inputMode="numeric"
                        className={`text-center ${inputClass}`}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-3 pt-1">
                  <Button onClick={() => setCurrentStep('cpf')} variant="outline" className={btnOutline}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleCadastrarCliente}
                    disabled={
                      salvandoCadastro ||
                      !cadastroData.nome ||
                      !cadastroData.sobrenome ||
                      !cadastroData.empreendimento ||
                      !cadastroData.email ||
                      !cadastroData.telefone ||
                      (!tipoCadastro) ||
                      (tipoCadastro === 'cliente' && (!cadastroData.bloco || !cadastroData.unidade))
                    }
                    className={`flex-1 ${btnPrimary}`}
                  >
                    {salvandoCadastro ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                    ) : (
                      <><UserPlus className="h-4 w-4 mr-2" /> Cadastrar e Continuar</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === STEP: SÍNDICO - SELEÇÃO DE EMPREENDIMENTO === */}
        {currentStep === 'sindico-empreendimento' && cliente && (
          <div className="animate-fade-in">
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background-secondary rounded-lg">
                    <Building2 className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Selecionar Empreendimento</h2>
                    <p className="text-xs text-text-muted mt-0.5">Olá, {cliente.proprietario}! Escolha o empreendimento para esta solicitação.</p>
                  </div>
                </div>
              </div>
              <div className={cardBodyClass + " space-y-4"}>
                {/* Info do síndico */}
                <div className="bg-background-secondary rounded-lg p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{cliente.proprietario}</p>
                    <p className="text-xs text-text-muted">Síndico • CPF {cliente.cpf}</p>
                  </div>
                </div>

                {/* Empreendimento atual */}
                {cliente.empreendimento && (
                  <div className="bg-warning-light/50 border border-warning/30 rounded-lg p-3">
                    <p className="text-xs text-warning-dark leading-relaxed">
                      <strong>Último empreendimento registrado:</strong> {cliente.empreendimento}. 
                      Selecione abaixo o empreendimento para <strong>esta</strong> solicitação.
                    </p>
                  </div>
                )}

                {/* Select de empreendimento */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">
                    Condomínio / Empreendimento <span className="text-error">*</span>
                  </Label>
                  {carregandoLista ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Carregando condomínios...</span>
                    </div>
                  ) : (
                    <Select
                      value={sindicoEmpreendimentoSelecionado}
                      onValueChange={(v) => {
                        setSindicoEmpreendimentoSelecionado(v);
                        const item = sindicosList.find(i => getItemNome(i) === v);
                        setSindicoEmpreendimentoIdSelecionado(item ? getItemId(item) : null);
                      }}
                    >
                      <SelectTrigger className="h-12 text-[15px] bg-background-secondary border border-input-border rounded-lg focus:border-black focus:ring-1 focus:ring-black/10">
                        <SelectValue placeholder="Selecione o condomínio" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border">
                        {sindicosList.map((item, idx) => {
                          const nome = getItemNome(item);
                          const itemId = getItemId(item);
                          return (
                            <SelectItem key={itemId ?? idx} value={nome} className="text-sm rounded-md py-2.5">{nome}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={() => { setCliente(null); setChamadosCliente([]); setChamadosAberto(false); setTemPendenciaAssinatura(false); setSindicoEmpreendimentoSelecionado(''); setSindicoEmpreendimentoIdSelecionado(null); setCurrentStep('cpf'); }}
                    variant="outline"
                    className={btnOutline}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleSindicoSelecionarEmpreendimento}
                    disabled={!sindicoEmpreendimentoSelecionado || atualizandoEmpreendimento}
                    className={`flex-1 ${btnPrimary}`}
                  >
                    {atualizandoEmpreendimento ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Atualizando...</>
                    ) : (
                      <><ArrowRight className="h-4 w-4 mr-2" /> Continuar</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === STEP: SOLICITACAO === */}
        {currentStep === 'solicitacao' && cliente && (
          <div className="space-y-4 animate-fade-in">

            {/* Resumo do cliente */}
            <div className={cardClass}>
              <div className={cardHeaderClass}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success-light rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-success-dark" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Cliente Identificado</h2>
                    <p className="text-xs text-text-muted mt-0.5">Dados confirmados com sucesso</p>
                  </div>
                </div>
              </div>
              <div className={cardBodyClass}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background-secondary rounded-lg p-3">
                    <p className="text-[11px] text-text-muted mb-0.5">Proprietário/Inquilino</p>
                    <p className="text-sm font-medium text-text-primary truncate">{cliente.proprietario}</p>
                  </div>
                  <div className="bg-background-secondary rounded-lg p-3">
                    <p className="text-[11px] text-text-muted mb-0.5">CPF</p>
                    <p className="text-sm font-medium text-text-primary">{cliente.cpf}</p>
                  </div>
                  <div className="bg-background-secondary rounded-lg p-3">
                    <p className="text-[11px] text-text-muted mb-0.5">Empreendimento</p>
                    <p className="text-sm font-medium text-text-primary truncate">{cliente.empreendimento}</p>
                  </div>
                  <div className="bg-background-secondary rounded-lg p-3">
                    <p className="text-[11px] text-text-muted mb-0.5">Bloco / Apt</p>
                    <p className="text-sm font-medium text-text-primary">{cliente.bloco} - {cliente.unidade}</p>
                  </div>
                </div>

                {/* OBS */}
                <div className="mt-4 bg-warning-light/50 border border-warning/30 rounded-lg p-3">
                  <p className="text-xs text-warning-dark leading-relaxed">
                    <strong>OBS:</strong> Os dados abaixo serão utilizados para entrar em contato e para a assinatura do termo de vistoria. Verifique se estão corretos e, caso necessário, toque no <Pencil className="inline h-3 w-3 mb-0.5" /> para corrigir.
                  </p>
                </div>

                {/* Email / Telefone editáveis */}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {/* Email */}
                  <div className={`rounded-lg p-2.5 transition-all ${editandoEmail ? 'bg-background-secondary border-2 border-black/20 col-span-2' : 'bg-background-secondary border border-border-subtle'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <Mail className="h-2.5 w-2.5" /> E-mail
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditandoEmail(!editandoEmail)}
                        className={`p-1 rounded transition-all ${
                          editandoEmail ? 'bg-black text-white' : 'bg-white border border-border text-text-muted hover:text-text-primary hover:border-black/30'
                        }`}
                        title={editandoEmail ? 'Concluir edição' : 'Editar e-mail'}
                      >
                        {editandoEmail ? <CheckCircle2 className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                      </button>
                    </div>
                    {editandoEmail ? (
                      <Input
                        type="email"
                        value={cliente.email || ''}
                        onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                        placeholder="seu@email.com"
                        className="h-9 text-sm bg-white border border-input-border focus:border-black focus:ring-1 focus:ring-black/10 rounded-md"
                        ref={emailInputRef}
                      />
                    ) : (
                      <p className="text-[13px] font-medium text-text-primary truncate">
                        {cliente.email || <span className="text-text-muted italic font-normal">Não informado</span>}
                      </p>
                    )}
                  </div>

                  {/* Telefone */}
                  <div className={`rounded-lg p-2.5 transition-all ${editandoTelefone ? 'bg-background-secondary border-2 border-black/20 col-span-2' : 'bg-background-secondary border border-border-subtle'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> Telefone
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditandoTelefone(!editandoTelefone)}
                        className={`p-1 rounded transition-all ${
                          editandoTelefone ? 'bg-black text-white' : 'bg-white border border-border text-text-muted hover:text-text-primary hover:border-black/30'
                        }`}
                        title={editandoTelefone ? 'Concluir edição' : 'Editar telefone'}
                      >
                        {editandoTelefone ? <CheckCircle2 className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                      </button>
                    </div>
                    {editandoTelefone ? (
                      <Input
                        value={(() => {
                          if (!cliente.telefone) return '';
                          const raw = cliente.telefone.replace(/\D/g, '');
                          const digits = raw.startsWith('55') ? raw.slice(2) : raw;
                          return formatCelular(digits);
                        })()}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setCliente({ ...cliente, telefone: raw.length > 0 ? `55${raw}` : '' });
                        }}
                        placeholder="61 98656-2744"
                        inputMode="numeric"
                        maxLength={14}
                        className="h-9 text-sm bg-white border border-input-border focus:border-black focus:ring-1 focus:ring-black/10 rounded-md"
                        ref={telefoneInputRef}
                      />
                    ) : (
                      <p className="text-[13px] font-medium text-text-primary">
                        {cliente.telefone ? (() => {
                          const raw = cliente.telefone.replace(/\D/g, '');
                          const digits = raw.startsWith('55') ? raw.slice(2) : raw;
                          return `+55 ${formatCelular(digits)}`;
                        })() : <span className="text-text-muted italic font-normal">Não informado</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Accordion: Ver chamados */}
                <div className="mt-4 border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center bg-background-secondary">
                    <button
                      type="button"
                      onClick={() => setChamadosAberto(!chamadosAberto)}
                      className="flex-1 flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <ClipboardList className="h-4 w-4 text-text-secondary" />
                        Ver chamados
                        {!carregandoChamados && (
                          <span className="text-xs text-text-muted font-normal">({chamadosCliente.length})</span>
                        )}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-text-muted transition-transform duration-200 ${chamadosAberto ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Botão de atualizar chamados (refresh sem recarregar a página) */}
                    {chamadosAberto && cliente?.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          carregarChamadosCliente(cliente.id);
                        }}
                        disabled={carregandoChamados}
                        className="flex items-center gap-1.5 px-2.5 py-2 mr-1 rounded-md hover:bg-gray-200 transition-colors text-text-muted hover:text-text-primary disabled:opacity-50"
                        title="Atualizar status dos chamados"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 flex-shrink-0 ${carregandoChamados ? 'animate-spin' : ''}`} />
                        <span className="text-[10px] leading-tight max-w-[5rem]">
                          {carregandoChamados ? 'Atualizando...' : 'Espere alguns segundos e atualize'}
                        </span>
                      </button>
                    )}
                  </div>

                  {chamadosAberto && (
                    <div className="border-t border-border">
                      {carregandoChamados ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Carregando chamados...</span>
                        </div>
                      ) : chamadosCliente.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-sm text-text-muted">Nenhum chamado encontrado.</p>
                        </div>
                      ) : (() => {
                        const statusColors: Record<string, string> = {
                          'Abertos': 'bg-blue-50 text-blue-700 border-blue-200',
                          'Em andamento': 'bg-amber-50 text-amber-700 border-amber-200',
                          'Vistoria agendada': 'bg-purple-50 text-purple-700 border-purple-200',
                          'Vistoria': 'bg-purple-50 text-purple-700 border-purple-200',
                          'Reparo agendado': 'bg-orange-50 text-orange-700 border-orange-200',
                          'Reparo': 'bg-orange-50 text-orange-700 border-orange-200',
                          'Finalizados': 'bg-green-50 text-green-700 border-green-200',
                          'Aguardando assinatura': 'bg-rose-50 text-rose-700 border-rose-200',
                        };

                        // Ordenar: "Aguardando assinatura" primeiro, depois por categoria
                        const chamadosOrdenados = [...chamadosCliente].sort((a, b) => {
                          const statusA = a.status_finalizacao || a.status_chamado;
                          const statusB = b.status_finalizacao || b.status_chamado;
                          const isAguardandoA = statusA?.toLowerCase().includes('aguardando') ? 1 : 0;
                          const isAguardandoB = statusB?.toLowerCase().includes('aguardando') ? 1 : 0;
                          if (isAguardandoA !== isAguardandoB) return isAguardandoB - isAguardandoA;
                          // Depois por categoria
                          return (a.categoria_reparo || '').localeCompare(b.categoria_reparo || '');
                        });

                        // Agrupar por categoria
                        const grupos: Record<string, ChamadoResumo[]> = {};
                        for (const ch of chamadosOrdenados) {
                          const cat = ch.categoria_reparo || 'Sem categoria';
                          if (!grupos[cat]) grupos[cat] = [];
                          grupos[cat].push(ch);
                        }

                        // Ordenar categorias: categorias com "Aguardando assinatura" primeiro
                        const categoriasOrdenadas = Object.keys(grupos).sort((a, b) => {
                          const aTemAguardando = grupos[a].some(ch => (ch.status_finalizacao || ch.status_chamado)?.toLowerCase().includes('aguardando'));
                          const bTemAguardando = grupos[b].some(ch => (ch.status_finalizacao || ch.status_chamado)?.toLowerCase().includes('aguardando'));
                          if (aTemAguardando !== bTemAguardando) return aTemAguardando ? -1 : 1;
                          return a.localeCompare(b);
                        });

                        return (
                          <div className="max-h-80 overflow-y-auto">
                            {categoriasOrdenadas.map((categoria) => (
                              <div key={categoria}>
                                {/* Header da categoria */}
                                <div className="px-3 py-1.5 bg-gray-50 border-b border-border sticky top-0 z-[1]">
                                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1.5">
                                    <Tag className="h-3 w-3" />
                                    {categoria}
                                    <span className="text-text-muted font-normal normal-case">({grupos[categoria].length})</span>
                                  </span>
                                </div>
                                {/* Chamados da categoria */}
                                <div className="divide-y divide-border">
                                  {grupos[categoria].map((chamado) => {
                                    const statusExibido = chamado.status_finalizacao || chamado.status_chamado;
                                    const badgeClass = statusColors[statusExibido] || 'bg-gray-50 text-gray-700 border-gray-200';
                                    const dataFormatada = new Date(chamado.created_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit', month: '2-digit', year: 'numeric'
                                    });
                                    const isDesqualificado = chamado.situacao === 'Desqualificado';
                                    const isAguardando = statusExibido?.toLowerCase().includes('aguardando') && !isDesqualificado;

                                    return (
                                      <div key={chamado.id} className={`px-3 py-2.5 ${isDesqualificado ? 'opacity-50' : ''} ${isAguardando ? 'bg-rose-50/30' : ''}`}>
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-mono text-text-muted">#{chamado.id}</span>
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${badgeClass}`}>
                                                {isDesqualificado ? 'Desqualificado' : statusExibido}
                                              </span>
                                            </div>
                                            {chamado.descricao_cliente && (
                                              <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{chamado.descricao_cliente}</p>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-text-muted flex items-center gap-1 flex-shrink-0 mt-0.5">
                                            <Clock className="h-3 w-3" />
                                            {dataFormatada}
                                          </span>
                                        </div>

                                        {/* Botão Assinar Documento — só para chamados "Aguardando assinatura" */}
                                        {isAguardando && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              setReenviandoTermo(chamado.id);
                                              try {
                                                // Buscar signing_url do clicksign_envelopes via id_finalizacao
                                                let idFin = chamado.id_finalizacao;
                                                if (!idFin) {
                                                  // Fallback: buscar id_finalizacao via make-server
                                                  const finResp = await fetch(
                                                    `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/assistencia-finalizada/by-assistencia/${chamado.id}`,
                                                    { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
                                                  );
                                                  if (finResp.ok) {
                                                    const finResult = await finResp.json();
                                                    const fin = Array.isArray(finResult.data) ? finResult.data[0] : finResult.data;
                                                    idFin = fin?.id;
                                                  }
                                                }

                                                if (!idFin) {
                                                  setAlert({ type: 'error', message: 'Dados de finalização não encontrados.' });
                                                  return;
                                                }

                                                // Buscar signing_url via edge function clicksign (usa service_role, sem RLS)
                                                const envResp = await fetch(
                                                  `https://${projectId}.supabase.co/functions/v1/clicksign/signing-url?id_finalizacao=${idFin}`,
                                                  {
                                                    headers: {
                                                      'Authorization': `Bearer ${publicAnonKey}`,
                                                      'apikey': publicAnonKey,
                                                    },
                                                  }
                                                );

                                                if (envResp.ok) {
                                                  const data = await envResp.json();
                                                  if (data.signing_url) {
                                                    window.open(data.signing_url, '_blank');
                                                  } else {
                                                    setAlert({ type: 'error', message: 'Link de assinatura não disponível. Entre em contato com o suporte.' });
                                                  }
                                                } else {
                                                  setAlert({ type: 'error', message: 'Erro ao buscar link de assinatura.' });
                                                }
                                              } catch {
                                                setAlert({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
                                              } finally {
                                                setReenviandoTermo(null);
                                              }
                                            }}
                                            disabled={reenviandoTermo !== null}
                                            className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-3 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {reenviandoTermo === chamado.id ? (
                                              <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Carregando...
                                              </>
                                            ) : (
                                              <>
                                                <FileCheck className="h-3.5 w-3.5" />
                                                Assinar Documento
                                              </>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Formulário de Solicitação (com overlay de bloqueio se há pendência) */}
            <div className="relative">
              {temPendenciaAssinatura && !carregandoChamados && (
                <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                  <div className="bg-white border border-border rounded-xl shadow-sm px-5 py-4 mx-4 text-center max-w-xs">
                    <div className="mx-auto w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center mb-3">
                      <FileCheck className="h-5 w-5 text-rose-500" />
                    </div>
                    <p className="text-sm text-text-primary font-medium leading-relaxed">
                      Existem solicitações de assistência pendentes. Conclua-as para realizar uma nova solicitação.
                    </p>
                    <p className="text-xs text-text-muted mt-2 leading-relaxed">
                      Clique em <strong>"Assinar Documento"</strong> no chamado pendente acima para assinar o termo.
                    </p>
                  </div>
                </div>
              )}
            <div className={`${cardClass} ${temPendenciaAssinatura ? 'opacity-40 grayscale pointer-events-none select-none' : ''}`}>
              <div className={cardHeaderClass}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background-secondary rounded-lg">
                    <Wrench className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Detalhes do Problema</h2>
                    <p className="text-xs text-text-muted mt-0.5">Descreva o problema encontrado</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleEnviarSolicitacao} className={cardBodyClass + " space-y-4"}>
                {/* Categoria */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">
                    Categoria <span className="text-error">*</span>
                  </Label>
                  <Select value={solicitacaoData.categoria} onValueChange={(v) => setSolicitacaoData({ ...solicitacaoData, categoria: v })}>
                    <SelectTrigger className="h-12 text-[15px] bg-background-secondary border border-input-border rounded-lg focus:border-black focus:ring-1 focus:ring-black/10">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border border-border">
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-sm rounded-md py-2.5">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descrição */}
                <div className="space-y-1.5">
                  <Label htmlFor="sol-descricao" className="text-sm text-text-secondary">
                    Descrição <span className="text-error">*</span>
                  </Label>
                  <Textarea
                    id="sol-descricao"
                    value={solicitacaoData.descricao}
                    onChange={(e) => {
                      const textoSemQuebras = e.target.value.replace(/[\r\n]+/g, ' ');
                      setSolicitacaoData({ ...solicitacaoData, descricao: textoSemQuebras.slice(0, 400) });
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    placeholder="Descreva o problema em detalhes..."
                    rows={4}
                    maxLength={400}
                    className="text-[15px] bg-background-secondary border border-input-border focus:border-black focus:ring-1 focus:ring-black/10 rounded-lg resize-none p-3"
                    required
                  />
                  <div className="flex justify-end">
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                      solicitacaoData.descricao.length > 350 ? 'text-warning-dark bg-warning-light' : 'text-text-muted bg-background-secondary'
                    }`}>
                      {solicitacaoData.descricao.length}/400
                    </span>
                  </div>
                </div>

                {/* Upload de Foto */}
                <div className="space-y-2" data-foto-section>
                  <Label className="text-sm text-text-secondary flex items-center gap-1.5">
                    Foto <span className="text-error">*</span>
                  </Label>

                  {fotoError && (
                    <div className="flex items-center gap-2 text-sm bg-error-light border border-error/30 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-error" />
                      <span className="text-error-dark">{fotoError}</span>
                    </div>
                  )}

                  {!fotoPreview ? (
                    <div className="grid grid-cols-2 gap-3">
                      <label htmlFor="foto2-camera" className={`group flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all active:scale-[0.98] ${
                        fotoError ? 'border-error/40 bg-error-light/30' : 'border-border hover:border-black/30 hover:bg-background-secondary'
                      }`}>
                        <input id="foto2-camera" type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                        <div className="p-2.5 bg-black rounded-lg text-white group-hover:scale-105 transition-transform">
                          <Camera className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">Tirar Foto</p>
                          <p className="text-[11px] text-text-muted">Abrir câmera</p>
                        </div>
                      </label>
                      <label htmlFor="foto2-galeria" className={`group flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all active:scale-[0.98] ${
                        fotoError ? 'border-error/40 bg-error-light/30' : 'border-border hover:border-black/30 hover:bg-background-secondary'
                      }`}>
                        <input id="foto2-galeria" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        <div className="p-2.5 bg-background-secondary border border-border rounded-lg text-text-secondary group-hover:scale-105 transition-transform">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">Galeria</p>
                          <p className="text-[11px] text-text-muted">Escolher foto</p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-border bg-background-secondary">
                      <img src={fotoPreview} alt="Preview" className="w-full h-auto max-h-[280px] object-contain" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors duration-200 group">
                        <button
                          type="button"
                          onClick={() => { setFoto(null); setFotoPreview(null); }}
                          className="absolute top-2 right-2 p-2 bg-white rounded-lg text-text-secondary hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <label htmlFor="foto2-change-camera" className="px-3 py-2 bg-black text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-primary-hover">
                            Tirar Nova
                          </label>
                          <input id="foto2-change-camera" type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                          <label htmlFor="foto2-change-galeria" className="px-3 py-2 bg-white text-text-primary rounded-lg text-xs font-medium cursor-pointer hover:bg-background-secondary border border-border">
                            Da Galeria
                          </label>
                          <input id="foto2-change-galeria" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-text-muted flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    Foto obrigatória. Capture uma imagem clara do problema.
                  </p>
                </div>

                {/* Botoes */}
                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={() => {
                      if (cliente?.idSindico) {
                        // Síndico volta para seleção de empreendimento
                        setSindicoEmpreendimentoSelecionado('');
                        setSindicoEmpreendimentoIdSelecionado(null);
                        setCurrentStep('sindico-empreendimento');
                      } else {
                        setCliente(null);
                        setChamadosCliente([]);
                        setChamadosAberto(false);
                        setTemPendenciaAssinatura(false);
                        setCurrentStep('cpf');
                      }
                    }}
                    variant="outline"
                    className={btnOutline}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button type="submit" disabled={enviando} className={`flex-1 ${btnPrimary}`}>
                    {enviando ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                    ) : (
                      <><Wrench className="h-4 w-4 mr-2" /> Enviar Solicitação</>
                    )}
                  </Button>
                </div>
              </form>
            </div>
            </div>

            {/* Botão Voltar (sempre visível, mesmo com bloqueio) */}
            {temPendenciaAssinatura && (
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    if (cliente?.idSindico) {
                      setSindicoEmpreendimentoSelecionado('');
                      setSindicoEmpreendimentoIdSelecionado(null);
                      setCurrentStep('sindico-empreendimento');
                    } else {
                      setCliente(null);
                      setChamadosCliente([]);
                      setChamadosAberto(false);
                      setTemPendenciaAssinatura(false);
                      setCurrentStep('cpf');
                    }
                  }}
                  variant="outline"
                  className={btnOutline}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Alert */}
        {alert && (
          <div ref={alertRef} className="mt-6 animate-fade-in">
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              alert.type === 'success'
                ? 'bg-success-light/50 border-success/30'
                : 'bg-error-light/50 border-error/30'
            }`}>
              <div className={`p-2 rounded-lg ${alert.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                {alert.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </div>
              <p className={`text-sm font-medium ${alert.type === 'success' ? 'text-success-dark' : 'text-error-dark'}`}>
                {alert.message}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pb-4">
          <p className="text-xs text-text-muted">Sua solicitação será processada em até 24 horas úteis</p>
        </div>
      </div>
    </div>
  );
}