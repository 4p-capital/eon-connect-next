"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, Keyboard, AlertTriangle } from "lucide-react";

// Scanner de QR Code reutilizável com fallback de entrada manual do token.
// Tentamos câmera traseira primeiro; se falhar permissão, mostramos o input manual.

type Html5QrcodeScannerType = {
  render: (onSuccess: (text: string) => void, onError?: (err: any) => void) => void;
  clear: () => Promise<void>;
};

export function QRScannerDialog({
  open,
  onClose,
  onDetected,
  title = "Escanear QR Code",
  subtitle = "Aponte a câmera para o QR Code do cliente",
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (text: string) => void;
  title?: string;
  subtitle?: string;
}) {
  const containerId = "qr-scanner-container";
  const scannerRef = useRef<any>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== "camera") return;

    let cancelled = false;
    setCameraError(null);

    const init = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            handleDetection(decodedText);
          },
          () => {
            // silent — frames sem QR
          },
        );
      } catch (err: any) {
        if (cancelled) return;
        console.error("Erro ao iniciar câmera:", err);
        setCameraError(
          err?.message?.includes("Permission")
            ? "Permissão de câmera negada. Libere nas configurações do navegador ou use o modo manual."
            : "Não foi possível acessar a câmera. Use o modo manual.",
        );
      }
    };

    init();

    return () => {
      cancelled = true;
      const sc = scannerRef.current;
      if (sc) {
        try {
          sc.stop().then(() => sc.clear()).catch(() => {});
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
    };
  }, [open, mode]);

  // Extrai UUID/token de qualquer string (URL completa, só token, etc.)
  const extractToken = (raw: string): string => {
    const trimmed = raw.trim();
    const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return uuidMatch ? uuidMatch[0] : trimmed;
  };

  const handleDetection = (decodedText: string) => {
    const token = extractToken(decodedText);
    const sc = scannerRef.current;
    if (sc) {
      try {
        sc.stop().then(() => sc.clear()).catch(() => {});
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    onDetected(token);
  };

  const handleManualSubmit = () => {
    const token = extractToken(manualValue);
    if (!token) return;
    onDetected(token);
    setManualValue("");
  };

  const handleClose = () => {
    setManualValue("");
    setCameraError(null);
    setMode("camera");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto max-w-md w-[calc(100%-2rem)] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{subtitle}</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-[var(--background-alt)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Toggle modo */}
              <div className="flex items-center bg-[var(--background-alt)] rounded-xl border border-[var(--border)] p-1">
                <button
                  onClick={() => setMode("camera")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    mode === "camera"
                      ? "bg-white shadow-sm text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Câmera
                </button>
                <button
                  onClick={() => setMode("manual")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    mode === "manual"
                      ? "bg-white shadow-sm text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  Digitar
                </button>
              </div>

              {mode === "camera" ? (
                <div className="space-y-3">
                  <div
                    id={containerId}
                    className="w-full aspect-square bg-black rounded-xl overflow-hidden relative"
                  />
                  {cameraError && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">{cameraError}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-center text-[var(--muted-foreground)]">
                    O código é reconhecido automaticamente ao enquadrar o QR.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                      Token ou link completo
                    </span>
                    <input
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      placeholder="UUID ou URL do QR"
                      className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20"
                    />
                  </label>
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualValue.trim()}
                    className="w-full py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
