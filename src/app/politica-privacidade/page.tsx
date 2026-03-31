"use client";

import { useRouter } from "next/navigation";
import { PoliticaPrivacidade } from "@/components/PoliticaPrivacidade";

export default function PoliticaPrivacidadePage() {
  const router = useRouter();
  return <PoliticaPrivacidade onVoltar={() => router.back()} />;
}
