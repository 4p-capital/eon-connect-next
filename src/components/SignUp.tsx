"use client";

import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';
import buildingImage from '@/assets/928dc6b944a5a407b1eef35320ae1bb14336bc67.png';
import { signUpSchema } from '@/lib/validations/auth';
import { apiBaseUrl, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';

interface SignUpProps {
  onSignUpSuccess: () => void;
  onNavigateToLogin: () => void;
  onNavigateToVerifyEmail?: (email: string) => void;
}

export function SignUp({ onSignUpSuccess, onNavigateToLogin, onNavigateToVerifyEmail }: SignUpProps) {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    password: '',
    confirmPassword: '',
    idempresa: '',
  });
  const [empresas, setEmpresas] = useState<Array<{ id: number; nome: string }>>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Carregar empresas
  useEffect(() => {
    const carregarEmpresas = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/empresas`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setEmpresas(data.empresas);
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
      } finally {
        setLoadingEmpresas(false);
      }
    };

    carregarEmpresas();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Limpar erro do campo ao digitar
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    if (name === 'cpf') {
      setFormData(prev => ({ ...prev, [name]: formatCPF(value) }));
      return;
    }

    if (name === 'telefone') {
      setFormData(prev => ({ ...prev, [name]: formatTelefone(value) }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validar com zod
    const validation = signUpSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[String(err.path[0])] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            nome: formData.nome,
            cpf: formData.cpf,
            telefone: formData.telefone,
            email: formData.email,
            password: formData.password,
            idempresa: parseInt(formData.idempresa),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Erro ao criar conta';
        setError(errorMessage);
        setLoading(false);
        toast.error(errorMessage);
        return;
      }

      if (onNavigateToVerifyEmail) {
        onNavigateToVerifyEmail(formData.email);
      } else {
        toast.success('Conta criada com sucesso! Verifique seu email.');
        onSignUpSuccess();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar com o servidor';
      setError(errorMessage);
      setLoading(false);
      toast.error(errorMessage);
    }
  };

  const renderFieldError = (field: string) => {
    if (!fieldErrors[field]) return null;
    return (
      <p className="mt-1 text-sm text-red-400" role="alert">
        {fieldErrors[field]}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Lado Esquerdo - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={typeof buildingImage === "string" ? buildingImage : buildingImage.src}
            alt="Edifício EON em construção"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON Connect"
              className="h-10 brightness-0 invert"
            />
          </div>

          <div className="max-w-lg">
            <h1 className="text-5xl mb-6 leading-tight text-white font-semibold">
              Criamos soluções que duram, impactam e evoluem com o tempo.
            </h1>
          </div>

          <div />
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#0A0A0A] overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Logo Mobile */}
          <div className="lg:hidden mb-8">
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON Connect"
              className="h-10 brightness-0 invert"
            />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-semibold text-white mb-3">Criar nova conta</h2>
            <p className="text-[#6B7280]">Preencha seus dados para começar</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Nome */}
            <div>
              <label htmlFor="signup-nome" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Nome e segundo nome
              </label>
              <input
                id="signup-nome"
                name="nome"
                type="text"
                value={formData.nome}
                onChange={handleChange}
                placeholder="João Silva"
                required
                autoComplete="name"
                aria-invalid={!!fieldErrors.nome}
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 text-white placeholder:text-[#555]"
              />
              {renderFieldError('nome')}
            </div>

            {/* CPF */}
            <div>
              <label htmlFor="signup-cpf" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                CPF
              </label>
              <input
                id="signup-cpf"
                name="cpf"
                type="text"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                required
                inputMode="numeric"
                aria-invalid={!!fieldErrors.cpf}
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 text-white placeholder:text-[#555]"
              />
              {renderFieldError('cpf')}
            </div>

            {/* Telefone */}
            <div>
              <label htmlFor="signup-telefone" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Telefone
              </label>
              <input
                id="signup-telefone"
                name="telefone"
                type="tel"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                required
                autoComplete="tel"
                aria-invalid={!!fieldErrors.telefone}
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 text-white placeholder:text-[#555]"
              />
              {renderFieldError('telefone')}
            </div>

            {/* Empresa */}
            <div>
              <label htmlFor="signup-empresa" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Empresa
              </label>
              <select
                id="signup-empresa"
                name="idempresa"
                value={formData.idempresa}
                onChange={handleChange}
                required
                disabled={loadingEmpresas}
                aria-invalid={!!fieldErrors.idempresa}
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 text-white"
              >
                <option value="" className="bg-[#1A1A1A] text-[#555]">
                  {loadingEmpresas ? 'Carregando empresas...' : 'Selecione uma empresa'}
                </option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id} className="bg-[#1A1A1A] text-white">
                    {empresa.nome}
                  </option>
                ))}
              </select>
              {renderFieldError('idempresa')}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                E-mail
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 text-white placeholder:text-[#555]"
              />
              {renderFieldError('email')}
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 pr-12 text-white placeholder:text-[#555]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {renderFieldError('password')}
            </div>

            {/* Confirmar Senha */}
            <div>
              <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Digite a senha novamente"
                  required
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 pr-12 text-white placeholder:text-[#555]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {renderFieldError('confirmPassword')}
            </div>

            {/* Erro geral */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Botão de Submit */}
            <button
              type="submit"
              disabled={loading || loadingEmpresas}
              className="w-full bg-white text-black py-4 rounded-lg hover:bg-gray-200 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 shadow-sm hover:shadow-md font-medium"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Criando conta...
                </>
              ) : (
                'Criar conta'
              )}
            </button>
          </form>

          {/* Link para Login */}
          <div className="mt-6 text-center">
            <p className="text-[#6B7280]">
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-white hover:text-gray-300 font-medium"
              >
                Fazer login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
