"use client";

import { Search, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Search className="h-8 w-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Pagina nao encontrada
        </h1>
        <p className="text-gray-500 mb-8">
          A pagina que voce esta procurando nao existe ou foi movida.
        </p>
        <Button onClick={() => router.push("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao inicio
        </Button>
      </div>
    </div>
  );
}
