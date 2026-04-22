"use client";

import { AssinarTermoEntrega } from "@/components/AssinarTermoEntrega";

export default function AssinarPage({ params }: { params: { token: string } }) {
  return <AssinarTermoEntrega token={params.token} />;
}
