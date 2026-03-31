/**
 * 🎓 COMPONENTE DE EXEMPLO - DEMONSTRAÇÃO DO SISTEMA DE ERROS
 * 
 * Este componente demonstra como o novo sistema de tratamento de erros funciona.
 * Ele simula diferentes tipos de erros e mostra como são tratados de forma segura.
 * 
 * ⚠️ Este componente é apenas para demonstração/teste. NÃO usar em produção.
 */

"use client";

import { useState } from 'react';
import { useApiCall, safeFetch } from '@/hooks/useApiCall';
import { sanitizeError } from '@/utils/errorHandler';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ExemploErroSeguro() {
  const [resultado, setResultado] = useState<string>('');
  const { loading, error, execute } = useApiCall();

  // Simular erro de rede
  const simularErroRede = async () => {
    setResultado('Simulando erro de rede...');
    const result = await execute(async () => {
      // Simular falha de conexão
      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Failed to fetch: Network error')), 1000)
      );
    });

    if (!result.success) {
      setResultado(`❌ Erro tratado! O usuário viu: "${result.error?.userMessage}"`);
    }
  };

  // Simular erro de autenticação
  const simularErroAuth = async () => {
    setResultado('Simulando erro de autenticação...');
    const result = await execute(async () => {
      // Simular resposta 401
      const error: any = new Error('Unauthorized: Invalid token');
      error.status = 401;
      throw error;
    });

    if (!result.success) {
      setResultado(`❌ Erro tratado! O usuário viu: "${result.error?.userMessage}"`);
    }
  };

  // Simular erro de validação
  const simularErroValidacao = async () => {
    setResultado('Simulando erro de validação...');
    const result = await execute(async () => {
      const error: any = new Error('Validation failed: Email is required');
      error.status = 400;
      throw error;
    });

    if (!result.success) {
      setResultado(`❌ Erro tratado! O usuário viu: "${result.error?.userMessage}"`);
    }
  };

  // Simular erro do servidor com informações sensíveis
  const simularErroSensivel = async () => {
    setResultado('Simulando erro com informações sensíveis...');
    const result = await execute(async () => {
      // Este erro contém informações sensíveis que NÃO devem ser mostradas ao usuário
      throw new Error(
        'PostgreSQL error at https://connect.eonbr.com/_runtimes/sites-runtime.99ee0755076a2084604caebccc4b7 ' +
        'at /src/components/GerenciamentoAssistencia.tsx:145:32 ' +
        'Failed to execute query: SELECT * FROM users WHERE token = "eyJhbGciOiJIUzI1NiIsInR5cCI6..."'
      );
    });

    if (!result.success) {
      setResultado(
        `❌ Erro tratado com sucesso!\n\n` +
        `O QUE O USUÁRIO VIU:\n"${result.error?.userMessage}"\n\n` +
        `O QUE FOI REMOVIDO:\n` +
        `- URL do sistema (connect.eonbr.com)\n` +
        `- Path do arquivo (GerenciamentoAssistencia.tsx:145)\n` +
        `- Token de autenticação (eyJhbGciOiJ...)\n` +
        `- Detalhes da query SQL\n\n` +
        `ID para suporte: ${result.error?.errorId}`
      );
    }
  };

  // Exemplo de uso manual com sanitizeError
  const exemploManual = () => {
    try {
      // Simular um erro com informações sensíveis
      throw new Error(
        'Database connection failed at 192.168.1.100:5432 ' +
        'for user admin@example.com with password abc123'
      );
    } catch (error) {
      const safe = sanitizeError(error);
      
      toast.error(safe.userMessage, {
        description: `Código de referência: ${safe.errorId}`,
      });

      setResultado(
        `✅ Erro sanitizado manualmente!\n\n` +
        `O QUE FOI REMOVIDO:\n` +
        `- Endereço IP (192.168.1.100)\n` +
        `- Email do usuário (admin@example.com)\n` +
        `- Senha (abc123)\n\n` +
        `O QUE O USUÁRIO VIU:\n` +
        `"${safe.userMessage}"\n\n` +
        `ID de rastreamento: ${safe.errorId}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🛡️ Demonstração do Sistema de Tratamento de Erros</CardTitle>
            <CardDescription>
              Este componente demonstra como o sistema protege informações sensíveis
              e exibe mensagens amigáveis aos usuários.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Botões de teste */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={simularErroRede}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Simular Erro de Rede
              </Button>

              <Button
                onClick={simularErroAuth}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Simular Erro de Autenticação
              </Button>

              <Button
                onClick={simularErroValidacao}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Simular Erro de Validação
              </Button>

              <Button
                onClick={simularErroSensivel}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Simular Erro com Dados Sensíveis
              </Button>

              <Button
                onClick={exemploManual}
                disabled={loading}
                variant="outline"
                className="w-full md:col-span-2"
              >
                Exemplo de Sanitização Manual
              </Button>
            </div>

            {/* Resultado */}
            {resultado && (
              <Card className="bg-gray-50 border-2">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {resultado.includes('✅') ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                    )}
                    Resultado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {resultado}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Erro atual (se houver) */}
            {error && (
              <Card className="bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="text-sm text-red-700">
                    Erro Sanitizado (Mensagem Segura)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-600 mb-2">
                    {error.userMessage}
                  </p>
                  {error.errorId && (
                    <p className="text-xs text-gray-500">
                      Código de referência: {error.errorId}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documentação */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm text-blue-700">
                  📚 Como Funciona
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-blue-900">
                <p>
                  <strong>1. Captura:</strong> Erros são capturados automaticamente
                  pelo hook <code>useApiCall</code> ou manualmente com <code>sanitizeError()</code>
                </p>
                <p>
                  <strong>2. Sanitização:</strong> Informações sensíveis são removidas
                  (URLs, IPs, tokens, stack traces, etc.)
                </p>
                <p>
                  <strong>3. Classificação:</strong> O tipo de erro é detectado
                  automaticamente (NETWORK, AUTH, VALIDATION, etc.)
                </p>
                <p>
                  <strong>4. Mensagem Amigável:</strong> Usuário vê uma mensagem clara
                  e apropriada para o tipo de erro
                </p>
                <p>
                  <strong>5. Rastreamento:</strong> ID único é gerado para facilitar
                  suporte técnico
                </p>
                <p>
                  <strong>6. Logs:</strong> Detalhes completos ficam apenas no console
                  do servidor (não visível ao usuário)
                </p>
              </CardContent>
            </Card>

            {/* Informações de segurança */}
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-sm text-green-700">
                  ✅ Informações Protegidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-green-900">
                <p>✅ URLs do sistema removidas</p>
                <p>✅ Endereços IP ocultados</p>
                <p>✅ Paths de arquivo sanitizados</p>
                <p>✅ Stack traces não expostos</p>
                <p>✅ Tokens e API keys removidos</p>
                <p>✅ Mensagens do banco de dados genéricas</p>
                <p>✅ Emails e senhas nunca exibidos</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Link para documentação */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 text-center">
              Para mais informações, consulte a{' '}
              <a 
                href="/SISTEMA_SEGURANCA_ERROS.md" 
                className="text-blue-600 hover:underline"
              >
                documentação completa
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
