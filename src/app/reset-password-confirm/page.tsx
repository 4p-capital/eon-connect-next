"use client";

import { ResetPasswordConfirm } from "@/components/ResetPasswordConfirm";

export default function ResetPasswordConfirmPage() {
  return (
    <ResetPasswordConfirm
      onNavigateToLogin={() => {
        window.location.href = "/";
      }}
    />
  );
}
