"use client";

import { VistoriaEntrega } from "@/components/VistoriaEntrega";

export default function VistoriaEntregaPage({
  params,
}: {
  params: { id: string };
}) {
  return <VistoriaEntrega vistoriaId={params.id} />;
}
