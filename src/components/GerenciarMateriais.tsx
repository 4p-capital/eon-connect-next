"use client";

import { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Plus, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface GerenciarMateriaisProps {
  aberto: boolean;
  aoFechar?: () => void;
  aoAtualizar?: () => void;
  modoEmbutido?: boolean; // Modo embutido para usar como aba
}

export function GerenciarMateriais({ aberto, aoFechar, aoAtualizar, modoEmbutido = false }: GerenciarMateriaisProps) {
  const [materiais, setMateriais] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [materialEditando, setMaterialEditando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoMaterial, setNovoMaterial] = useState('');
  const [buscaMaterial, setBuscaMaterial] = useState('');
  const [mostrarModalAdicionar, setMostrarModalAdicionar] = useState(false);

  useEffect(() => {
    if (aberto) {
      carregarMateriais();
    }
  }, [aberto]);

  const carregarMateriais = async () => {
    setCarregando(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) throw new Error('Erro ao carregar materiais');

      const dados = await response.json();
      setMateriais(dados.data || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar lista de materiais');
    } finally {
      setCarregando(false);
    }
  };

  const adicionarMaterial = async () => {
    if (!novoMaterial.trim()) {
      toast.error('Digite o nome do material');
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ material: novoMaterial.trim() }),
        }
      );

      if (!response.ok) throw new Error('Erro ao adicionar material');

      toast.success('Material adicionado com sucesso');
      setNovoMaterial('');
      await carregarMateriais();
      aoAtualizar?.();
    } catch (error) {
      console.error('Erro ao adicionar material:', error);
      toast.error('Erro ao adicionar material');
    } finally {
      setCarregando(false);
    }
  };

  const atualizarMaterial = async (materialAntigo: string) => {
    if (!novoNome.trim()) {
      toast.error('Digite o novo nome do material');
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            materialAntigo, 
            materialNovo: novoNome.trim() 
          }),
        }
      );

      if (!response.ok) throw new Error('Erro ao atualizar material');

      toast.success('Material atualizado com sucesso');
      setMaterialEditando(null);
      setNovoNome('');
      await carregarMateriais();
      aoAtualizar?.();
    } catch (error) {
      console.error('Erro ao atualizar material:', error);
      toast.error('Erro ao atualizar material');
    } finally {
      setCarregando(false);
    }
  };

  const removerMaterial = async (material: string) => {
    if (!confirm(`Tem certeza que deseja remover "${material}"?`)) return;

    setCarregando(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ material }),
        }
      );

      if (!response.ok) throw new Error('Erro ao remover material');

      toast.success('Material removido com sucesso');
      await carregarMateriais();
      aoAtualizar?.();
    } catch (error) {
      console.error('Erro ao remover material:', error);
      toast.error('Erro ao remover material');
    } finally {
      setCarregando(false);
    }
  };

  const corrigirDuplicatas = async () => {
    if (!confirm('Deseja corrigir automaticamente as duplicatas encontradas?')) return;

    setCarregando(true);
    try {
      // 1. Renomear um dos "Interruptor" para "Disjuntor"
      const interruptores = materiais.filter(m => m === 'Interruptor');
      if (interruptores.length > 1) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              materialAntigo: 'Interruptor', 
              materialNovo: 'Disjuntor' 
            }),
          }
        );
      }

      // 2. Remover duplicatas de "Módulo USB"
      const modulosUSB = materiais.filter(m => m === 'Módulo USB');
      if (modulosUSB.length > 1) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ material: 'Módulo USB' }),
          }
        );
      }

      // 3. Remover duplicatas de "Tinta branco neve"
      const tintasBranco = materiais.filter(m => m === 'Tinta branco neve');
      if (tintasBranco.length > 1) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ material: 'Tinta branco neve' }),
          }
        );
      }

      toast.success('Duplicatas corrigidas com sucesso!');
      await carregarMateriais();
      aoAtualizar?.();
    } catch (error) {
      console.error('Erro ao corrigir duplicatas:', error);
      toast.error('Erro ao corrigir duplicatas');
    } finally {
      setCarregando(false);
    }
  };

  // Detectar duplicatas
  const duplicatas = materiais.filter((material, index) => 
    materiais.indexOf(material) !== index
  );

  // Filtrar materiais pela busca
  const materiaisFiltrados = materiais.filter(material =>
    material.toLowerCase().includes(buscaMaterial.toLowerCase())
  );

  if (!aberto) return null;

  // Modo embutido - renderiza sem modal
  if (modoEmbutido) {
    return (
      <>
        <div className="space-y-6">
          {/* Alerta de duplicatas */}
          {duplicatas.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-yellow-900">Duplicatas encontradas</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {duplicatas.length} material(is) duplicado(s) detectado(s)
                  </p>
                  <Button
                    onClick={corrigirDuplicatas}
                    disabled={carregando}
                    size="sm"
                    className="mt-3 bg-yellow-600 hover:bg-yellow-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Corrigir Automaticamente
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Adicionar novo material */}
          <div className="space-y-2">
            <Label>Adicionar Material</Label>
            <Button
              onClick={() => setMostrarModalAdicionar(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Novo Material
            </Button>
          </div>

          {/* Buscar materiais */}
          <div className="space-y-2">
            <Label>Buscar Material</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={buscaMaterial}
                onChange={(e) => setBuscaMaterial(e.target.value)}
                placeholder="Digite para buscar..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Lista de materiais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Materiais Cadastrados</Label>
              <span className="text-sm text-gray-500">
                {buscaMaterial ? `${materiaisFiltrados.length} de ${materiais.length}` : materiais.length}
              </span>
            </div>
            {carregando && materiais.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Carregando materiais...
              </div>
            ) : materiaisFiltrados.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border rounded-lg">
                {buscaMaterial ? 'Nenhum material encontrado' : 'Nenhum material cadastrado'}
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {materiaisFiltrados.map((material, index) => {
                  const isDuplicata = duplicatas.includes(material);
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 flex items-center justify-between ${
                        isDuplicata ? 'bg-yellow-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {materialEditando === material ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            placeholder="Novo nome"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') atualizarMaterial(material);
                              if (e.key === 'Escape') {
                                setMaterialEditando(null);
                                setNovoNome('');
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => atualizarMaterial(material)}
                            disabled={carregando}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMaterialEditando(null);
                              setNovoNome('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className={isDuplicata ? 'text-yellow-900 font-medium' : ''}>
                            {material}
                            {isDuplicata && (
                              <span className="ml-2 text-xs text-yellow-600">(duplicado)</span>
                            )}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setMaterialEditando(material);
                                setNovoNome(material);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                              disabled={carregando}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => removerMaterial(material)}
                              className="text-red-600 hover:text-red-700"
                              disabled={carregando}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal para adicionar material (modo embutido) */}
        {mostrarModalAdicionar && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Adicionar Novo Material</h3>
                <button
                  onClick={() => {
                    setMostrarModalAdicionar(false);
                    setNovoMaterial('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <Label>Nome do Material</Label>
                  <Input
                    value={novoMaterial}
                    onChange={(e) => setNovoMaterial(e.target.value)}
                    placeholder="Ex: Tomada, Interruptor, Tinta, etc."
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        adicionarMaterial();
                        setMostrarModalAdicionar(false);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMostrarModalAdicionar(false);
                    setNovoMaterial('');
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    adicionarMaterial();
                    setMostrarModalAdicionar(false);
                  }}
                  disabled={carregando || !novoMaterial.trim()}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Modo modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2>Gerenciar Materiais</h2>
          <button
            onClick={aoFechar}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alerta de duplicatas */}
          {duplicatas.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-yellow-900">Duplicatas encontradas</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {duplicatas.length} material(is) duplicado(s) detectado(s)
                  </p>
                  <Button
                    onClick={corrigirDuplicatas}
                    disabled={carregando}
                    size="sm"
                    className="mt-3 bg-yellow-600 hover:bg-yellow-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Corrigir Automaticamente
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Adicionar novo material */}
          <div className="space-y-2">
            <Label>Adicionar Material</Label>
            <Button
              onClick={() => setMostrarModalAdicionar(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Novo Material
            </Button>
          </div>

          {/* Buscar materiais */}
          <div className="space-y-2">
            <Label>Buscar Material</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={buscaMaterial}
                onChange={(e) => setBuscaMaterial(e.target.value)}
                placeholder="Digite para buscar..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Lista de materiais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Materiais Cadastrados</Label>
              <span className="text-sm text-gray-500">
                {buscaMaterial ? `${materiaisFiltrados.length} de ${materiais.length}` : materiais.length}
              </span>
            </div>
            {carregando && materiais.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Carregando materiais...
              </div>
            ) : materiaisFiltrados.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border rounded-lg">
                {buscaMaterial ? 'Nenhum material encontrado' : 'Nenhum material cadastrado'}
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {materiaisFiltrados.map((material, index) => {
                  const isDuplicata = duplicatas.includes(material);
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 flex items-center justify-between ${
                        isDuplicata ? 'bg-yellow-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {materialEditando === material ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            placeholder="Novo nome"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') atualizarMaterial(material);
                              if (e.key === 'Escape') {
                                setMaterialEditando(null);
                                setNovoNome('');
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => atualizarMaterial(material)}
                            disabled={carregando}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMaterialEditando(null);
                              setNovoNome('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className={isDuplicata ? 'text-yellow-900 font-medium' : ''}>
                            {material}
                            {isDuplicata && (
                              <span className="ml-2 text-xs text-yellow-600">(duplicado)</span>
                            )}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setMaterialEditando(material);
                                setNovoNome(material);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                              disabled={carregando}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => removerMaterial(material)}
                              className="text-red-600 hover:text-red-700"
                              disabled={carregando}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <Button onClick={aoFechar} variant="outline" className="w-full">
            Fechar
          </Button>
        </div>
      </div>

      {/* Modal para adicionar material */}
      {mostrarModalAdicionar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Adicionar Novo Material</h3>
              <button
                onClick={() => {
                  setMostrarModalAdicionar(false);
                  setNovoMaterial('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label>Nome do Material</Label>
                <Input
                  value={novoMaterial}
                  onChange={(e) => setNovoMaterial(e.target.value)}
                  placeholder="Ex: Tomada, Interruptor, Tinta, etc."
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      adicionarMaterial();
                      setMostrarModalAdicionar(false);
                    }
                  }}
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setMostrarModalAdicionar(false);
                  setNovoMaterial('');
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  adicionarMaterial();
                  setMostrarModalAdicionar(false);
                }}
                disabled={carregando || !novoMaterial.trim()}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}