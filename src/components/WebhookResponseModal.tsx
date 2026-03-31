"use client";

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WebhookResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: number;
  response: string;
}

export function WebhookResponseModal({
  isOpen,
  onClose,
  status,
  response
}: WebhookResponseModalProps) {
  const isSuccess = status === 200;
  const isError = status >= 400;

  // Tentar extrair mensagem de erro do response
  let mensagem = response;
  try {
    const parsed = JSON.parse(response);
    if (parsed.error) {
      mensagem = parsed.error;
    } else if (parsed.message) {
      mensagem = parsed.message;
    } else if (parsed.mensagem) {
      mensagem = parsed.mensagem;
    }
  } catch (e) {
    // Se não for JSON, usa o texto direto
    mensagem = response;
  }

  // Garantir que mensagem é sempre uma string
  const mensagemStr = String(mensagem || '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isSuccess && (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <span>Documento Enviado</span>
              </>
            )}
            {isError && (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <span>Erro ao Enviar Documento</span>
              </>
            )}
            {!isSuccess && !isError && (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <span>Resposta do Webhook</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isSuccess
              ? "O documento foi criado e enviado com sucesso para o cliente."
              : isError
              ? "Ocorreu um erro ao tentar enviar o documento. Verifique os detalhes abaixo."
              : "Resposta recebida do webhook Make.com após tentativa de envio do documento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status HTTP:</span>
            <span
              className={`rounded px-2 py-1 text-sm ${
                isSuccess
                  ? "bg-green-100 text-green-700"
                  : isError
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Mensagem:</span>
            <div
              className={`rounded-lg border p-4 ${
                isSuccess
                  ? "border-green-200 bg-green-50"
                  : isError
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              {isSuccess ? (
                <p className="text-sm text-green-800">
                  Documento criado e enviado com sucesso!
                </p>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {mensagemStr}
                </p>
              )}
            </div>
          </div>

          {(mensagemStr.toLowerCase().includes('too large') || mensagemStr.toLowerCase().includes('muito grande')) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-sm text-blue-800">
                <strong>Dica:</strong> O payload esta muito grande.
              </p>
              <p className="text-xs text-blue-700">
                As imagens base64 foram removidas automaticamente do webhook para reduzir o tamanho.
                Use o endpoint <code className="rounded bg-blue-100 px-1 py-0.5">GET /assistencia-finalizada/:id</code>
                {' '}no n8n para buscar as fotos separadamente se necessario.
              </p>
            </div>
          )}

          {status >= 500 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="mb-2 text-sm text-orange-800">
                <strong>Possiveis causas do erro 500:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1 text-xs text-orange-700">
                <li>Cenario do Make.com esta pausado ou desativado</li>
                <li>Erro interno no cenario (modulo mal configurado)</li>
                <li>Servidor do Make.com temporariamente sobrecarregado</li>
                <li>Timeout no processamento (payload muito grande)</li>
              </ul>
              <p className="mt-3 text-xs text-orange-800">
                <strong>Solucoes sugeridas:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1 text-xs text-orange-700">
                <li>Verifique se o cenario esta <strong>ativo</strong> no Make.com</li>
                <li>Execute o cenario <strong>manualmente</strong> para testar</li>
                <li>Aguarde alguns minutos e tente novamente</li>
                <li>Se o erro persistir, recrie o webhook no Make.com</li>
              </ul>
            </div>
          )}

          {isError && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Ver detalhes tecnicos
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-muted p-2">
                {response}
              </pre>
            </details>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant={isSuccess ? "default" : "outline"}>
            {isSuccess ? "Entendi" : "Fechar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
