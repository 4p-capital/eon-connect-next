"use client";

import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Ban, Clock, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppAlert {
  type: 'BANNED_OR_RESTRICTED' | 'RATE_LIMIT' | 'OTHER';
  timestamp: string;
  error?: string;
  message?: string;
  phone?: string;
}

export function WhatsAppStatusAlert() {
  const [alert, setAlert] = useState<WhatsAppAlert | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWhatsAppStatus();
    // Verificar a cada 5 minutos
    const interval = setInterval(checkWhatsAppStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkWhatsAppStatus = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/whatsapp/status-alert`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        if (data.alert) {
          setAlert(data.alert);
          setDismissed(false);
        } else {
          setAlert(null);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn('WhatsApp status check timeout (servidor pode estar iniciando)');
      } else {
        console.error('Erro ao verificar status WhatsApp:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = async () => {
    setDismissed(true);
    if (alert) {
      localStorage.setItem('whatsapp_alert_dismissed', alert.timestamp);
    }
  };

  const clearAlert = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/whatsapp/clear-alert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      setAlert(null);
      setDismissed(false);
    } catch (error) {
      console.error('Erro ao limpar alerta:', error);
    }
  };

  if (loading || !alert || dismissed) {
    return null;
  }

  // Verificar se já foi dispensado nesta sessão
  const lastDismissed = localStorage.getItem('whatsapp_alert_dismissed');
  if (lastDismissed === alert.timestamp) {
    return null;
  }

  const getAlertConfig = () => {
    switch (alert.type) {
      case 'BANNED_OR_RESTRICTED':
        return {
          icon: Ban,
          color: 'bg-red-50 border-red-500',
          iconColor: 'text-red-600',
          title: 'ALERTA CRITICO: WhatsApp Restringido/Banido',
          description: 'O número do WhatsApp conectado ao sistema foi restringido ou banido pelo WhatsApp. As mensagens NAO estão sendo enviadas.',
          actions: [
            'Verifique imediatamente o painel da Z-API',
            'Aguarde o período de restrição (geralmente 24-48h para restrições temporárias)',
            'Revise as políticas de uso do WhatsApp Business API',
            'Se banido permanentemente, será necessário um novo número',
          ],
        };
      case 'RATE_LIMIT':
        return {
          icon: Clock,
          color: 'bg-yellow-50 border-yellow-500',
          iconColor: 'text-yellow-600',
          title: 'Limite de Envio Atingido',
          description: 'O limite de mensagens do WhatsApp foi atingido temporariamente. Aguarde alguns minutos antes de enviar mais mensagens.',
          actions: [
            'Aguarde 5-10 minutos antes de tentar novamente',
            'Reduza a frequência de envios',
            'Espaçe melhor os envios de mensagens',
          ],
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'bg-orange-50 border-orange-500',
          iconColor: 'text-orange-600',
          title: 'Problema no WhatsApp',
          description: 'Foi detectado um problema com o serviço de WhatsApp.',
          actions: [],
        };
    }
  };

  const config = getAlertConfig();
  const Icon = config.icon;

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:w-[500px] z-50 animate-in slide-in-from-top-5">
      <Alert className={`${config.color} border-2 shadow-2xl relative`}>
        <button
          onClick={dismissAlert}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Dispensar alerta"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <Icon className={`h-6 w-6 ${config.iconColor} flex-shrink-0 mt-1`} />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">{config.title}</h3>
            <AlertDescription className="text-gray-700 text-sm mb-3">
              {config.description}
            </AlertDescription>

            {alert.message && (
              <div className="bg-white/60 rounded p-2 mb-3 text-xs font-mono text-gray-600 break-all">
                <strong>Erro:</strong> {alert.message}
              </div>
            )}

            {config.actions.length > 0 && (
              <div className="mb-3">
                <p className="font-semibold text-sm mb-2 text-gray-800">O que fazer:</p>
                <ul className="text-sm space-y-1 text-gray-700">
                  {config.actions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-gray-400 flex-shrink-0">-</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-gray-500 mb-3">
              <Clock className="h-3 w-3 inline mr-1" />
              Detectado em: {new Date(alert.timestamp).toLocaleString('pt-BR')}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={clearAlert}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Problema Resolvido
              </Button>
              <Button
                onClick={dismissAlert}
                size="sm"
                variant="ghost"
                className="text-xs"
              >
                Dispensar
              </Button>
            </div>
          </div>
        </div>
      </Alert>
    </div>
  );
}
