"use client";

import { useState } from 'react';
import { KeyRound, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';

interface ResetPasswordProps {
  onNavigateToLogin: () => void;
}

export function ResetPassword({ onNavigateToLogin }: ResetPasswordProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const { getSupabaseClient } = await import('@/utils/supabase/client');
      const supabase = getSupabaseClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password-confirm`,
      });

      if (resetError) {
        console.error('Erro ao solicitar redefinição:', resetError);
        setError('Não foi possível enviar o email. Verifique se o endereço está correto.');
        setLoading(false);
        return;
      }

      console.log('Email de redefinição enviado com sucesso');
      setSuccess(true);
      setLoading(false);

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

            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#D1FAE5] rounded-full mb-6">
              <CheckCircle className="w-10 h-10 text-[#10B981]" />
            </div>

            <h1 className="text-[#1B1B1B] mb-3">Email enviado!</h1>
            <p className="text-[#4B5563] mb-2">
              Enviamos um link de redefinição para
            </p>
            <p className="text-[#1B1B1B] font-medium mb-6">{email}</p>
            <p className="text-[#9CA3AF] text-sm mb-8">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>

            <button
              onClick={onNavigateToLogin}
              className="w-full bg-black text-white py-3.5 rounded-lg hover:bg-gray-800 transition-all duration-150 shadow-sm"
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
      {/* Lado Esquerdo - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button
            onClick={onNavigateToLogin}
            className="mb-8 flex items-center gap-2 text-[#4B5563] hover:text-[#1B1B1B] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>

          <div className="mb-12">
            <img
              src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
              alt="EON"
              className="h-12 mb-8"
            />
            <h1 className="text-[#1B1B1B] mb-2">Redefinir senha</h1>
            <p className="text-[#9CA3AF]">
              Digite seu email para receber o link de redefinição
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[#1B1B1B] font-medium mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 bg-[#F3F3F3] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all duration-150 text-[#1B1B1B] placeholder:text-[#9CA3AF]"
              />
            </div>

            {error && (
              <div className="bg-[#FEE2E2] border border-red-200 text-[#991B1B] px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3.5 rounded-lg hover:bg-gray-800 transition-all duration-150 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  Enviar link
                </>
              )}
            </button>
          </form>

          <div className="mt-8 p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
            <p className="text-[#4B5563] text-sm">
              <strong>Nota:</strong> O link de redefinição expira em 1 hora. Caso não receba o email, verifique sua pasta de spam.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-black items-center justify-center p-12">
        <div className="max-w-md text-center">
          <img
            src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
            alt="EON"
            className="h-16 mb-8 mx-auto brightness-0 invert"
          />
          <h2 className="text-white mb-4">Recuperação de Senha</h2>
          <p className="text-white/70">
            Informe seu email cadastrado e enviaremos um link seguro para redefinir sua senha
          </p>
        </div>
      </div>
    </div>
  );
}
