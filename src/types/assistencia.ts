/**
 * Tipos compartilhados para o módulo de Assistência Técnica
 */

export interface Solicitacao {
  id: number | string;
  id_assistencia_original?: number;
  proprietario: string;
  email: string;
  cpf: string;
  telefone: string;
  bloco: string;
  unidade: string;
  empreendimento: string;
  descricao_cliente: string;
  categoria_reparo: string;
  url_foto: string | null;
  tem_foto: boolean;
  status_chamado: string;
  created_at: string;
  data_vistoria: string | null;
  data_reparo: string | null;
  idempresa: number | null;
  empresa_nome: string | null;
  situacao?: string;
  // Campos para assistências finalizadas
  id_finalizacao?: number;
  responsaveis?: string[];
  providencias?: string;
  nps?: number | null;
  foto_reparo?: string;
  data_finalizacao?: string;
  created_at_finalizacao?: string;
  // Campos de análise GPT
  gpt_classificacao?: "Moderado" | "Médio" | "Crítico" | null;
  gpt_analise?: string | null;
  // Campos do termo de assistência
  termo_id?: number | null;
  termo_pdf_path?: string | null;
  enviado_sienge?: boolean;
  data_envio_sienge?: string | null;
}

export interface ColunaKanban {
  id: string;
  titulo: string;
  cor: string;
  corClara: string;
  corTexto: string;
  corBadge: string;
  corTextoBadge: string;
}

export const COLUNAS_KANBAN: ColunaKanban[] = [
  {
    id: "Abertos",
    titulo: "Abertos",
    cor: "bg-gray-900",
    corClara: "bg-gray-100",
    corTexto: "text-gray-900",
    corBadge: "bg-gray-900",
    corTextoBadge: "text-white",
  },
  {
    id: "Vistoria agendada",
    titulo: "Vistoria agendada",
    cor: "bg-gray-700",
    corClara: "bg-gray-100",
    corTexto: "text-gray-700",
    corBadge: "bg-gray-700",
    corTextoBadge: "text-white",
  },
  {
    id: "Reparo agendado",
    titulo: "Reparo agendado",
    cor: "bg-gray-600",
    corClara: "bg-gray-100",
    corTexto: "text-gray-600",
    corBadge: "bg-gray-600",
    corTextoBadge: "text-white",
  },
  {
    id: "Aguardando assinatura",
    titulo: "Aguardando assinatura",
    cor: "bg-gray-500",
    corClara: "bg-gray-100",
    corTexto: "text-gray-500",
    corBadge: "bg-gray-500",
    corTextoBadge: "text-white",
  },
];

export interface InsumosUtilizado {
  insumo_id: number;
  nome: string;
  quantidade: number;
  unidade_medida: string;
  [key: string]: unknown;
}

export interface UserData {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  menu_assistencia: boolean;
  menu_gerenciamento: boolean;
  menu_planejamento: boolean;
  menu_cadastro: boolean;
  menu_notificacoes: boolean;
}
