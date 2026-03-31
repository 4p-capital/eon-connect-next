"use client";

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';
import buildingImage from '@/assets/928dc6b944a5a407b1eef35320ae1bb14336bc67.png';
import { loginSchema } from '@/lib/validations/auth';

interface LoginProps {
  onLogin: (accessToken: string, userId: string, userName: string) => void;
  onNavigateToSignUp: () => void;
  onNavigateToReset: () => void;
  onWaitingPermission?: () => void;
}

export function Login({ onLogin, onNavigateToSignUp, onNavigateToReset, onWaitingPermission }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validar com zod
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[String(err.path[0])] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const { getSupabaseClient } = await import('@/utils/supabase/client');
      const supabase = getSupabaseClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Email não confirmado. Verifique sua caixa de entrada');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (!data.session || !data.user) {
        setError('Erro ao criar sessão');
        setLoading(false);
        return;
      }

      // Buscar dados do usuário e verificar se está ativo e possui permissões
      let userName = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuário';

      try {
        // Buscar dados do usuário pela tabela User, incluindo permissões
        const { data: userDataFromDB, error: userError } = await (supabase
          .from('User') as ReturnType<typeof supabase.from>)
          .select('nome, ativo, menu_assistencia, menu_gerenciamento, menu_planejamento')
          .eq('auth_user_id', data.user.id)
          .maybeSingle();

        if (userError) {
          console.error('Erro ao buscar dados do usuário:', userError);
        } else if (userDataFromDB) {
          userName = userDataFromDB.nome;

          // Verificar se usuário está ativo
          if (userDataFromDB.ativo === false) {
            await supabase.auth.signOut();
            setError('Usuário desativado. Entre em contato com seu gestor.');
            setLoading(false);
            return;
          }

          // Verificar se todas as permissões estão false
          const todasPermissoesFalse =
            !userDataFromDB.menu_assistencia &&
            !userDataFromDB.menu_gerenciamento &&
            !userDataFromDB.menu_planejamento;

          if (todasPermissoesFalse) {
            // Salvar informações do usuário no localStorage antes de redirecionar
            localStorage.setItem('access_token', data.session.access_token);
            localStorage.setItem('user_id', data.user.id);
            localStorage.setItem('user_name', userName);

            setLoading(false);

            if (onWaitingPermission) {
              onWaitingPermission();
            }
            return;
          }
        }
      } catch (err) {
        console.error('Erro ao buscar dados do usuário:', err);
      }

      // Animação de confetes
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      setTimeout(() => {
        onLogin(data.session.access_token, data.user.id, userName);
      }, duration);

    } catch (err) {
      console.error('Erro ao processar login:', err);
      setError('Erro ao conectar com o servidor');
      setLoading(false);
    }
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
            <h1 className="mb-6 leading-tight text-white font-semibold text-[32px]">
              Criamos soluções que duram, impactam e evoluem com o tempo.
            </h1>
          </div>

          <div />
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#0A0A0A]">
        <div className="w-full max-w-md">
          {/* Logo Mobile */}
          <div className="lg:hidden mb-12">
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON Connect"
              className="h-10 brightness-0 invert"
            />
          </div>

          {/* Header */}
          <div className="mb-10">
            <h2 className="text-3xl font-semibold text-white mb-3">Bem-vindo de volta</h2>
            <p className="text-[#6B7280]">Acesse o sistema de gestão de assistência técnica</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                aria-invalid={!!fieldErrors.email}
                className="w-full px-4 py-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 text-white placeholder:text-[#555]"
              />
              {fieldErrors.email && (
                <p id="login-email-error" className="mt-1 text-sm text-red-400" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  aria-invalid={!!fieldErrors.password}
                  className="w-full px-4 py-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-white/30 focus:border-[#444] transition-all duration-150 pr-12 text-white placeholder:text-[#555]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="mt-1 text-sm text-red-400" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Esqueceu a senha */}
            <div className="text-right">
              <button
                type="button"
                onClick={onNavigateToReset}
                className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>

            {/* Botão de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-lg hover:bg-gray-200 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-8 shadow-sm hover:shadow-md font-medium"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Link para Cadastro */}
          <div className="mt-8 text-center">
            <p className="text-[#6B7280]">
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={onNavigateToSignUp}
                className="text-white hover:text-gray-300 font-medium"
              >
                Criar conta
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
