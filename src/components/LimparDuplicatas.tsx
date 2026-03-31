"use client";

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function LimparDuplicatas() {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const limparDuplicatas = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/materiais/limpar-duplicatas`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao limpar duplicatas');
      }

      const data = await response.json();
      
      if (data.duplicatas_removidas > 0) {
        toast.success(`${data.duplicatas_removidas} duplicatas removidas!`);
      } else {
        toast.info('Nenhuma duplicata encontrada');
      }
      
      setShowDialog(false);
      
      // Recarregar a página após 1 segundo para atualizar a lista
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao limpar duplicatas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        variant="outline"
        className="border-orange-300 text-orange-600 hover:bg-orange-50"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Limpar Duplicatas
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Limpar Materiais Duplicados
            </DialogTitle>
            <DialogDescription>
              Esta ação irá remover todos os registros duplicados da tabela de materiais,
              mantendo apenas a primeira ocorrência de cada material.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 my-4">
            <p className="text-sm text-orange-800">
              <strong>⚠️ Atenção:</strong> Esta operação não pode ser desfeita.
              Use apenas se houver duplicatas no banco de dados.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={limparDuplicatas}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Duplicatas
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
