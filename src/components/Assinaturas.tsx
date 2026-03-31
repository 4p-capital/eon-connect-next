"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import svgPaths from '@/imports/svg-ezkb9f8m6g';
import imgImage4PCapital from "@/assets/762948d1ce2cdfc2042f67d9544049d4668b8f4b.png";
import { toast } from 'sonner';
import { ChevronDown, Copy, Check, Plus, Loader2, X } from 'lucide-react';
import { getSupabaseClient } from '@/utils/supabase/client';

// Tipo para empresa vinda do banco
interface EmpresaDB {
  id: number;
  nome_empresa: string;
  site_empresa: string;
  logo_empresa: string;
  instagram_empresa: string;
  facebook_empresa: string;
  cor_primaria: string;
  cor_secundaria: string;
  icone_telefone: string;
  icone_email: string;
  icone_globe: string;
  icone_facebook: string;
  icone_instagram: string;
  created_at?: string;
}

interface EmpresaOption {
  value: string;
  label: string;
  site: string;
  logo: string;
  instagram: string;
  facebook: string;
  corPrimaria: string;
  corSecundaria: string;
  iconeTelefone: string;
  iconeEmail: string;
  iconeGlobe: string;
  iconeFacebook: string;
  iconeInstagram: string;
  id?: number;
}

export function Assinaturas() {
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaOption | null>(null);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const signatureRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estado para criação de nova empresa
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmpresaNome, setNewEmpresaNome] = useState('');
  const [newEmpresaSite, setNewEmpresaSite] = useState('');
  const [creatingEmpresa, setCreatingEmpresa] = useState(false);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setShowCreateForm(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar empresas do Supabase
  const fetchEmpresas = useCallback(async () => {
    try {
      setLoadingEmpresas(true);
      const supabase = getSupabaseClient();
      
      console.log('🔍 Buscando empresas da tabela empresas_assinatura...');
      
      const { data, error, status, statusText } = await (supabase
        .from('empresas_assinatura') as any)
        .select('*')
        .order('nome_empresa', { ascending: true });

      console.log('📊 Resposta Supabase:', { status, statusText, dataLength: data?.length, error, data });

      if (error) {
        console.error('❌ Erro ao buscar empresas:', error);
        toast.error(`Erro ao carregar empresas: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ Tabela empresas_assinatura vazia ou sem permissão (RLS). Data:', data);
        setEmpresas([]);
        return;
      }

      console.log('✅ Colunas encontradas:', Object.keys(data[0]));

      const mapped: EmpresaOption[] = (data || []).map((emp: any) => ({
        value: String(emp.id),
        label: emp.nome_empresa ?? '',
        site: emp.site_empresa ?? '',
        logo: emp.logo_empresa || '',
        instagram: emp.instagram_empresa || '',
        facebook: emp.facebook_empresa || '',
        corPrimaria: emp.cor_primaria || '#1098f7',
        corSecundaria: emp.cor_secundaria || '#035fa0',
        iconeTelefone: emp.icone_telefone || 'https://cdn-icons-png.flaticon.com/16/724/724664.png',
        iconeEmail: emp.icone_email || 'https://cdn-icons-png.flaticon.com/16/732/732200.png',
        iconeGlobe: emp.icone_globe || 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png',
        iconeFacebook: emp.icone_facebook || 'https://cdn-icons-png.flaticon.com/16/733/733547.png',
        iconeInstagram: emp.icone_instagram || 'https://cdn-icons-png.flaticon.com/16/2111/2111463.png',
        id: emp.id,
      })).sort((a: EmpresaOption, b: EmpresaOption) => a.label.localeCompare(b.label));

      setEmpresas(mapped);
      if (mapped.length > 0 && !empresa) {
        setEmpresa(mapped[0]);
      }
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // Criar nova empresa
  const handleCreateEmpresa = async () => {
    if (!newEmpresaNome.trim()) {
      toast.error('Informe o nome da empresa');
      return;
    }
    if (!newEmpresaSite.trim()) {
      toast.error('Informe o site da empresa');
      return;
    }

    try {
      setCreatingEmpresa(true);
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase
        .from('empresas_assinatura') as any)
        .insert({ nome_empresa: newEmpresaNome.trim(), site_empresa: newEmpresaSite.trim() })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar empresa:', error);
        toast.error(`Erro ao criar empresa: ${error.message}`);
        return;
      }

      const newEmp: EmpresaOption = {
        value: String(data.id),
        label: data.nome_empresa,
        site: data.site_empresa || '',
        logo: data.logo_empresa || '',
        instagram: data.instagram_empresa || '',
        facebook: data.facebook_empresa || '',
        corPrimaria: data.cor_primaria || '#1098f7',
        corSecundaria: data.cor_secundaria || '#035fa0',
        iconeTelefone: data.icone_telefone || 'https://cdn-icons-png.flaticon.com/16/724/724664.png',
        iconeEmail: data.icone_email || 'https://cdn-icons-png.flaticon.com/16/732/732200.png',
        iconeGlobe: data.icone_globe || 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png',
        iconeFacebook: data.icone_facebook || 'https://cdn-icons-png.flaticon.com/16/733/733547.png',
        iconeInstagram: data.icone_instagram || 'https://cdn-icons-png.flaticon.com/16/2111/2111463.png',
        id: data.id,
      };

      setEmpresas(prev => [...prev, newEmp].sort((a, b) => a.label.localeCompare(b.label)));
      setEmpresa(newEmp);
      setNewEmpresaNome('');
      setNewEmpresaSite('');
      setShowCreateForm(false);
      setDropdownOpen(false);
      toast.success(`Empresa "${data.nome_empresa}" criada com sucesso!`);
    } catch (err) {
      console.error('Erro ao criar empresa:', err);
      toast.error('Erro inesperado ao criar empresa');
    } finally {
      setCreatingEmpresa(false);
    }
  };

  // Formatar celular
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCelular(formatPhone(e.target.value));
  };

  // Copiar assinatura como HTML
  const handleCopy = useCallback(async () => {
    if (!signatureRef.current) return;

    try {
      const displayName = nome || 'Seu nome';
      const displayCargo = cargo || 'Seu cargo';
      const displayEmail = email || 'seu email';
      const displayPhone = celular || 'seu celular';
      const displaySite = empresa?.site || '';
      const displayLogo = empresa?.logo || imgImage4PCapital;
      const corPrimaria = empresa?.corPrimaria || '#1098f7';
      const corSecundaria = empresa?.corSecundaria || '#035fa0';
      const instagramUrl = empresa?.instagram || '';
      const facebookUrl = empresa?.facebook || '';

      // Icon URLs (CDN-hosted for email compatibility)
      const phoneIcon = empresa?.iconeTelefone || 'https://cdn-icons-png.flaticon.com/16/724/724664.png';
      const emailIcon = empresa?.iconeEmail || 'https://cdn-icons-png.flaticon.com/16/732/732200.png';
      const globeIcon = empresa?.iconeGlobe || 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png';
      const facebookIcon = empresa?.iconeFacebook || 'https://cdn-icons-png.flaticon.com/16/733/733547.png';
      const instagramIcon = empresa?.iconeInstagram || 'https://cdn-icons-png.flaticon.com/16/2111/2111463.png';

      // Build social icons HTML
      let socialHTML = '';
      if (facebookUrl) {
        socialHTML += `<a href="${facebookUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-right:6px;"><img src="${facebookIcon}" alt="Facebook" width="26" height="26" style="display:block;width:26px;height:26px;object-fit:contain;" /></a>`;
      }
      if (instagramUrl) {
        socialHTML += `<a href="${instagramUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-right:6px;"><img src="${instagramIcon}" alt="Instagram" width="24" height="24" style="display:block;width:24px;height:24px;object-fit:contain;" /></a>`;
      }

      const signatureHTML = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;">
  <tr><td style="padding-bottom:4px;font-size:14px;color:#999;">--</td></tr>
  <tr><td style="padding-bottom:2px;font-size:14px;color:#333;">Atenciosamente,</td></tr>
  <tr><td style="padding-top:10px;padding-bottom:2px;font-size:15px;font-weight:bold;color:#222;">${displayName}</td></tr>
  <tr><td style="padding-bottom:10px;font-size:13px;color:#1B1B1B;border-bottom:2px solid ${corPrimaria};display:inline-block;">${displayCargo}</td></tr>
  <tr><td style="padding-top:10px;">
    <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;">
      <tr>
        <td style="padding-bottom:4px;vertical-align:middle;padding-right:6px;width:30px;"><img src="${phoneIcon}" alt="Tel" width="24" height="24" style="display:block;width:24px;height:24px;object-fit:contain;" /></td>
        <td style="padding-bottom:4px;color:#1B1B1B;">${displayPhone}</td>
      </tr>
      <tr>
        <td style="padding-bottom:4px;vertical-align:middle;padding-right:6px;width:30px;"><img src="${emailIcon}" alt="Email" width="24" height="24" style="display:block;width:24px;height:24px;object-fit:contain;" /></td>
        <td style="padding-bottom:4px;color:#1B1B1B;">${displayEmail}</td>
      </tr>
      <tr>
        <td style="padding-bottom:4px;vertical-align:middle;padding-right:6px;width:30px;"><img src="${globeIcon}" alt="Site" width="24" height="24" style="display:block;width:24px;height:24px;object-fit:contain;" /></td>
        <td style="padding-bottom:4px;color:#1B1B1B;">${displaySite}</td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding-top:8px;padding-bottom:8px;">
    <img src="${displayLogo}" alt="${empresa?.label || 'Logo'}" style="${
      empresa?.label === 'Ecosys AUTO' || empresa?.label === 'Ecosys Auto' || empresa?.label === 'EcosysAUTO'
        ? 'width:160px;height:auto;'
        : `height:50px;max-width:${empresa?.label === 'Eon Incorporadora' || empresa?.label === 'Spiti Incorporadora' ? '140px' : '160px'};width:auto;`
    }" />
  </td></tr>
  ${socialHTML ? `<tr><td style="padding-bottom:6px;">${socialHTML}</td></tr>` : ''}
  <tr><td style="padding-top:4px;">
    <div style="height:6px;background:linear-gradient(to right,${corPrimaria} 70%,${corSecundaria} 100%);border-radius:3px;width:100%;margin-bottom:8px;"></div>
    <p style="font-size:10px;color:#999;line-height:14px;margin:0;">Esta mensagem e seu conte&uacute;do &eacute; confidencial. Se voc&ecirc; recebeu por engano, n&atilde;o analise, copie ou compartilhe. Informe o equ&iacute;voco ao remetente e delete esta mensagem.</p>
  </td></tr>
</table>`;

      // Copy as HTML using execCommand (Clipboard API blocked by permissions policy)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = signatureHTML;
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('copy');
      selection?.removeAllRanges();
      document.body.removeChild(tempDiv);

      setCopied(true);
      toast.success('Assinatura copiada com sucesso!');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar:', err);
      toast.error('Erro ao copiar. Tente novamente.');
    }
  }, [nome, cargo, email, celular, empresa]);

  return (
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(rgb(240, 242, 245) 0%, rgb(248, 249, 251) 50%, rgb(238, 241, 245) 100%)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="rounded-2xl size-11 flex items-center justify-center" style={{ backgroundColor: empresa?.corPrimaria || '#1098f7', boxShadow: `0px 4px 14px 0px ${(empresa?.corPrimaria || '#1098f7')}40` }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path d={svgPaths.pd919a80} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                <path d={svgPaths.p189c1170} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
              </svg>
            </div>
            <div>
              <h1 className="text-[#1a1a2e] text-lg sm:text-xl tracking-[-0.5px]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                Gerador de Assinaturas
              </h1>
              <p className="text-[#717182] text-[13px] hidden sm:block" style={{ fontFamily: "'Inter', sans-serif" }}>
                Crie assinaturas de e-mail profissionais
              </p>
            </div>
          </div>

          {/* Badge empresa */}
          <div className="h-[34px] rounded-full flex items-center gap-2 px-4" style={{ backgroundColor: empresa?.corPrimaria || '#1098f7', boxShadow: `0px 2px 8px 0px ${(empresa?.corPrimaria || '#1098f7')}30` }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
              <g clipPath="url(#clip_badge)">
                <path d={svgPaths.p38014980} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
                <path d={svgPaths.pb95800} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
                <path d={svgPaths.p1914c880} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
              </g>
              <defs>
                <clipPath id="clip_badge"><rect fill="white" height="14" width="14" /></clipPath>
              </defs>
            </svg>
            <span className="text-white text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>{empresa?.label || 'Selecione'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 lg:gap-8">
          
          {/* Left: Form */}
          <div className="bg-white rounded-2xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04),0px_8px_24px_0px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            {/* Title */}
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-[#1098f7] w-1 h-6 rounded-full" />
              <h2 className="text-[#1a1a2e] text-[17px]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                Informações da Assinatura
              </h2>
            </div>

            <div className="space-y-5">
              {/* Empresa Dropdown */}
              <div className="space-y-2">
                <label className="text-[12px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  Empresa
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full h-[47px] bg-[#f7f8fa] border border-black/8 rounded-[14px] px-4 flex items-center justify-between text-left transition-colors hover:border-black/15 focus:outline-none focus:border-[#1098f7]"
                  >
                    <span className="text-sm text-[#1a1a2e]" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {empresa?.label || 'Selecione'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#717182]/60 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white border border-black/8 rounded-[14px] shadow-lg overflow-hidden max-h-[400px] overflow-y-auto">
                      {loadingEmpresas ? (
                        <div className="px-4 py-3 text-sm text-[#717182]">
                          <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                          Carregando...
                        </div>
                      ) : showCreateForm ? (
                        /* ── Formulário de criação inline ── */
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-[#1a1a2e]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                              Nova Empresa
                            </span>
                            <button
                              onClick={() => setShowCreateForm(false)}
                              className="p-1 rounded-lg hover:bg-[#f7f8fa] text-[#717182] transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                              Nome
                            </label>
                            <input
                              type="text"
                              value={newEmpresaNome}
                              onChange={(e) => setNewEmpresaNome(e.target.value)}
                              placeholder="Ex: 4P Capital"
                              autoFocus
                              className="w-full h-[40px] bg-[#f7f8fa] border border-black/8 rounded-xl px-3 text-sm text-[#1a1a2e] placeholder:text-[#717182]/40 focus:outline-none focus:border-[#1098f7] transition-colors"
                              style={{ fontFamily: "'Inter', sans-serif" }}
                              onKeyDown={(e) => e.key === 'Enter' && handleCreateEmpresa()}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                              Site
                            </label>
                            <input
                              type="text"
                              value={newEmpresaSite}
                              onChange={(e) => setNewEmpresaSite(e.target.value)}
                              placeholder="Ex: 4pcapital.com.br"
                              className="w-full h-[40px] bg-[#f7f8fa] border border-black/8 rounded-xl px-3 text-sm text-[#1a1a2e] placeholder:text-[#717182]/40 focus:outline-none focus:border-[#1098f7] transition-colors"
                              style={{ fontFamily: "'Inter', sans-serif" }}
                              onKeyDown={(e) => e.key === 'Enter' && handleCreateEmpresa()}
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setShowCreateForm(false)}
                              className="flex-1 h-[38px] rounded-xl border border-black/8 text-sm text-[#717182] hover:bg-[#f7f8fa] transition-colors"
                              style={{ fontFamily: "'Inter', sans-serif" }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleCreateEmpresa}
                              disabled={creatingEmpresa}
                              className={`flex-1 h-[38px] rounded-xl flex items-center justify-center gap-1.5 text-white text-sm transition-all ${
                                creatingEmpresa 
                                  ? 'bg-[#1098f7]/60 cursor-not-allowed' 
                                  : 'bg-[#1098f7] hover:bg-[#0d86dd] active:scale-[0.98]'
                              }`}
                              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
                            >
                              {creatingEmpresa ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Criar
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Lista de empresas ── */
                        <>
                          {empresas.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-[#717182]" style={{ fontFamily: "'Inter', sans-serif" }}>
                              Nenhuma empresa cadastrada
                            </div>
                          ) : (
                            empresas.map((emp) => (
                              <button
                                key={emp.value}
                                onClick={() => {
                                  setEmpresa(emp);
                                  setDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-3 text-left text-sm hover:bg-[#f7f8fa] transition-colors ${
                                  empresa?.value === emp.value ? 'bg-[#1098f7]/5 text-[#1098f7]' : 'text-[#1a1a2e]'
                                }`}
                                style={{ fontFamily: "'Inter', sans-serif" }}
                              >
                                <span className="block">{emp.label}</span>
                                {emp.site && <span className="block text-[11px] text-[#717182]/60 mt-0.5">{emp.site}</span>}
                              </button>
                            ))
                          )}
                          <div className="h-px bg-black/6" />
                          <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-[#1098f7]/5 transition-colors text-[#1098f7] flex items-center gap-2"
                            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar Nova Empresa
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.06), transparent)' }} />

              {/* Nome */}
              <div className="space-y-2">
                <label className="text-[12px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  Seu nome
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full h-[47px] bg-[#f7f8fa] border border-black/8 rounded-[14px] px-4 text-sm text-[#1a1a2e] placeholder:text-[#717182]/40 focus:outline-none focus:border-[#1098f7] transition-colors"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              {/* Cargo */}
              <div className="space-y-2">
                <label className="text-[12px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  Seu cargo
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Diretor Financeiro"
                  className="w-full h-[47px] bg-[#f7f8fa] border border-black/8 rounded-[14px] px-4 text-sm text-[#1a1a2e] placeholder:text-[#717182]/40 focus:outline-none focus:border-[#1098f7] transition-colors"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-[12px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  Seu e-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`Ex: joao@${empresa?.site || 'empresa.com'}`}
                  className="w-full h-[47px] bg-[#f7f8fa] border border-black/8 rounded-[14px] px-4 text-sm text-[#1a1a2e] placeholder:text-[#717182]/40 focus:outline-none focus:border-[#1098f7] transition-colors"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              {/* Celular */}
              <div className="space-y-2">
                <label className="text-[12px] tracking-[0.3px] uppercase text-[#717182]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  Seu celular (com DDD)
                </label>
                <input
                  type="tel"
                  value={celular}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  className="w-full h-[47px] bg-[#f7f8fa] border border-black/8 rounded-[14px] px-4 text-sm text-[#1a1a2e] placeholder:text-[#717182]/40 focus:outline-none focus:border-[#1098f7] transition-colors"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              {/* Botão Copiar */}
              <button
                onClick={handleCopy}
                className={`w-full h-[49px] rounded-[14px] flex items-center justify-center gap-2.5 text-white text-sm transition-all active:scale-[0.98]`}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  backgroundColor: copied ? '#22c55e' : (empresa?.corPrimaria || '#1098f7'),
                  boxShadow: copied
                    ? '0px 4px 14px 0px rgba(34,197,94,0.3)'
                    : `0px 4px 14px 0px ${(empresa?.corPrimaria || '#1098f7')}36`,
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-[18px] h-[18px]" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 18 18">
                      <g clipPath="url(#clip_copy)">
                        <path d={svgPaths.p6520580} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                        <path d={svgPaths.p3320a8e0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      </g>
                      <defs>
                        <clipPath id="clip_copy"><rect fill="white" height="18" width="18" /></clipPath>
                      </defs>
                    </svg>
                    Copiar Elementos
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[#717182]/70" style={{ fontFamily: "'Inter', sans-serif" }}>
                Após copiar, cole a assinatura nas configurações do seu e-mail.
              </p>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="bg-white rounded-2xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04),0px_8px_24px_0px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            {/* Title */}
            <div className="flex items-center gap-3 mb-7">
              <div className="bg-[#1098f7] w-1 h-6 rounded-full" />
              <h2 className="text-[#1a1a2e] text-[17px]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                Pré-visualização
              </h2>
            </div>

            {/* Email Preview Container */}
            <div className="rounded-2xl overflow-hidden shadow-[0px_0px_0px_1px_rgba(0,0,0,0.05),0px_2px_8px_0px_rgba(0,0,0,0.04)]">
              {/* Email Header bar */}
              <div className="px-5 pt-4 pb-4" style={{ background: 'linear-gradient(to bottom, #f8f8f9, #f3f3f5)' }}>
                <div className="flex gap-2 mb-3">
                  <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                  <div className="size-[10px] rounded-full bg-[#febc2e]" />
                  <div className="size-[10px] rounded-full bg-[#28c840]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px]" style={{ fontFamily: "'Inter', sans-serif", color: '#aaa' }}>
                    Para: <span className="text-[#777]">destinatario@email.com</span>
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: "'Inter', sans-serif", color: '#aaa' }}>
                    Assunto: <span className="text-[#777]">Reunião de alinhamento</span>
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-black/4" />

              {/* Email Body with Signature */}
              <div ref={signatureRef} className="bg-white p-6" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <p className="text-[13px] text-[#999] mb-1">--</p>
                <p className="text-[14px] text-[#333] mb-3">Atenciosamente,</p>

                {/* Name */}
                <p className="text-[15px] text-[#222] mb-0.5" style={{ fontWeight: 'bold' }}>
                  {nome || 'Seu nome'}
                </p>

                {/* Cargo */}
                <span className="inline-block text-[13px] pb-0.5 mb-4" style={{ color: '#1B1B1B', borderBottom: `2px solid ${empresa?.corPrimaria || '#1098f7'}` }}>
                  {cargo || 'Seu cargo'}
                </span>

                {/* Contact Info */}
                <table cellPadding={0} cellSpacing={0} className="mt-3 mb-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <td className="pr-1.5 align-middle" style={{ paddingBottom: '4px', width: '30px' }}>
                        {empresa?.iconeTelefone ? (
                          <img src={empresa.iconeTelefone} alt="Tel" width="24" height="24" style={{ display: 'block', width: '24px', height: '24px', objectFit: 'contain' }} />
                        ) : (
                          <svg width="24" height="24" fill="none" viewBox="0 0 16 16">
                            <path d={svgPaths.paac4dc0} stroke="#333" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={svgPaths.p225c7c80} stroke="#333" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td style={{ paddingBottom: '4px', color: '#1B1B1B' }}>
                        {celular || 'seu celular'}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-1.5 align-middle" style={{ paddingBottom: '4px', width: '30px' }}>
                        {empresa?.iconeEmail ? (
                          <img src={empresa.iconeEmail} alt="Email" width="24" height="24" style={{ display: 'block', width: '24px', height: '24px', objectFit: 'contain' }} />
                        ) : (
                          <svg width="24" height="24" fill="none" viewBox="0 0 16 16">
                            <path d={svgPaths.p14a15780} stroke="#333" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M1.5 3.5L8 8.5L14.5 3.5" stroke="#333" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td style={{ paddingBottom: '4px', color: '#1B1B1B' }}>
                        {email || 'seu email'}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-1.5 align-middle" style={{ width: '30px' }}>
                        {empresa?.iconeGlobe ? (
                          <img src={empresa.iconeGlobe} alt="Site" width="24" height="24" style={{ display: 'block', width: '24px', height: '24px', objectFit: 'contain' }} />
                        ) : (
                          <svg width="24" height="24" fill="none" viewBox="0 0 16 16">
                            <path d={svgPaths.p3cb94380} stroke="#333" strokeMiterlimit="10" />
                            <path d={svgPaths.p22f38e00} stroke="#333" strokeMiterlimit="10" />
                            <path d="M1.5 8H14.5" stroke="#333" strokeMiterlimit="10" />
                            <path d="M8 1.5V14.5" stroke="#333" strokeMiterlimit="10" />
                            <path d={svgPaths.p13badb80} stroke="#333" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={svgPaths.p1d484180} stroke="#333" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </td>
                      <td style={{ color: '#1B1B1B' }}>
                        {empresa?.site || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Logo - dinâmica da empresa */}
                <div className="mb-2">
                  {empresa?.logo ? (
                    <img
                      src={empresa.logo}
                      alt={empresa.label || 'Logo'}
                      width="auto"
                      height="50"
                      className={`block object-contain ${
                        empresa.label === 'Ecosys AUTO' || empresa.label === 'Ecosys Auto' || empresa.label === 'EcosysAUTO'
                          ? '!w-[160px] !h-[60px] !object-cover !min-h-0'
                          : empresa.label === 'Eon Incorporadora' || empresa.label === 'Spiti Incorporadora'
                            ? '!h-[50px] !min-h-[50px] w-auto !max-w-[140px]'
                            : '!h-[50px] !min-h-[50px] w-auto !max-w-[160px]'
                      }`}
                    />
                  ) : (
                    <img
                      src={typeof imgImage4PCapital === 'string' ? imgImage4PCapital : imgImage4PCapital.src}
                      alt={empresa?.label || 'Logo'}
                      width="auto"
                      height="50"
                      className="!h-[50px] !min-h-[50px] !max-w-[160px] w-auto block"
                    />
                  )}
                </div>

                {/* Social Icons */}
                <div className="flex gap-2 mb-3">
                  {/* Facebook */}
                  {empresa?.facebook && (
                    <a href={empresa.facebook} target="_blank" rel="noopener noreferrer" className="block">
                      {empresa?.iconeFacebook ? (
                        <img src={empresa.iconeFacebook} alt="Facebook" width="26" height="26" style={{ display: 'block', width: '26px', height: '26px', objectFit: 'contain' }} />
                      ) : (
                        <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                          <path d={svgPaths.p3cbfd00} fill="#555" transform="translate(3.33 1.67)" />
                        </svg>
                      )}
                    </a>
                  )}
                  {/* Instagram */}
                  {empresa?.instagram && (
                    <a href={empresa.instagram} target="_blank" rel="noopener noreferrer" className="block">
                      {empresa?.iconeInstagram ? (
                        <img src={empresa.iconeInstagram} alt="Instagram" width="24" height="24" style={{ display: 'block', width: '24px', height: '24px', objectFit: 'contain' }} />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                          <g transform="translate(0.83 0.83)">
                            <path d={svgPaths.p1aaf0300} stroke="#555" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                            <path d={svgPaths.p1a50b2f0} stroke="#555" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" transform="translate(5.33 5.33)" />
                          </g>
                        </svg>
                      )}
                    </a>
                  )}
                  {/* Fallback: mostrar ícones sem link se empresa não tiver redes */}
                  {!empresa?.facebook && !empresa?.instagram && (
                    <>
                      <span className="block opacity-30" style={{ width: '26px', height: '26px' }}>
                        <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                          <path d={svgPaths.p3cbfd00} fill="#555" transform="translate(3.33 1.67)" />
                        </svg>
                      </span>
                      <span className="block opacity-30" style={{ width: '24px', height: '24px' }}>
                        <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                          <g transform="translate(0.83 0.83)">
                            <path d={svgPaths.p1aaf0300} stroke="#555" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
                            <path d={svgPaths.p1a50b2f0} stroke="#555" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" transform="translate(5.33 5.33)" />
                          </g>
                        </svg>
                      </span>
                    </>
                  )}
                </div>

                {/* Gradient line - usa cores da empresa */}
                <div className="h-1.5 rounded-[3px] mb-2" style={{ background: `linear-gradient(to right, ${empresa?.corPrimaria || '#1098f7'} 70%, ${empresa?.corSecundaria || '#035fa0'} 100%)` }} />

                {/* Disclaimer */}
                <p className="text-[10px] text-[#999] leading-[14px]">
                  Esta mensagem e seu conteúdo é confidencial. Se você recebeu por engano, não analise, copie ou compartilhe. Informe o equívoco ao remetente e delete esta mensagem.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#717182]/50 mt-10" style={{ fontFamily: "'Inter', sans-serif" }}>
          Gerador de Assinaturas — Grupo Empresarial
        </p>
      </main>
    </div>
  );
}

export default Assinaturas;