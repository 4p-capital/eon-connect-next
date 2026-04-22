"use client";

import { use } from "react";
import { VistoriaEntrega } from "@/components/VistoriaEntrega";

export default function VistoriaEntregaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <VistoriaEntrega vistoriaId={id} />;
}
