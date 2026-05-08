import type { Metadata, Viewport } from "next";
import { TotemErrorBoundary } from "@/components/TotemErrorBoundary";

export const metadata: Metadata = {
  title: "Totem — Recebimento Gran Santorini",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFFFFF",
};

export default function TotemLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#322D67]">
      <TotemErrorBoundary>{children}</TotemErrorBoundary>
    </div>
  );
}
