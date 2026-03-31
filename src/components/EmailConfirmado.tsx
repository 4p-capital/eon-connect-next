"use client";

import { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import eonLogo from '@/assets/0d61051e7e3d9184d675cfec8b0341c5383f7b2a.png';

interface EmailConfirmadoProps {
  onNavigateToLogin: () => void;
}

export function EmailConfirmado({ onNavigateToLogin }: EmailConfirmadoProps) {
  const [autoRedirectSeconds, setAutoRedirectSeconds] = useState(5);
  const [verificando, setVerificando] = useState(true);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    const verificarConfirmacao = async () => {
      try {
        const { getSupabaseClient } = await import('@/utils/supabase/client');
        const supabase = getSupabaseClient();

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user?.email_confirmed_at) {
          console.log('Email confirmado:', session.user.email);
          setConfirmado(true);
        } else {
          console.log('Email ainda não confirmado');
          setConfirmado(true);
        }
      } catch (error) {
        console.error('Erro ao verificar confirmação:', error);
        setConfirmado(true);
      } finally {
        setVerificando(false);
      }
    };

    verificarConfirmacao();
  }, []);

  useEffect(() => {
    if (!confirmado || verificando) return;

    const interval = setInterval(() => {
      setAutoRedirectSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onNavigateToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmado, verificando, onNavigateToLogin]);

  if (verificando) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-black animate-spin mx-auto mb-4" />
          <p className="text-[#4B5563]">Verificando confirmação...</p>
        </div>
      </div>
    );
  }

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
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto">
              <div className="w-20 h-20 bg-[#A7F3D0] rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-[#10B981]" />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-[#1B1B1B] mb-3">
            Email confirmado!
          </h1>

          <p className="text-[#4B5563] mb-8">
            Sua conta foi ativada com sucesso. Agora você pode fazer login e começar a usar o EON Connect.
          </p>

          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-6 mb-6 text-left">
            <h3 className="text-[#1B1B1B] font-medium mb-4 text-center">
              Próximos passos
            </h3>
            <div className="space-y-3 text-sm text-[#4B5563]">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#D1FAE5] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-[#1B1B1B] font-medium">Faça login</p>
                  <p className="text-[#9CA3AF] text-xs">Use seu email e senha para acessar</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#F3F3F3] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#4B5563] text-xs font-medium">2</span>
                </div>
                <div>
                  <p className="text-[#1B1B1B] font-medium">Complete seu perfil</p>
                  <p className="text-[#9CA3AF] text-xs">Adicione informações adicionais</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#F3F3F3] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#4B5563] text-xs font-medium">3</span>
                </div>
                <div>
                  <p className="text-[#1B1B1B] font-medium">Comece a usar</p>
                  <p className="text-[#9CA3AF] text-xs">Gerencie assistências técnicas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-gray-700">
              Redirecionando para login em {autoRedirectSeconds} segundo{autoRedirectSeconds !== 1 ? 's' : ''}...
            </p>
          </div>

          <button
            onClick={onNavigateToLogin}
            className="w-full bg-black text-white py-4 rounded-lg hover:bg-gray-800 transition-all duration-150 flex items-center justify-center gap-2 group shadow-sm hover:shadow-md"
          >
            <span>Ir para login agora</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <p className="text-center text-sm text-[#9CA3AF] mt-6">
          Bem-vindo ao EON Connect!
        </p>
      </div>
    </div>
  );
}
