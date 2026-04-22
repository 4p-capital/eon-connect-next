"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Upload, User, Mail, CreditCard, Phone, Building2, Home, Wrench, FileText, ImageIcon, X, Shield, FileCheck, ArrowRight } from 'lucide-react';
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";
import { getSupabaseClient } from '@/utils/supabase/client';
import { PoliticaPrivacidade } from '@/components/PoliticaPrivacidade';
import { TermoAssistenciaTecnica } from '@/components/TermoAssistenciaTecnica';
import logoBP from '@/assets/88bb647dfb4b82c653ac9fce1996fdda2b3c8f17.png';

// Usar cliente Supabase singleton
const supabase = getSupabaseClient();

const EMPREENDIMENTOS = [
  'GRAN ROMA',
  'GRAN PARIS',
  'GRAN ACRÓPOLIS 1',
  'GRAN ACRÓPOLIS 2',
  'GRAN ACRÓPOLIS 4',
  'GRAN ACRÓPOLIS 6',
  'GRAN ATLANTIS',
  'GRAN MIRANTE',
  'GRAN MEDITERRÂNEO',
  'Parceiro BP',
];

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

// 🔧 MODO MANUTENÇÃO - Altere para false quando estiver liberado
const EM_MANUTENCAO = true;

export function SolicitacaoAssistencia() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    celular: '',
    bloco: '',
    apartamento: '',
    empreendimento: '',
    categoria: '',
    descricao: '',
  });

  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cpfError, setCpfError] = useState<string>(''); // Estado para erro de CPF em tempo real
  const [fotoError, setFotoError] = useState<string>(''); // Estado para erro de foto em tempo real
  
  // Estados para a etapa inicial
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [aceitouTermo, setAceitouTermo] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarPolitica, setMostrarPolitica] = useState(false);
  const [mostrarTermo, setMostrarTermo] = useState(false);

  const alertRef = useRef<HTMLDivElement>(null);

  // Scroll automático quando o alerta aparecer
  useEffect(() => {
    if (alert && alertRef.current) {
      alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [alert]);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const validarCPF = (cpf: string) => {
    // Remove formatação
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (cpfLimpo.length !== 11) {
      return false;
    }
    
    // Verifica se todos os dígitos são iguais (CPF inválido conhecido)
    if (/^(\d)\1{10}$/.test(cpfLimpo)) {
      return false;
    }
    
    // Validação matemática dos dígitos verificadores
    let soma = 0;
    let resto;
    
    // Valida primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
      soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(9, 10))) {
      return false;
    }
    
    // Valida segundo dígito verificador
    soma = 0;
    for (let i = 1; i <= 10; i++) {
      soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(10, 11))) {
      return false;
    }
    
    return true;
  };

  const formatCelular = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + 9 dígitos do celular)
    const limitedNumbers = numbers.slice(0, 11);
    
    // Aplica a máscara: 61 98656-2744 (sem o +55, que é fixo no campo)
    if (limitedNumbers.length <= 2) {
      // Apenas DDD
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      // DDD + primeiros dígitos (sem hífen ainda)
      return `${limitedNumbers.slice(0, 2)} ${limitedNumbers.slice(2)}`;
    } else {
      // DDD + 5 dígitos + hífen + resto = 61 98656-2744
      return `${limitedNumbers.slice(0, 2)} ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  // Função para limpar telefone antes de salvar (remove espaços e +)
  const cleanPhoneNumber = (value: string) => {
    // Remove tudo que não é número e adiciona o código do país "55" no início
    const onlyNumbers = value.replace(/\D/g, '');
    return `55${onlyNumbers}`;
  };

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;

    if (field === 'cpf') {
      formattedValue = formatCPF(value);
      
      // Validar CPF em tempo real APENAS quando tiver 11 dígitos (14 caracteres com máscara)
      const cpfLimpo = formattedValue.replace(/\D/g, '');
      
      if (cpfLimpo.length === 11) {
        // CPF completo - fazer validação
        if (!validarCPF(formattedValue)) {
          setCpfError('❌ CPF inválido. Por favor, verifique os dígitos.');
        } else {
          setCpfError(''); // CPF válido - limpar erro
        }
      } else {
        // CPF incompleto - não mostrar erro ainda
        setCpfError('');
      }
    } else if (field === 'celular') {
      formattedValue = formatCelular(value);
    } else if (field === 'bloco') {
      formattedValue = value.replace(/\D/g, '').slice(0, 2);
    } else if (field === 'apartamento') {
      formattedValue = value.replace(/\D/g, '').slice(0, 3);
    } else if (field === 'descricao') {
      formattedValue = value.slice(0, 400);
    }

    setFormData({ ...formData, [field]: formattedValue });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📷 handleFileChange disparado!');
    
    const file = e.target.files?.[0];
    
    if (!file) {
      console.log('⚠️ Nenhum arquivo selecionado');
      return;
    }

    // Validar se é uma imagem
    if (!file.type.startsWith('image/')) {
      setAlert({
        type: 'error',
        message: '❌ Por favor, selecione apenas arquivos de imagem (JPG, PNG, etc.)',
      });
      console.error('❌ Arquivo inválido:', file.type);
      return;
    }

    // Validar tamanho máximo (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB em bytes
    if (file.size > maxSize) {
      setAlert({
        type: 'error',
        message: '❌ A foto é muito grande. Por favor, selecione uma imagem menor que 10MB.',
      });
      console.error('❌ Arquivo muito grande:', file.size, 'bytes');
      return;
    }

    console.log('✅ Foto selecionada:', file.name, 'Tamanho:', (file.size / 1024).toFixed(2), 'KB');
    
    setFoto(file);
    setFotoError(''); // Limpar erro de foto ao selecionar
    setAlert(null); // Limpar alerta geral
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setFotoPreview(reader.result as string);
      console.log('✅ Preview da foto gerado com sucesso');
    };
    reader.onerror = () => {
      console.error('❌ Erro ao ler o arquivo');
      setAlert({
        type: 'error',
        message: '❌ Erro ao processar a imagem. Tente novamente.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFoto = () => {
    setFoto(null);
    setFotoPreview(null);
  };

  const handleProsseguir = () => {
    if (aceitouPrivacidade && aceitouTermo) {
      setMostrarFormulario(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 Iniciando envio de solicitação...');
    console.log('📸 Estado da foto:', foto);
    console.log('📸 Foto existe?', !!foto);
    console.log('📸 Preview existe?', !!fotoPreview);
    if (foto) {
      console.log('✅ Arquivo:', foto.name, 'Tamanho:', (foto.size / 1024).toFixed(2), 'KB', 'Tipo:', foto.type);
    } else {
      console.error('❌ SEM FOTO');
    }
    
    setLoading(true);
    setAlert(null);

    try {
      // 📸 Validar foto obrigatória (verificando o estado, não o input)
      if (!foto) {
        console.error('❌ VALIDAÇÃO FALHOU: Nenhuma foto foi selecionada!');
        console.error('❌ Estado foto:', foto);
        console.error('❌ Estado fotoPreview:', fotoPreview);
        setFotoError('É obrigatório enviar uma foto do problema');
        setAlert({
          type: 'error',
          message: '📸 É obrigatório enviar uma foto do problema! Use a câmera ou escolha da galeria.',
        });
        setLoading(false);
        // Scroll para o campo de foto
        setTimeout(() => {
          const fotoSection = document.querySelector('[data-foto-section]');
          if (fotoSection) {
            fotoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
      
      console.log('✅ Validação de foto passou! Foto existe:', !!foto);
      
      // Limpar erro de foto se passou na validação
      setFotoError('');

      // Validar campos obrigatórios
      if (
        !formData.nome ||
        !formData.email ||
        !formData.cpf ||
        !formData.celular ||
        !formData.bloco ||
        !formData.apartamento ||
        !formData.empreendimento ||
        !formData.categoria ||
        !formData.descricao
      ) {
        setAlert({
          type: 'error',
          message: 'Opss! Algo deu errado. Verifique se todos os campos obrigatórios estão preenchidos!',
        });
        setLoading(false);
        return;
      }

      // Validar CPF
      if (!validarCPF(formData.cpf)) {
        setAlert({
          type: 'error',
          message: 'CPF inválido. Por favor, verifique e tente novamente.',
        });
        setLoading(false);
        return;
      }

      // Converter foto para base64 (já validamos que existe)
      console.log('📸 Convertendo foto para base64...');
      const reader = new FileReader();
      reader.readAsDataURL(foto);
      
      const fotoBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
      });
      
      console.log('✅ Foto convertida para base64 com sucesso');

      // Limpar o telefone antes de enviar (remover espaços, + e manter apenas números)
      const celularLimpo = cleanPhoneNumber(formData.celular);
      
      console.log('📱 Telefone formatado:', formData.celular, '→', celularLimpo);

      // Enviar dados e foto para o servidor
      console.log('🚀 Enviando solicitação para o servidor...');
      const response = await fetch(
        `${apiBaseUrl}/solicitacao-assistencia`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            proprietario: formData.nome,
            email: formData.email,
            cpf: formData.cpf,
            telefone: celularLimpo,
            bloco: formData.bloco,
            unidade: formData.apartamento,
            empreendimento: formData.empreendimento,
            categoria_reparo: formData.categoria,
            descricao_cliente: formData.descricao,
            url_foto: fotoBase64,
            idempresa: 1, // 🏢 Valor fixo para BP Incorporadora
          }),
        }
      );

      console.log('📊 Status da resposta:', response.status);
      console.log('📊 Response OK?', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro ao salvar solicitação:', errorData);
        console.error('❌ Detalhes completos:', JSON.stringify(errorData, null, 2));
        
        // Tratamento específico para erro de foto
        if (errorData.code === 'MISSING_PHOTO' || errorData.code === 'INVALID_IMAGE_FORMAT') {
          setFotoError(errorData.error);
          throw new Error('📸 ' + errorData.error);
        }
        
        throw new Error(errorData.error || errorData.details || 'Erro ao salvar solicitação');
      }

      const resultado = await response.json();
      console.log('✅ Resposta do servidor:', resultado);
      console.log('✅ Solicitação criada com ID:', resultado.id);

      setAlert({
        type: 'success',
        message: 'Solicitação registrada com sucesso',
      });

      // Limpar formulário
      setFormData({
        nome: '',
        email: '',
        cpf: '',
        celular: '',
        bloco: '',
        apartamento: '',
        empreendimento: '',
        categoria: '',
        descricao: '',
      });
      setFoto(null);
      setFotoPreview(null);
      setFotoError(''); // Limpar erro de foto
      setCpfError(''); // Limpar erro de CPF
    } catch (error) {
      console.error('Erro:', error);
      
      // Exibir mensagem de erro específica ou genérica
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Opss! Algo deu errado. Verifique seus dados!';
      
      setAlert({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Se estiver mostrando a política de privacidade
  if (mostrarPolitica) {
    return <PoliticaPrivacidade onVoltar={() => setMostrarPolitica(false)} />;
  }

  // Se estiver mostrando o termo de assistência técnica
  if (mostrarTermo) {
    return <TermoAssistenciaTecnica onVoltar={() => setMostrarTermo(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-10 animate-slide-up">
          <div className="inline-flex items-center justify-center p-4 sm:p-5 bg-white rounded-2xl sm:rounded-3xl shadow-xl mb-3 sm:mb-5 transform hover:scale-105 transition-transform duration-300">
            <img 
              src={typeof logoBP === "string" ? logoBP : logoBP.src} 
              alt="BP Incorporadora" 
              className="h-12 w-auto sm:h-16 md:h-20"
              style={{
                imageRendering: '-webkit-optimize-contrast',
                WebkitFontSmoothing: 'antialiased',
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl text-gray-900 mb-2 sm:mb-3">
            Assistência Técnica
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-lg mx-auto px-3">
            {!mostrarFormulario 
              ? 'Aceite os termos para solicitar seu reparo'
              : 'Preencha seus dados para concluir a solicitação'}
          </p>
        </div>

        {/* Etapa Inicial - Aceite de Termos */}
        {!mostrarFormulario ? (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-500">
            
            {/* 🔧 Mensagem de Manutenção - INÍCIO DA PÁGINA */}
            {EM_MANUTENCAO && (
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 bg-red-600 p-2 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base sm:text-lg font-semibold text-red-900 mb-1">
                      🔧 Sistema em Manutenção
                    </p>
                    <p className="text-sm sm:text-base text-red-800 leading-relaxed">
                      Solicitação indisponível temporariamente, sistema em manutenção.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Card 1 - Política de Privacidade */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border-2 border-blue-100 overflow-hidden transform transition-all duration-300 hover:shadow-xl">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h2 className="text-lg sm:text-xl text-white">Política de Privacidade</h2>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                  Para prosseguir, precisamos do seu consentimento para coletar e processar seus dados pessoais de acordo com a LGPD.
                </p>

                <label 
                  htmlFor="privacidade"
                  className="flex items-start gap-4 p-4 sm:p-5 bg-blue-50 rounded-xl sm:rounded-2xl border-2 border-blue-200 cursor-pointer transition-all duration-200 hover:bg-blue-100 hover:border-blue-300 active:scale-[0.98]"
                >
                  <input
                    type="checkbox"
                    id="privacidade"
                    checked={aceitouPrivacidade}
                    onChange={(e) => setAceitouPrivacidade(e.target.checked)}
                    className="mt-0.5 h-6 w-6 sm:h-7 sm:w-7 text-blue-600 rounded-lg focus:ring-3 focus:ring-blue-500 cursor-pointer flex-shrink-0 transition-transform duration-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                      Concordo em fornecer meus dados e receber mensagens de acordo com a{' '}
                      <button
                        type="button"
                        onClick={() => setMostrarPolitica(true)}
                        className="text-blue-600 hover:text-blue-800 underline font-semibold inline-flex items-center gap-1"
                      >
                        Política de Privacidade
                      </button>
                      {' '}em conformidade com a LGPD.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Card 2 - Termo de Assistência */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border-2 border-gray-200 overflow-hidden transform transition-all duration-300 hover:shadow-xl">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                    <FileCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h2 className="text-lg sm:text-xl text-white">Termo de Assistência</h2>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-gray-200">
                  <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                    <strong className="text-gray-900">Importante:</strong> Leia o{' '}
                    <button
                      type="button"
                      onClick={() => setMostrarTermo(true)}
                      className="text-gray-900 hover:text-black underline font-semibold inline-flex items-center gap-1"
                    >
                      Termo de Assistência Técnica
                    </button>
                    {' '}antes de prosseguir com sua solicitação.
                  </p>
                </div>

                <label
                  htmlFor="termo"
                  className="flex items-start gap-4 p-4 sm:p-5 bg-gray-50 rounded-xl sm:rounded-2xl border-2 border-gray-200 cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:border-gray-300 active:scale-[0.98]"
                >
                  <input
                    type="checkbox"
                    id="termo"
                    checked={aceitouTermo}
                    onChange={(e) => setAceitouTermo(e.target.checked)}
                    className="mt-0.5 h-6 w-6 sm:h-7 sm:w-7 text-black rounded-lg focus:ring-3 focus:ring-gray-400 cursor-pointer flex-shrink-0 transition-transform duration-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                      Ao marcar essa opção, você concorda com o{' '}
                      <button
                        type="button"
                        onClick={() => setMostrarTermo(true)}
                        className="text-gray-900 hover:text-black underline font-semibold inline-flex items-center gap-1"
                      >
                        Termo de Assistência Técnica
                      </button>
                      .
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Botão Prosseguir */}
            <div className="pt-2 sm:pt-4 pb-4">
              <Button
                onClick={handleProsseguir}
                disabled={!aceitouPrivacidade || !aceitouTermo || EM_MANUTENCAO}
                className="w-full h-14 sm:h-16 text-base sm:text-lg bg-black hover:bg-gray-800 text-white rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="font-semibold flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Prosseguir
                </span>
              </Button>
            </div>
          </div>
        ) : (
          /* Formulário Principal */
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border-2 border-gray-100 animate-in fade-in duration-500">
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-7">
              
              {/* Section: Dados Pessoais */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b-2 border-blue-500">
                  <div className="bg-blue-100 p-2.5 rounded-xl">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl text-gray-900">Dados pessoais</h2>
                </div>

                {/* Nome */}
                <div className="space-y-2.5">
                  <Label htmlFor="nome" className="text-sm sm:text-base text-gray-700">
                    Nome completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    className="h-13 sm:h-14 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl transition-all duration-200 hover:border-gray-300"
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-sm sm:text-base text-gray-700">
                    E-mail <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 bg-blue-50 p-2 rounded-lg">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-14 h-13 sm:h-14 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl transition-all duration-200 hover:border-gray-300"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                {/* CPF */}
                <div className="space-y-2.5">
                  <Label htmlFor="cpf" className="text-sm sm:text-base text-gray-700">
                    CPF <span className="text-red-500">*</span>
                  </Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 bg-blue-50 p-2 rounded-lg">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                      </div>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        inputMode="numeric"
                        className={`pl-14 h-13 sm:h-14 text-base border-2 transition-all duration-200 rounded-xl ${
                          cpfError 
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200' 
                            : formData.cpf.replace(/\D/g, '').length === 11
                              ? 'border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                              : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-gray-300'
                        }`}
                        required
                      />
                    </div>
                    {cpfError && (
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
                        <p className="text-xs sm:text-sm text-red-600">{cpfError}</p>
                      </div>
                    )}
                    {!cpfError && formData.cpf.replace(/\D/g, '').length === 11 && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                        <p className="text-xs sm:text-sm text-green-600">✓ CPF válido</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Celular */}
                <div className="space-y-2.5">
                  <Label htmlFor="celular" className="text-sm sm:text-base text-gray-700">
                    Celular <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 bg-blue-50 p-2 rounded-lg z-10">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="absolute left-[3.5rem] top-1/2 -translate-y-1/2 text-base text-gray-700 font-medium pointer-events-none z-10">
                      +55
                    </span>
                    <Input
                      id="celular"
                      value={formData.celular}
                      onChange={(e) => handleInputChange('celular', e.target.value)}
                      placeholder="61 98656-2744"
                      maxLength={14}
                      inputMode="numeric"
                      className="pl-[5.75rem] h-13 sm:h-14 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl transition-all duration-200 hover:border-gray-300"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section: Localização */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b-2 border-black">
                  <div className="bg-gray-100 p-2.5 rounded-xl">
                    <Building2 className="h-5 w-5 text-black" />
                  </div>
                  <h2 className="text-lg sm:text-xl text-gray-900">Localização</h2>
                </div>

                {/* Empreendimento */}
                <div className="space-y-2.5">
                  <Label htmlFor="empreendimento" className="text-sm sm:text-base text-gray-700">
                    Empreendimento <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.empreendimento}
                    onValueChange={(value) => handleInputChange('empreendimento', value)}
                    required
                  >
                    <SelectTrigger className="h-13 sm:h-14 text-base border-2 border-gray-200 focus:border-black focus:ring-2 focus:ring-gray-300 rounded-xl transition-all duration-200 hover:border-gray-300">
                      <SelectValue placeholder="Selecione o empreendimento" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      {EMPREENDIMENTOS.map((emp) => (
                        <SelectItem key={emp} value={emp} className="text-base rounded-lg py-3">
                          {emp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bloco e Apartamento */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2.5">
                    <Label htmlFor="bloco" className="text-sm sm:text-base text-gray-700">
                      Bloco <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 bg-gray-100 p-2 rounded-lg">
                        <Home className="h-4 w-4 text-black" />
                      </div>
                      <Input
                        id="bloco"
                        value={formData.bloco}
                        onChange={(e) => handleInputChange('bloco', e.target.value)}
                        placeholder="01"
                        maxLength={2}
                        inputMode="numeric"
                        className="pl-14 h-13 sm:h-14 text-base border-2 border-gray-200 focus:border-black focus:ring-2 focus:ring-gray-300 rounded-xl transition-all duration-200 hover:border-gray-300"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="apartamento" className="text-sm sm:text-base text-gray-700">
                      Apartamento <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="apartamento"
                      value={formData.apartamento}
                      onChange={(e) => handleInputChange('apartamento', e.target.value)}
                      placeholder="101"
                      maxLength={3}
                      inputMode="numeric"
                      className="h-13 sm:h-14 text-base text-center border-2 border-gray-200 focus:border-black focus:ring-2 focus:ring-gray-300 rounded-xl transition-all duration-200 hover:border-gray-300"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section: Detalhes do Problema */}
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-500">
                  <div className="bg-orange-100 p-2.5 rounded-xl">
                    <Wrench className="h-5 w-5 text-orange-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl text-gray-900">Detalhes do problema</h2>
                </div>

                {/* Categoria */}
                <div className="space-y-2.5">
                  <Label htmlFor="categoria" className="text-sm sm:text-base text-gray-700">
                    Categoria <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => handleInputChange('categoria', value)}
                    required
                  >
                    <SelectTrigger className="h-13 sm:h-14 text-base border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl transition-all duration-200 hover:border-gray-300">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-base rounded-lg py-3">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descrição */}
                <div className="space-y-2.5">
                  <Label htmlFor="descricao" className="text-sm sm:text-base text-gray-700">
                    Descrição <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => {
                      // Remove quebras de linha e substitui por espaço
                      const textoSemQuebras = e.target.value.replace(/[\r\n]+/g, ' ');
                      handleInputChange('descricao', textoSemQuebras);
                    }}
                    onKeyDown={(e) => {
                      // Previne Enter/quebra de linha
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Descreva o problema em detalhes..."
                    rows={5}
                    maxLength={400}
                    className="text-base border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl resize-none transition-all duration-200 hover:border-gray-300 p-4"
                    required
                  />
                  <div className="flex justify-end">
                    <span className={`text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full ${formData.descricao.length > 350 ? 'text-orange-700 bg-orange-100' : 'text-gray-600 bg-gray-100'}`}>
                      {formData.descricao.length}/400
                    </span>
                  </div>
                </div>

                {/* Upload de Foto */}
                <div className="space-y-2.5" data-foto-section>
                  <Label className="text-sm sm:text-base text-gray-700 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-orange-600" />
                    Foto <span className="text-red-500">*</span>
                  </Label>
                  
                  {fotoError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 animate-in fade-in duration-300">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{fotoError}</span>
                    </div>
                  )}
                  
                  {!fotoPreview ? (
                    <div className="space-y-3">
                      {/* Botão Tirar Foto */}
                      <label
                        htmlFor="foto-camera"
                        className={`group relative flex items-center justify-center gap-3 border-3 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center transition-all duration-300 cursor-pointer active:scale-[0.99] ${
                          fotoError 
                            ? 'border-red-400 bg-red-50/50 hover:border-red-500 hover:bg-red-50' 
                            : 'border-orange-300 bg-orange-50/30 hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-yellow-50'
                        }`}
                      >
                        <input
                          id="foto-camera"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          onClick={(e) => e.stopPropagation()}
                          className="hidden"
                        />
                        <div className="inline-flex p-3 sm:p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                          <ImageIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-base sm:text-lg text-gray-900 mb-0.5">
                            📸 Tirar Foto
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Abrir câmera agora
                          </p>
                        </div>
                      </label>

                      {/* Botão Escolher da Galeria */}
                      <label
                        htmlFor="foto-galeria"
                        className={`group relative flex items-center justify-center gap-3 border-3 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center transition-all duration-300 cursor-pointer active:scale-[0.99] ${
                          fotoError 
                            ? 'border-red-400 bg-red-50/50 hover:border-red-500 hover:bg-red-50' 
                            : 'border-gray-300 bg-gray-50/50 hover:border-orange-400 hover:bg-gradient-to-br hover:from-orange-50 hover:to-yellow-50'
                        }`}
                      >
                        <input
                          id="foto-galeria"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          onClick={(e) => e.stopPropagation()}
                          className="hidden"
                        />
                        <div className="inline-flex p-3 sm:p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                          <Upload className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-base sm:text-lg text-gray-900 mb-0.5">
                            🖼️ Escolher da Galeria
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Selecionar foto existente
                          </p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-50">
                      <img
                        src={fotoPreview}
                        alt="Preview"
                        className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <button
                          type="button"
                          onClick={handleRemoveFoto}
                          className="absolute top-3 right-3 p-2.5 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-lg"
                        >
                          <X className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                          <label
                            htmlFor="foto-camera-change"
                            className="px-4 py-2.5 bg-orange-600 text-white rounded-full text-sm font-medium hover:bg-orange-700 transition-colors cursor-pointer shadow-lg"
                          >
                            📸 Tirar Nova
                          </label>
                          <input
                            id="foto-camera-change"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            onClick={(e) => e.stopPropagation()}
                            className="hidden"
                          />
                          <label
                            htmlFor="foto-galeria-change"
                            className="px-4 py-2.5 bg-white rounded-full text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer shadow-lg"
                          >
                            🖼️ Da Galeria
                          </label>
                          <input
                            id="foto-galeria-change"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            onClick={(e) => e.stopPropagation()}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Texto de ajuda */}
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 flex items-start gap-2">
                    <span className="text-orange-600 flex-shrink-0">ℹ️</span>
                    <span>A foto é obrigatória para registro da solicitação. Você pode tirar uma foto agora ou escolher uma da galeria. Certifique-se de capturar uma imagem clara do problema.</span>
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 sm:pt-6">
                <Button
                  type="submit"
                  className="w-full h-14 sm:h-16 text-base sm:text-lg bg-black hover:bg-gray-800 text-white rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || EM_MANUTENCAO}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="font-semibold">Enviando...</span>
                    </div>
                  ) : (
                    <span className="font-semibold flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Enviar Solicitação
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Alert - Posicionado no final */}
        {alert && (
          <div ref={alertRef} className="mt-8 sm:mt-10 animate-slide-up">
            <Alert
              className={`border-3 ${
                alert.type === 'success'
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 text-green-900'
                  : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-400 text-red-900'
              } shadow-2xl rounded-3xl w-full p-5`}
            >
              <div className="flex items-center gap-4 w-full">
                <div className={`p-3 rounded-2xl ${
                  alert.type === 'success'
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}>
                  {alert.type === 'success' ? (
                    <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 text-white" />
                  ) : (
                    <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 text-white" />
                  )}
                </div>
                <AlertDescription className={`text-base sm:text-lg font-semibold break-normal whitespace-normal ${
                  alert.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {alert.message}
                </AlertDescription>
              </div>
            </Alert>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Sua solicitação será processada em até 24 horas úteis</p>
        </div>
      </div>
    </div>
  );
}