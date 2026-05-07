"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// ErrorBoundary local do totem — substitui o ErrorBoundary global (que tem
// fundo claro) por uma tela amigável no estilo kiosque dark, com botão de
// recarregar. Mantém o totem em modo cheio mesmo se algo escapar do try/catch.
export class TotemErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("TotemErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-8 bg-slate-950 text-white">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-rose-500/20 mb-6">
              <AlertTriangle className="w-12 h-12 text-rose-400" />
            </div>
            <h2 className="text-3xl font-semibold mb-3">Algo deu errado</h2>
            <p className="text-slate-400 mb-8">
              Recarregue para voltar à tela inicial. Se o problema persistir,
              chame um operador.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-lg font-semibold transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
