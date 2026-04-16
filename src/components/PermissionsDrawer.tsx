"use client";

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  PERMISSION_TREE,
  type PermissionTreeNode,
  type UserPermissions,
  hasPermission,
  setPermission,
} from '@/lib/permissions';

interface PermissionsDrawerProps {
  open: boolean;
  userName: string;
  initialPermissions: UserPermissions;
  saving: boolean;
  onClose: () => void;
  onSave: (permissions: UserPermissions) => void | Promise<void>;
}

/**
 * Constrói o path (dot-notation) acumulando ancestrais.
 */
function buildPath(ancestors: string[], key: string): string {
  return [...ancestors, key].join('.');
}

export function PermissionsDrawer({
  open,
  userName,
  initialPermissions,
  saving,
  onClose,
  onSave,
}: PermissionsDrawerProps) {
  const [draft, setDraft] = useState<UserPermissions>(initialPermissions ?? {});

  useEffect(() => {
    if (open) {
      setDraft(initialPermissions ?? {});
    }
  }, [open, initialPermissions]);

  if (!open) return null;

  const toggle = (path: string, next: boolean) => {
    setDraft((prev) => setPermission(prev, path, next));
  };

  const renderNode = (node: PermissionTreeNode, ancestors: string[], depth: number) => {
    const path = buildPath(ancestors, node.key);
    const checked = hasPermission(draft, path);
    const hasChildren = !!node.children && node.children.length > 0;

    // Ancestor chain precisa estar true para filhos ficarem editáveis
    const parentPath = ancestors.join('.');
    const parentEnabled = ancestors.length === 0 || hasPermission(draft, parentPath);
    const disabled = !parentEnabled;

    return (
      <div key={path} className="select-none">
        <label
          className={`flex items-center gap-3 py-2 px-2 rounded-md transition-colors ${
            disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => toggle(path, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black disabled:opacity-50"
          />
          <span className={`text-sm ${hasChildren ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
            {node.label}
          </span>
        </label>
        {hasChildren && (
          <div>
            {node.children!.map((child) =>
              renderNode(child, [...ancestors, node.key], depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative ml-auto h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Permissões</h2>
            <p className="text-sm text-gray-500 truncate">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {PERMISSION_TREE.map((node) => renderNode(node, [], 0))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
