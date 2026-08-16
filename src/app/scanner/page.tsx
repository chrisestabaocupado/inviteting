"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ScanLine, LogOut, Check, Clock, X, Image as ImageIcon, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PinGate } from "@/components/pin-gate";

type ScanState = "idle" | "valid" | "used" | "invalid";

interface ScanResult {
  estado: "valida" | "ya_utilizado";
  nombre: string;
  cargo: string;
  ente: string | null;
  hora_entrada: string;
}

export default function ScannerPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check session
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.data?.admin) setAuthed(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Start camera
  useEffect(() => {
    if (!authed) return;
    const el = cameraRef.current;
    if (!el) return;

    const scanner = new Html5Qrcode("scanner-camera", {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {}
      )
      .then(() => setCameraStarted(true))
      .catch(() => {
        toast.error("No se pudo iniciar la cámara");
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [authed]);

  async function handleScan(token: string) {
    if (scanState !== "idle") return; // pausado
    try {
      const res = await fetch("/api/scanner/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setScanState("invalid");
        pauseScan();
        return;
      }
      const r = data.data as ScanResult;
      setResult(r);
      if (r.estado === "valida") {
        setScanState("valid");
      } else {
        setScanState("used");
      }
      pauseScan();
    } catch {
      setScanState("invalid");
      pauseScan();
    }
  }

  function pauseScan() {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => {
      setScanState("idle");
      setResult(null);
    }, 3500);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    try {
      const result = await scannerRef.current.scanFile(file, false);
      handleScan(result);
    } catch {
      toast.error("No se pudo leer el QR de la imagen");
    } finally {
      e.target.value = "";
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    toast.success("Sesión cerrada");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (!authed) {
    return <PinGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[460px] flex-col bg-[#09090b] text-[#fafafa]">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-[18px_12px]">
        <div>
          <div className="flex items-center gap-2 text-lg font-extrabold">
            <ScanLine size={20} />
            Escáner de entrada
          </div>
          <div className="mt-[2px] text-[13px] text-[#a1a1aa]">Cena de Gala Anual 2026</div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-[7px] rounded-[10px] border border-[#27272a] bg-[#18181b] px-[15px] py-[10px] text-[13.5px] font-semibold text-[#a1a1aa] active:text-white"
        >
          <LogOut size={16} /> Salir
        </button>
      </div>

      {/* Camera area */}
      <div className="relative mx-[18px] mb-[18px] aspect-square overflow-hidden rounded-[18px] border border-[#27272a] bg-[#101012]">
        <div id="scanner-camera" ref={cameraRef} className="h-full w-full" />

        {/* Scan overlay (idle) */}
        {scanState === "idle" && (
          <>
            <div
              className="pointer-events-none absolute"
              style={{
                left: "16%",
                top: "16%",
                width: "68%",
                height: "68%",
                background: `
                  linear-gradient(#22c55e, #22c55e) top left / 34px 4px,
                  linear-gradient(#22c55e, #22c55e) top left / 4px 34px,
                  linear-gradient(#22c55e, #22c55e) top right / 34px 4px,
                  linear-gradient(#22c55e, #22c55e) top right / 4px 34px,
                  linear-gradient(#22c55e, #22c55e) bottom left / 34px 4px,
                  linear-gradient(#22c55e, #22c55e) bottom left / 4px 34px,
                  linear-gradient(#22c55e, #22c55e) bottom right / 34px 4px,
                  linear-gradient(#22c55e, #22c55e) bottom right / 4px 34px
                `,
                backgroundRepeat: "no-repeat",
              }}
            />
            <div
              className="pointer-events-none absolute left-[16%] right-[16%] h-[2px] bg-[#22c55e] shadow-[0_0_14px_3px_rgba(34,197,94,0.6)]"
              style={{
                animation: "scan 2.2s ease-in-out infinite",
              }}
            />
            {!cameraStarted && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] text-[#a1a1aa]">
                <Camera size={26} />
                Iniciando cámara…
              </div>
            )}
          </>
        )}

        {/* Results */}
        {scanState === "valid" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#052e16] p-6 text-center">
            <div className="mb-1 flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[#22c55e] text-[#052e16]">
              <Check size={52} />
            </div>
            <div className="text-[22px] font-extrabold tracking-tight">Entrada válida</div>
            <div className="text-lg font-semibold">{result?.nombre}</div>
            <div className="text-[15px] text-[#a1a1aa]">
              {result?.ente ?? "—"} · {result?.hora_entrada ? new Date(result.hora_entrada).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
          </div>
        )}

        {scanState === "used" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#3a2405] p-6 text-center">
            <div className="mb-1 flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[#f59e0b] text-[#3a2405]">
              <Clock size={52} />
            </div>
            <div className="text-[22px] font-extrabold tracking-tight">Código ya utilizado</div>
            <div className="text-lg font-semibold">{result?.nombre}</div>
            <div className="text-[15px] text-[#a1a1aa]">
              Ingresó a las{" "}
              {result?.hora_entrada
                ? new Date(result.hora_entrada).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
                : ""}
            </div>
          </div>
        )}

        {scanState === "invalid" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#3f0a0a] p-6 text-center">
            <div className="mb-1 flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[#ef4444] text-[#3f0a0a]">
              <X size={52} />
            </div>
            <div className="text-[22px] font-extrabold tracking-tight">Código inválido</div>
            <div className="text-[15px] text-[#a1a1aa]">El código no existe o fue alterado</div>
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="flex items-center justify-center gap-[7px] px-6 text-center text-[14.5px] text-[#a1a1aa]">
        <ScanLine size={15} /> Apunta la cámara al código QR del invitado
      </div>

      {/* Actions */}
      <div className="mt-auto px-[18px] pt-[18px] pb-6">
        <label className="flex w-full cursor-pointer items-center justify-center gap-[9px] rounded-[13px] border border-[#27272a] bg-[#18181b] px-4 py-4 text-base font-semibold text-[#fafafa] active:bg-[#1f1f23] min-h-[54px]">
          <ImageIcon size={20} />
          Seleccionar imagen con QR
          <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </label>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0%, 100% {
            top: 16%;
          }
          50% {
            top: 84%;
          }
        }
      `}</style>
    </div>
  );
}
