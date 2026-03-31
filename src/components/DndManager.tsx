"use client";

import { createContext, useContext, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Contexto para garantir singleton
const DndContext = createContext<boolean>(false);

// Gerenciador global
let managerInstance: any = null;
let isInitialized = false;

export function DndManager({ children }: { children: React.ReactNode }) {
  const isDndActive = useContext(DndContext);
  const hasSetup = useRef(false);

  useEffect(() => {
    if (!hasSetup.current) {
      hasSetup.current = true;
      console.log('✅ DndManager inicializado');
    }

    return () => {
      console.log('🧹 DndManager cleanup');
    };
  }, []);

  // Se já existe um DndProvider ativo no contexto, não criar outro
  if (isDndActive) {
    console.warn('⚠️ DndProvider já existe no contexto, retornando children direto');
    return <>{children}</>;
  }

  // Criar provider apenas uma vez
  if (!isInitialized) {
    isInitialized = true;
    console.log('🎯 Criando DndProvider singleton');
  }

  return (
    <DndContext.Provider value={true}>
      <DndProvider backend={HTML5Backend}>
        {children}
      </DndProvider>
    </DndContext.Provider>
  );
}

export function useDndStatus() {
  return useContext(DndContext);
}
