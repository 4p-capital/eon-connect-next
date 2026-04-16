// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PermissionNode = boolean | { view?: boolean; [k: string]: any };

export type UserPermissions = {
  assistencia?: {
    view?: boolean;
    gerenciar?: boolean;
    whatsapp?: boolean;
    termos?: boolean;
  };
  cadastros?: {
    view?: boolean;
    cadastros?: boolean;
    clientes?: boolean;
  };
  notificacoes?: {
    view?: boolean;
    pedidos?: boolean;
    historico_fornecedores?: boolean;
    historico_grupos?: boolean;
    grupos?: boolean;
  };
  gerenciamento?: { view?: boolean };
  planejamento?: { view?: boolean };
  entregas?: {
    view?: boolean;
    santorini?: {
      view?: boolean;
      pendencias?: boolean;
      agendamentos?: boolean;
    };
  };
};

export const EMPTY_PERMISSIONS: UserPermissions = {};

/**
 * Verifica permissão via dot-notation, validando a cadeia de `view` até o alvo.
 *
 * - `hasPermission(p, 'entregas')` → `p.entregas.view === true`
 * - `hasPermission(p, 'entregas.santorini')` → entregas.view && santorini.view
 * - `hasPermission(p, 'entregas.santorini.pendencias')` → os dois views + leaf === true
 */
export function hasPermission(
  permissions: UserPermissions | null | undefined,
  path: string,
): boolean {
  if (!permissions) return false;
  const segments = path.split('.');
  let node: PermissionNode | undefined = permissions as PermissionNode;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    if (node === undefined || node === null || typeof node === 'boolean') {
      return false;
    }

    const next: PermissionNode | undefined = (node as Record<string, PermissionNode>)[seg];

    if (isLast) {
      if (typeof next === 'boolean') return next;
      if (next && typeof next === 'object') return (next as { view?: boolean }).view === true;
      return false;
    }

    if (!next || typeof next !== 'object') return false;
    if ((next as { view?: boolean }).view !== true) return false;
    node = next;
  }

  return false;
}

/**
 * Estrutura em árvore que descreve todos os menus/submenus/funcionalidades
 * disponíveis no sistema. Usada pela UI de Gerenciamento para renderizar
 * a árvore de checkboxes.
 */
export type PermissionTreeNode = {
  key: string;
  label: string;
  children?: PermissionTreeNode[];
};

export const PERMISSION_TREE: PermissionTreeNode[] = [
  {
    key: 'assistencia',
    label: 'Assistência',
    children: [
      { key: 'gerenciar', label: 'Gerenciar' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'termos', label: 'Termos' },
    ],
  },
  {
    key: 'cadastros',
    label: 'Cadastros',
    children: [
      { key: 'cadastros', label: 'Cadastros' },
      { key: 'clientes', label: 'Clientes' },
    ],
  },
  {
    key: 'notificacoes',
    label: 'Notificações',
    children: [
      { key: 'pedidos', label: 'Pedidos' },
      { key: 'historico_fornecedores', label: 'Histórico Fornecedores' },
      { key: 'historico_grupos', label: 'Histórico Grupos' },
      { key: 'grupos', label: 'Cadastro de Grupos' },
    ],
  },
  { key: 'gerenciamento', label: 'Gerenciamento' },
  { key: 'planejamento', label: 'Planejamento' },
  {
    key: 'entregas',
    label: 'Entregas de Chaves',
    children: [
      {
        key: 'santorini',
        label: 'Gran Santorini',
        children: [
          { key: 'pendencias', label: 'Pendências' },
          { key: 'agendamentos', label: 'Agendamentos' },
        ],
      },
    ],
  },
];

/**
 * Retorna uma estrutura vazia com todos os nós como false.
 * Usada quando um novo usuário é criado ou quando o campo vem null.
 */
export function buildEmptyPermissions(): UserPermissions {
  const build = (nodes: PermissionTreeNode[]): Record<string, PermissionNode> => {
    const out: Record<string, PermissionNode> = {};
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        out[n.key] = { view: false, ...build(n.children) };
      } else {
        out[n.key] = { view: false };
      }
    }
    return out;
  };
  return build(PERMISSION_TREE) as UserPermissions;
}

/**
 * Atualiza uma chave em dot-notation num objeto permissions imutável.
 */
export function setPermission(
  permissions: UserPermissions,
  path: string,
  value: boolean,
): UserPermissions {
  const segments = path.split('.');
  const clone = JSON.parse(JSON.stringify(permissions ?? {}));

  let cursor: Record<string, PermissionNode> = clone;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    if (isLast) {
      const existing = cursor[seg];
      if (existing && typeof existing === 'object') {
        (existing as { view?: boolean }).view = value;
      } else {
        cursor[seg] = value;
      }
      break;
    }

    if (!cursor[seg] || typeof cursor[seg] !== 'object') {
      cursor[seg] = { view: false };
    }
    cursor = cursor[seg] as Record<string, PermissionNode>;
  }

  return clone;
}
