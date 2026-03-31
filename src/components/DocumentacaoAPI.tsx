"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Book, 
  Code, 
  Copy, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp,
  Database,
  Send,
  Edit,
  Trash2,
  Eye,
  Key,
  Lock
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string; example?: any }[];
  response: any;
  notes?: string[];
}

export function DocumentacaoAPI() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const baseURL = `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d`;
  const authHeader = `Bearer ${publicAnonKey}`;

  const endpoints: Record<string, Endpoint[]> = {
    'Assistência Técnica': [
      {
        method: 'GET',
        path: '/assistencia',
        description: 'Lista todas as solicitações de assistência ativas e finalizadas',
        auth: true,
        response: [
          {
            id: 1,
            proprietario: 'João Silva',
            email: 'joao@email.com',
            telefone: '11999999999',
            status_chamado: 'Abertos',
            created_at: '2025-01-01T10:00:00Z'
          }
        ],
        notes: [
          'Retorna apenas assistências com situacao = "Ativo"',
          'Combina dados de assistências abertas e finalizadas',
          'Assistências finalizadas incluem dados da tabela assistencia_finalizada'
        ]
      },
      {
        method: 'GET',
        path: '/assistencia/:id',
        description: 'Busca uma solicitação específica por ID',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        response: {
          solicitacao: {
            id: 1,
            proprietario: 'João Silva',
            email: 'joao@email.com',
            status_chamado: 'Abertos'
          }
        }
      },
      {
        method: 'POST',
        path: '/assistencia',
        description: 'Cria uma nova solicitação de assistência técnica',
        auth: true,
        body: [
          { name: 'nome', type: 'string', required: true, description: 'Nome do proprietário', example: 'João Silva' },
          { name: 'email', type: 'string', required: true, description: 'Email do proprietário', example: 'joao@email.com' },
          { name: 'cpf', type: 'string', required: true, description: 'CPF do proprietário', example: '000.000.000-00' },
          { name: 'celular', type: 'string', required: true, description: 'Telefone do proprietário', example: '11999999999' },
          { name: 'bloco', type: 'string', required: true, description: 'Bloco do imóvel', example: 'A' },
          { name: 'apartamento', type: 'string', required: true, description: 'Número do apartamento', example: '101' },
          { name: 'empreendimento', type: 'string', required: true, description: 'Nome do empreendimento', example: 'Residencial ABC' },
          { name: 'categoria', type: 'string', required: true, description: 'Categoria do reparo', example: 'Elétrica' },
          { name: 'descricao', type: 'string', required: true, description: 'Descrição do problema', example: 'Tomada não funciona' },
          { name: 'foto_base64', type: 'string', required: true, description: 'Foto em base64', example: 'data:image/jpeg;base64,...' },
          { name: 'idempresa', type: 'number', required: false, description: 'ID da empresa', example: 1 },
          { name: 'situacao', type: 'string', required: false, description: 'Situação inicial', example: 'Ativo' }
        ],
        response: {
          success: true,
          message: 'Solicitação registrada com sucesso',
          id: 1
        },
        notes: [
          'Define automaticamente status_chamado = "Abertos"',
          'Define automaticamente situacao = "Ativo" se não informado',
          'Envia notificação automática via WhatsApp ao cliente'
        ]
      },
      {
        method: 'PATCH',
        path: '/assistencia/:id',
        description: 'Atualiza dados de uma assistência (status, datas)',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        body: [
          { name: 'status_chamado', type: 'string', required: false, description: 'Novo status', example: 'Vistoria agendada' },
          { name: 'data_vistoria', type: 'string', required: false, description: 'Data da vistoria', example: '2025-01-15T14:00:00Z' },
          { name: 'data_reparo', type: 'string', required: false, description: 'Data do reparo', example: '2025-01-20T09:00:00Z' }
        ],
        response: {
          success: true,
          message: 'Solicitação atualizada com sucesso',
          solicitacao: { id: 1, status_chamado: 'Vistoria agendada' }
        }
      },
      {
        method: 'PATCH',
        path: '/assistencia/:id/status',
        description: 'Atualiza apenas o status de uma assistência',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        body: [
          { name: 'status_chamado', type: 'string', required: true, description: 'Novo status', example: 'Reparo agendado' }
        ],
        response: {
          success: true,
          message: 'Status atualizado com sucesso',
          solicitacao: { id: 1, status_chamado: 'Reparo agendado' }
        },
        notes: [
          'Envia notificação automática se o status mudar',
          'Mapeia status para eventos de notificação'
        ]
      },
      {
        method: 'PATCH',
        path: '/assistencia/:id/desqualificar',
        description: 'Desqualifica uma assistência (remove do Kanban)',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        response: {
          success: true,
          message: 'Assistência desqualificada com sucesso',
          data: { id: 1, situacao: 'Desqualificado' }
        },
        notes: [
          'Altera situacao de "Ativo" para "Desqualificado"',
          'Assistência desqualificada não aparece no Kanban',
          'Pode ser reativada com /reativar'
        ]
      },
      {
        method: 'PATCH',
        path: '/assistencia/:id/reativar',
        description: 'Reativa uma assistência desqualificada',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        response: {
          success: true,
          message: 'Assistência reativada com sucesso',
          data: { id: 1, situacao: 'Ativo' }
        },
        notes: [
          'Altera situacao de "Desqualificado" para "Ativo"',
          'Assistência volta a aparecer no Kanban no status anterior'
        ]
      },
      {
        method: 'GET',
        path: '/assistencias-historico',
        description: 'Lista histórico de assistências finalizadas e desqualificadas',
        auth: true,
        response: {
          success: true,
          historico: [
            {
              id: 1,
              tipo: 'Finalizado',
              status: 'Finalizado',
              created_at: '2025-01-01T10:00:00Z',
              assistencia: { proprietario: 'João Silva' }
            }
          ],
          total: 10,
          finalizados: 7,
          desqualificados: 3
        }
      }
    ],
    'Assistência Finalizada': [
      {
        method: 'POST',
        path: '/assistencia-finalizada/:id',
        description: 'Finaliza uma assistência e move para aguardando assinatura',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        body: [
          { name: 'responsaveis', type: 'array', required: true, description: 'Lista de responsáveis', example: ['João', 'Maria'] },
          { name: 'itens_reparo', type: 'array', required: true, description: 'Itens utilizados no reparo', example: [{ material: 'Tomada', quantidade: '2', unidade: 'un' }] },
          { name: 'providencias', type: 'string', required: true, description: 'Providências tomadas', example: 'Troca de tomadas danificadas' },
          { name: 'foto_reparo', type: 'string', required: true, description: 'Foto do reparo em base64', example: 'data:image/jpeg;base64,...' },
          { name: 'nps', type: 'number', required: true, description: 'Nota de satisfação (1-10)', example: 10 }
        ],
        response: {
          success: true,
          message: 'Assistência finalizada com sucesso',
          data: { id: 1, status: 'Aguardando assinatura' }
        },
        notes: [
          'Insere dados na tabela assistencia_finalizada',
          'Insere itens em assistencia_finalizada_itens',
          'Atualiza status_chamado para "Aguardando assinatura"',
          'Envia notificação automática ao cliente',
          'Envia dados ao webhook Make.com'
        ]
      },
      {
        method: 'GET',
        path: '/assistencia-finalizada/:id',
        description: 'Busca dados de finalização de uma assistência',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica' }
        ],
        response: {
          success: true,
          data: {
            id: 1,
            id_assistencia: 1,
            responsaveis: ['João', 'Maria'],
            providencias: 'Troca de tomadas',
            foto_reparo: 'base64...',
            status: 'Aguardando assinatura',
            nps: 10,
            itens_reparo: [
              { material: 'Tomada', quantidade: '2', unidade: 'un' }
            ]
          }
        },
        notes: [
          'Retorna o registro mais recente se houver múltiplos',
          'Combina dados de assistencia_finalizada e assistencia_finalizada_itens'
        ]
      },
      {
        method: 'PATCH',
        path: '/assistencia-finalizada/:id',
        description: '✅ Atualiza status e flags de controle da assistência finalizada',
        auth: true,
        params: [
          { name: 'id', type: 'number', required: true, description: 'ID da assistência técnica (não o ID da tabela assistencia_finalizada)' }
        ],
        body: [
          { name: 'status', type: 'string', required: false, description: 'Novo status', example: 'Finalizado' },
          { name: 'termo_assinado', type: 'boolean', required: false, description: 'Flag se termo foi assinado', example: true },
          { name: 'reparo_avaliado', type: 'boolean', required: false, description: 'Flag se reparo foi avaliado', example: true }
        ],
        response: {
          success: true,
          message: 'Registro atualizado com sucesso',
          data: {
            id: 1,
            id_assistencia: 123,
            campos_atualizados: {
              status: {
                anterior: 'Aguardando assinatura',
                novo: 'Finalizado'
              },
              termo_assinado: {
                anterior: false,
                novo: true
              },
              reparo_avaliado: {
                anterior: false,
                novo: true
              }
            }
          }
        },
        notes: [
          '✅ ENDPOINT FLEXÍVEL - Atualiza status, termo_assinado e/ou reparo_avaliado',
          'Use o ID da assistência técnica (não o ID da tabela assistencia_finalizada)',
          'Busca automaticamente o registro mais recente de assistencia_finalizada',
          'Você pode enviar apenas os campos que deseja atualizar',
          'Retorna valores anteriores e novos para cada campo atualizado',
          'Valida se o registro de finalização existe antes de atualizar',
          'Logs detalhados para debugging de cada campo'
        ]
      },
      {
        method: 'POST',
        path: '/webhook/clicksign',
        description: '🎯 WEBHOOK AUTOMÁTICO CLICKSIGN - Processa eventos de assinatura',
        auth: true,
        body: [
          { name: 'document.id_externa', type: 'string', required: true, description: 'ID da assistência (enviado ao criar documento)', example: '123' },
          { name: 'event.name', type: 'string', required: false, description: 'Nome do evento', example: 'signed' },
          { name: 'status', type: 'string', required: false, description: 'Status do documento', example: 'finished' }
        ],
        response: {
          success: true,
          message: 'Status atualizado com sucesso via webhook Clicksign',
          data: {
            id: 1,
            id_assistencia: 123,
            status_anterior: 'Aguardando assinatura',
            status_novo: 'Finalizado',
            evento: 'signed'
          }
        },
        notes: [
          '🎯 ENDPOINT RECOMENDADO - Use este no webhook do Clicksign!',
          'Detecta automaticamente o ID da assistência de vários campos possíveis',
          'Loga todos os dados recebidos para debugging',
          'Só atualiza status em eventos de finalização (signed, finished, closed)',
          'Ignora eventos intermediários (opened, viewed, etc)',
          'Não atualiza se status já for "Finalizado"',
          'Configure este endpoint no painel do Clicksign como webhook URL'
        ]
      },
      {
        method: 'POST',
        path: '/webhook/makecom',
        description: '🌐 PROXY WEBHOOK MAKE.COM - Envia dados ao Make.com sem problemas de CORS',
        auth: true,
        body: [
          { name: 'webhookUrl', type: 'string', required: true, description: 'URL do webhook Make.com', example: 'https://hook.us1.make.com/...' },
          { name: 'data', type: 'object', required: true, description: 'Dados a serem enviados', example: { id: 123, nome: 'Teste' } }
        ],
        response: {
          success: true,
          message: 'Webhook enviado com sucesso',
          status: 200,
          response: 'Accepted'
        },
        notes: [
          '🌐 PROXY PARA EVITAR CORS - Envia requisições pelo servidor',
          'Use este endpoint no frontend ao invés de chamar Make.com diretamente',
          'O servidor faz a requisição ao Make.com sem restrições de CORS',
          'Retorna status e resposta do Make.com',
          'Timeout de 30 segundos',
          '⚠️ LIMITE: Make.com aceita até ~500KB de payload',
          '⚠️ IMAGENS: Fotos base64 NÃO são enviadas (use endpoint GET para buscar)',
          'Webhook envia apenas metadados: tem_foto, foto_info e endpoint_foto',
          'Para obter a foto: GET /assistencia-finalizada/{id}',
          '',
          '🧹 SANITIZAÇÃO AUTOMÁTICA:',
          '• Pontos finais (.) removidos de "descricao_cliente" e "providencias"',
          '• ClickSign rejeita campos com pontos finais no módulo "Create Document"',
          '• Campos null/undefined são removidos automaticamente',
          '',
          '🔄 RETRY AUTOMÁTICO: 3 tentativas com 3 segundos de intervalo em caso de erro 500',
          '',
          '🔍 TROUBLESHOOTING ERRO 500:',
          '• Verifique se o cenário está ATIVO no Make.com',
          '• Execute o cenário manualmente para testar',
          '• Verifique se há erros nos módulos do cenário',
          '• Aguarde alguns minutos (servidor pode estar sobrecarregado)',
          '• Se persistir, recrie o webhook no Make.com'
        ]
      }
    ]
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(label);
    toast.success('Copiado para área de transferência!');
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const toggleExpand = (key: string) => {
    setExpandedEndpoint(expandedEndpoint === key ? null : key);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-500';
      case 'POST': return 'bg-green-500';
      case 'PATCH': return 'bg-yellow-500';
      case 'DELETE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'GET': return Eye;
      case 'POST': return Send;
      case 'PATCH': return Edit;
      case 'DELETE': return Trash2;
      default: return Code;
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900 flex items-center gap-3">
            <Book className="h-8 w-8 text-gray-900" />
            Documentação da API
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Endpoints completos do EON Connect - Sistema de Assistência Técnica
          </p>
        </div>
      </div>

      {/* Informações de Autenticação */}
      <Card className="border-2 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-yellow-600" />
            Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 mb-2">Todos os endpoints requerem autenticação via header:</p>
            <div className="bg-white rounded-lg p-3 border border-yellow-200 flex items-center justify-between">
              <code className="text-sm text-gray-800">Authorization: Bearer {publicAnonKey}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(authHeader, 'auth')}
              >
                {copiedEndpoint === 'auth' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mb-2">URL Base:</p>
            <div className="bg-white rounded-lg p-3 border border-yellow-200 flex items-center justify-between">
              <code className="text-sm text-gray-800">{baseURL}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(baseURL, 'baseurl')}
              >
                {copiedEndpoint === 'baseurl' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      {Object.entries(endpoints).map(([category, categoryEndpoints]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-900" />
              {category}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryEndpoints.map((endpoint, idx) => {
              const key = `${category}-${idx}`;
              const isExpanded = expandedEndpoint === key;
              const Icon = getMethodIcon(endpoint.method);
              const fullURL = `${baseURL}${endpoint.path}`;

              return (
                <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header do Endpoint */}
                  <div
                    className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleExpand(key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Badge className={`${getMethodColor(endpoint.method)} text-white px-3 py-1`}>
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm text-gray-700 flex-1">{endpoint.path}</code>
                        {endpoint.path.includes('/webhook/clicksign') && (
                          <Badge className="bg-black text-white">🎯 RECOMENDADO</Badge>
                        )}
                        {endpoint.path.includes('assistencia-finalizada/:id') && endpoint.method === 'PATCH' && (
                          <Badge className="bg-black text-white">WEBHOOK CLICKSIGN</Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{endpoint.description}</p>
                  </div>

                  {/* Detalhes do Endpoint */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* URL Completa */}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">URL Completa:</p>
                        <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
                          <code className="text-sm text-green-400">{fullURL}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:text-green-400"
                            onClick={() => copyToClipboard(fullURL, key)}
                          >
                            {copiedEndpoint === key ? (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Parâmetros de URL */}
                      {endpoint.params && endpoint.params.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Parâmetros de URL:</p>
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {endpoint.params.map((param, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <Badge variant={param.required ? 'destructive' : 'secondary'}>
                                  {param.required ? 'Obrigatório' : 'Opcional'}
                                </Badge>
                                <div>
                                  <code className="text-sm text-gray-800">{param.name}</code>
                                  <span className="text-sm text-gray-500"> ({param.type})</span>
                                  <p className="text-sm text-gray-600 mt-1">{param.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Body */}
                      {endpoint.body && endpoint.body.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Body (JSON):</p>
                          <div className="bg-gray-900 rounded-lg p-3">
                            <pre className="text-sm text-green-400 overflow-x-auto">
{JSON.stringify(
  endpoint.body.reduce((acc, field) => {
    acc[field.name] = field.example || `<${field.type}>`;
    return acc;
  }, {} as Record<string, any>),
  null,
  2
)}
                            </pre>
                          </div>
                          <div className="mt-2 space-y-2">
                            {endpoint.body.map((field, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <Badge variant={field.required ? 'destructive' : 'secondary'} className="mt-0.5">
                                  {field.required ? 'Obrigatório' : 'Opcional'}
                                </Badge>
                                <div>
                                  <code className="text-gray-800">{field.name}</code>
                                  <span className="text-gray-500"> ({field.type})</span>
                                  <p className="text-gray-600 mt-1">{field.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response */}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Resposta (JSON):</p>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <pre className="text-sm text-green-400 overflow-x-auto">
                            {JSON.stringify(endpoint.response, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Notas */}
                      {endpoint.notes && endpoint.notes.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Observações:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                            {endpoint.notes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Exemplo Webhook Clicksign */}
      <Card className="border-2 border-gray-200 bg-gray-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Key className="h-5 w-5" />
            Exemplo de Integração - Webhook Clicksign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-700">
            Quando o Clicksign enviar um evento de documento assinado, use este código para atualizar o status:
          </p>
          
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-sm text-green-400 overflow-x-auto">
{`// No seu webhook Clicksign (n8n, Make.com, etc):
const id_assistencia = 123; // ID recebido do evento

// Exemplo 1: Atualizar apenas status
await fetch('${baseURL}/assistencia-finalizada/' + id_assistencia, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${publicAnonKey}'
  },
  body: JSON.stringify({
    status: 'Finalizado'
  })
});

// Exemplo 2: Atualizar status + termo_assinado
await fetch('${baseURL}/assistencia-finalizada/' + id_assistencia, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${publicAnonKey}'
  },
  body: JSON.stringify({
    status: 'Finalizado',
    termo_assinado: true
  })
});

// Exemplo 3: Atualizar todas as flags
await fetch('${baseURL}/assistencia-finalizada/' + id_assistencia, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${publicAnonKey}'
  },
  body: JSON.stringify({
    status: 'Finalizado',
    termo_assinado: true,
    reparo_avaliado: true
  })
});`}
            </pre>
          </div>

          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-sm text-gray-900 mb-2">🎯 Fluxo Completo:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Técnico finaliza chamado no sistema → Status: "Aguardando assinatura"</li>
              <li>Sistema envia documento para o Clicksign via Make.com</li>
              <li>Cliente assina documento no Clicksign</li>
              <li>Clicksign dispara webhook → n8n recebe evento</li>
              <li>n8n chama PATCH /assistencia-finalizada/:id com:</li>
              <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5">
                <li>status: "Finalizado"</li>
                <li>termo_assinado: true</li>
                <li>reparo_avaliado: true (opcional)</li>
              </ul>
              <li>Sistema atualiza registro → Chamado movido para "Histórico" ✅</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}