"use client";

import { useState, useEffect } from 'react';
import { Plus, Package, Edit2, Trash2, Search } from 'lucide-react';
import { publicAnonKey, apiBaseUrl } from "@/utils/supabase/info";
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Insumo {
  id: string;
  nome: string;
  medida: string;
  quantidade: number;
  created_at: string;
}

export function InsumosView() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  
  // Campos do formulário
  const [nome, setNome] = useState('');
  const [medida, setMedida] = useState('');
  const [quantidade, setQuantidade] = useState('');

  const unidadesMedida = [
    'Metro', 'm2', 'm3 (Metros cúbicos)', 'Litro', 'Mililitro', 'Unidade', 'Saco', 'Lata', 'Caixa', 
    'Grama', 'Balde', 'Quilograma', 'Pacote', 'Centímetro', 'Milímetro'
  ];

  useEffect(() => {
    carregarInsumos();
  }, []);

  const carregarInsumos = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/insumos`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) throw new Error('Erro ao carregar insumos');

      const data = await response.json();
      setInsumos(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar insumos');
    } finally {
      setLoading(false);
    }
  };

  const abrirDialog = (insumo?: Insumo) => {
    if (insumo) {
      setEditingInsumo(insumo);
      setNome(insumo.nome || '');
      setMedida(insumo.medida || '');
      setQuantidade(insumo.quantidade != null ? insumo.quantidade.toString() : '0');
    } else {
      setEditingInsumo(null);
      setNome('');
      setMedida('');
      setQuantidade('');
    }
    setShowDialog(true);
  };

  const fecharDialog = () => {
    setShowDialog(false);
    setEditingInsumo(null);
    setNome('');
    setMedida('');
    setQuantidade('');
  };

  const salvarInsumo = async () => {
    if (!nome.trim() || !medida || !quantidade) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const url = editingInsumo
        ? `${apiBaseUrl}/insumos/${editingInsumo.id}`
        : `${apiBaseUrl}/insumos`;

      const response = await fetch(url, {
        method: editingInsumo ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          medida,
          quantidade: parseFloat(quantidade),
        }),
      });

      if (!response.ok) throw new Error('Erro ao salvar insumo');

      toast.success(editingInsumo ? 'Insumo atualizado!' : 'Insumo cadastrado!');
      fecharDialog();
      carregarInsumos();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar insumo');
    }
  };

  const excluirInsumo = async (id: string) => {
    if (!confirm('Deseja realmente excluir este insumo?')) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/insumos/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) throw new Error('Erro ao excluir insumo');

      toast.success('Insumo excluído!');
      carregarInsumos();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao excluir insumo');
    }
  };

  const insumosFiltrados = insumos.filter((insumo) =>
    insumo.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando insumos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Insumos</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie o catálogo de insumos disponíveis
          </p>
        </div>
        <Button
          onClick={() => abrirDialog()}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Insumo
        </Button>
      </div>

      {/* Barra de Pesquisa */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar insumo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Medida
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantidade
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {insumosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {searchTerm ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
                  </p>
                </td>
              </tr>
            ) : (
              insumosFiltrados.map((insumo) => (
                <tr key={insumo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Package className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="font-medium text-gray-900">{insumo.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{insumo.medida}</td>
                  <td className="px-6 py-4 text-gray-700">{insumo.quantidade}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirDialog(insumo)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => excluirInsumo(insumo.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
            </DialogTitle>
            <DialogDescription>
              {editingInsumo
                ? 'Atualize as informações do insumo'
                : 'Cadastre um novo insumo no sistema'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Insumo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cimento Portland"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medida">Unidade de Medida *</Label>
              <select
                id="medida"
                value={medida}
                onChange={(e) => setMedida(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded-md focus:border-purple-500 focus:ring-purple-500 bg-white"
              >
                <option value="">Selecione...</option>
                {unidadesMedida.map((unidade) => (
                  <option key={unidade} value={unidade}>
                    {unidade}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={fecharDialog}>
              Cancelar
            </Button>
            <Button
              onClick={salvarInsumo}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {editingInsumo ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}