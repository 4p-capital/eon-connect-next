"use client";

import { useState } from 'react';
import { Mail, Check, ArrowLeft } from 'lucide-react';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';

interface VerifiqueEmailProps {
  email: string;
  onNavigateToLogin: () => void;
}

export function VerifiqueEmail({ email, onNavigateToLogin }: VerifiqueEmailProps) {
  const [emailReenviado, setEmailReenviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const handleReenviarEmail = async () => {
    setEnviando(true);
    setErro('');

    try {
      const { getSupabaseClient } = await import('@/utils/supabase/client');
      const supabase = getSupabaseClient();

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        console.error('Erro ao reenviar email:', error);

        if (error.message.includes('SMTP') || error.message.includes('sending') || error.message.includes('confirmation email')) {
          setErro('O envio de emails ainda não foi configurado. Entre em contato com o suporte.');
        } else {
          setErro('Erro ao reenviar email. Entre em contato com o suporte.');
        }
      } else {
        setEmailReenviado(true);
        setTimeout(() => setEmailReenviado(false), 5000);
      }
    } catch (err) {
      console.error('Erro ao reenviar email:', err);
      setErro('Erro ao conectar com o servidor. Tente novamente mais tarde.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={typeof eonLogo === "string" ? eonLogo : eonLogo.src}
            alt="EON"
            className="h-12 mx-auto mb-12"
          />
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-[#F3F3F3] rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-gray-900" />
          </div>

          <h1 className="text-2xl font-semibold text-[#1B1B1B] mb-3">
            Verifique seu email
          </h1>

          <p className="text-[#4B5563] mb-2">
            Enviamos um link de confirmação para
          </p>
          <p className="text-[#1B1B1B] font-medium mb-6">
            {email}
          </p>

          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-[#1B1B1B] font-medium mb-3">
              Para ativar sua conta:
            </p>
            <ol className="space-y-2 text-sm text-[#4B5563]">
              <li className="flex items-start gap-2">
                <span className="text-gray-900 font-semibold mt-0.5">1.</span>
                <span>Abra sua caixa de entrada</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-900 font-semibold mt-0.5">2.</span>
                <span>Procure por um email do EON Connect</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-900 font-semibold mt-0.5">3.</span>
                <span>Clique no link de confirmação</span>
              </li>
            </ol>
          </div>

          <div className="bg-[#FEF3C7] border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-[#92400E]">
              Não recebeu o email? Verifique sua pasta de spam ou lixo eletrônico
            </p>
          </div>

          {emailReenviado && (
            <div className="bg-[#D1FAE5] border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2 justify-center">
              <Check className="w-5 h-5 text-[#10B981]" />
              <p className="text-sm text-[#065F46]">
                Email reenviado com sucesso!
              </p>
            </div>
          )}

          {erro && (
            <div className="bg-[#FEE2E2] border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 justify-center">
              <p className="text-sm text-[#991B1B]">
                {erro}
              </p>
            </div>
          )}

          <button
            onClick={handleReenviarEmail}
            disabled={enviando || emailReenviado}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mb-3 shadow-sm"
          >
            {enviando ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reenviando...
              </span>
            ) : emailReenviado ? (
              'Email enviado!'
            ) : (
              'Reenviar email de confirmação'
            )}
          </button>

          <button
            onClick={onNavigateToLogin}
            className="w-full bg-white text-[#1B1B1B] border border-[#E5E7EB] py-3 rounded-lg hover:bg-[#F3F3F3] transition-all duration-150 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para login
          </button>
        </div>

        <p className="text-center text-sm text-[#9CA3AF] mt-6">
          Problemas com a confirmação? Entre em contato com o suporte
        </p>
      </div>
    </div>
  );
}
