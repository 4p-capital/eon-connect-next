"use client";

import { use } from "react";
import { AssinarTermoEntrega } from "@/components/AssinarTermoEntrega";

export default function AssinarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <AssinarTermoEntrega token={token} />;
}
