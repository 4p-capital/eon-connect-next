"use client";

import { InsumosView } from './InsumosView';

export function Cadastros() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 px-6 py-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-black">
            <span className="text-sm font-medium">Insumos</span>
          </div>
        </div>
      </div>

      {/* Conteudo */}
      <div className="max-w-[1920px] mx-auto">
        <InsumosView />
      </div>
    </div>
  );
}
