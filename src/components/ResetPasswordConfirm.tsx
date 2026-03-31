"use client";

import { useState, useEffect } from 'react';
import { Eye, EyeOff, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';

interface ResetPasswordConfirmProps {
  onNavigateToLogin: () => void;
}

export function ResetPasswordConfirm({ onNavigateToLogin }: ResetPasswordConfirmProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);

  // Verificar se há um token válido ao montar
  useEffect(() => {
    const checkToken = async () => {
      try {
        const { getSupabaseClient } = await import('@/utils/supabase/client');
        const supabase = getSupabaseClient();

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error('Token de recuperação inválido ou expirado');
          setTokenValid(false);
          setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
        } else {
          console.log('Token de recuperação válido');
        }
      } catch (err) {
        console.error('Erro ao verificar token:', err);
        setTokenValid(false);
        setError('Erro ao verificar link de recuperação');
      }
    };

    checkToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setLoading(true);

    try {
      const { getSupabaseClient } = await import('@/utils/supabase/client');
      const supabase = getSupabaseClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('Erro ao atualizar senha:', updateError);

        if (updateError.message.includes('same as the old password')) {
          setError('A nova senha não pode ser igual à senha anterior');
        } else if (updateError.message.includes('Auth session missing')) {
          setError('Sessão expirada. Solicite um novo link de recuperação.');
        } else {
          setError('Não foi possível atualizar sua senha. Tente novamente.');
        }

        setLoading(false);
        return;
      }

      console.log('Senha atualizada com sucesso');
      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        onNavigateToLogin();
      }, 3000);

    } catch (err) {
      console.error('Erro ao processar redefinição:', err);
      setError('Erro ao conectar com o servidor');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON"
              className="h-12 mb-12 mx-auto"
            />

            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-gray-900 mb-3">Senha redefinida!</h1>
            <p className="text-gray-600 mb-6">
              Sua senha foi atualizada com sucesso.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              Você será redirecionado para a tela de login em instantes...
            </p>

            <button
              onClick={onNavigateToLogin}
              className="w-full bg-gray-900 text-white py-3.5 rounded-lg hover:bg-gray-800 transition-all"
            >
              Ir para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON"
              className="h-12 mb-12 mx-auto"
            />

            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>

            <h1 className="text-gray-900 mb-3">Link expirado</h1>
            <p className="text-gray-600 mb-6">
              {error || 'Este link de recuperação expirou ou é inválido.'}
            </p>
            <p className="text-gray-500 text-sm mb-8">
              Por segurança, os links de recuperação expiram em 1 hora.
            </p>

            <button
              onClick={onNavigateToLogin}
              className="w-full bg-gray-900 text-white py-3.5 rounded-lg hover:bg-gray-800 transition-all"
            >
              Voltar para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON"
              className="h-12 mb-8"
            />
            <h1 className="text-gray-900 mb-2">Defina sua nova senha</h1>
            <p className="text-gray-500">
              Escolha uma senha forte com no mínimo 6 caracteres
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-gray-700 mb-2">
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {password.length > 0 && password.length < 6 && (
                <p className="text-red-500 text-sm mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-gray-700 mb-2">
                Confirme a nova senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-red-500 text-sm mt-1">As senhas não conferem</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password !== confirmPassword || password.length < 6}
              className="w-full bg-gray-900 text-white py-3.5 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Atualizando senha...
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  Redefinir senha
                </>
              )}
            </button>
          </form>

          <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-600 text-sm">
              <strong>Dica de segurança:</strong> Use uma senha forte com letras, números e caracteres especiais. Nunca compartilhe sua senha.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <img
            src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
            alt="EON"
            className="h-16 mb-8 mx-auto brightness-0 invert"
          />
          <h2 className="text-white mb-4">Nova Senha</h2>
          <p className="text-gray-400">
            Defina uma senha forte e segura para proteger sua conta
          </p>
        </div>
      </div>
    </div>
  );
}
