"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export function DndProviderSingleton({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DndProvider backend={HTML5Backend} key="dnd-singleton-stable">
      {children}
    </DndProvider>
  );
}
