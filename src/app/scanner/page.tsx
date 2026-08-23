"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ScanLine, LogOut, Check, Clock, X, Image as ImageIcon, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { PinGate } from "@/components/pin-gate";

type ScanState = "idle" | "valid" | "used" | "invalid";
type CameraStatus = "starting" | "started" | "error";

interface ScanResult {
  estado: "valida" | "ya_utilizado";
  nombre: string;
  cargo: string;
  ente: string | null;
  hora_entrada: string;
}

interface Evento {
  id: string;
  nombre: string;
}

export default function ScannerPage() {
  const [authed, setAuthed] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [scanInFlight, setScanInFlight] = useState(false);
  const [checking, setChecking] = useState(true);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanStateRef = useRef<ScanState>("idle");
  const scanInFlightRef = useRef(false);
  const activeEventoIdRef = useRef<string | null>(null);
  const cameraCleanupRef = useRef<Promise<void>>(Promise.resolve());

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

  useEffect(() => {
    if (!authed) return;
    fetch("/api/admin/evento")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        const rows = d.data as Evento[];
        const requestedId = new URLSearchParams(window.location.search).get("evento");
        const selected = requestedId
          ? rows.find((item) => item.id === requestedId) ?? null
          : rows[0] ?? null;
        activeEventoIdRef.current = selected?.id ?? null;
        setEventos(rows);
        setEvento(selected);
        if (selected) window.history.replaceState(null, "", `/scanner?evento=${selected.id}`);
      });
  }, [authed]);

  const pauseScan = useCallback(() => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => {
      scanStateRef.current = "idle";
      setScanState("idle");
      setResult(null);
    }, 3500);
  }, []);

  const handleScan = useCallback(async (token: string) => {
    if (
      !evento ||
      activeEventoIdRef.current !== evento.id ||
      scanStateRef.current !== "idle" ||
      scanInFlightRef.current
    ) return;
    const scannedEventoId = evento.id;
    scanInFlightRef.current = true;
    setScanInFlight(true);
    try {
      const res = await fetch("/api/scanner/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento_id: evento.id, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (activeEventoIdRef.current !== scannedEventoId) return;
      if (!res.ok || !data.ok) {
        scanStateRef.current = "invalid";
        setScanState("invalid");
        pauseScan();
        return;
      }
      const r = data.data as ScanResult;
      setResult(r);
      if (r.estado === "valida") {
        scanStateRef.current = "valid";
        setScanState("valid");
      } else {
        scanStateRef.current = "used";
        setScanState("used");
      }
      pauseScan();
    } catch {
      scanStateRef.current = "invalid";
      setScanState("invalid");
      pauseScan();
    } finally {
      scanInFlightRef.current = false;
      setScanInFlight(false);
    }
  }, [evento, pauseScan]);

  // Start camera. Some Android browsers require the permission request to be
  // triggered by a user gesture, so the UI also exposes a retry button.
  useEffect(() => {
    if (!authed || !evento) return;
    const el = cameraRef.current;
    if (!el) return;

    let disposed = false;
    let scanner: Html5Qrcode | null = null;
    const previousCleanup = cameraCleanupRef.current;

    const describeCameraError = (error: unknown) => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        return "La cámara requiere abrir esta página desde HTTPS.";
      }

      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        return "Permite el acceso a la cámara en los permisos del navegador.";
      }
      if (name === "NotFoundError") {
        return "No se encontró una cámara disponible en este dispositivo.";
      }
      if (name === "NotReadableError" || name === "AbortError") {
        return "La cámara está siendo usada por otra aplicación.";
      }
      return "No se pudo iniciar la cámara. Toca Activar cámara para reintentar.";
    };

    const start = async () => {
      await previousCleanup;
      if (disposed) return;

      setCameraStatus("starting");
      setCameraError(null);
      setCameraStarted(false);

      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("secure-context-required");
        }

        scanner = new Html5Qrcode("scanner-camera", {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: (width: number, height: number) => {
            const size = Math.floor(Math.min(width, height) * 0.68);
            return { width: size, height: size };
          },
        };
        const onSuccess = (decodedText: string) => {
          void handleScan(decodedText);
        };
        const onError = () => {};
        let rearCameraId: string | null = null;

        try {
          const cameras = await Html5Qrcode.getCameras();
          rearCameraId =
            cameras.find(({ label }) => /back|rear|environment|trasera|posterior/i.test(label))?.id ?? null;
        } catch {
          // start() below requests the camera again and gives the useful error.
        }

        if (disposed) return;

        try {
          await scanner.start(rearCameraId ?? { facingMode: "environment" }, config, onSuccess, onError);
        } catch (firstError) {
          // A few Android devices expose a camera but reject the facing mode
          // constraint. Retrying with the generic camera avoids that failure.
          if (!rearCameraId) throw firstError;
          await scanner.start({ facingMode: "environment" }, config, onSuccess, onError);
        }

        if (!disposed) {
          setCameraStarted(true);
          setCameraStatus("started");
        }
      } catch (error) {
        if (!disposed) {
          const message = describeCameraError(error);
          setCameraStatus("error");
          setCameraError(message);
          toast.error(message);
        }
      }
    };

    const startPromise = start();

    return () => {
      disposed = true;
      const cleanup = startPromise
        .catch(() => {})
        .then(async () => {
          if (!scanner) return;
          try {
            await scanner.stop();
          } catch {
            // The scanner may not have reached the running state yet.
          }
          if (scannerRef.current === scanner) scannerRef.current = null;
        });
      cameraCleanupRef.current = cleanup;
    };
  }, [authed, evento, cameraAttempt, handleScan]);

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
      <div className="flex min-h-dvh items-center justify-center bg-[#09090b]">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (!authed) {
    return <PinGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-dvh w-full bg-[#09090b]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col text-[#fafafa]">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-[18px_12px]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-extrabold">
              <ScanLine size={20} />
              Escáner de entrada
            </div>
            <select
              aria-label="Evento activo"
              value={evento?.id ?? ""}
              disabled={scanInFlight}
              onChange={(e) => {
                const selected = eventos.find((item) => item.id === e.target.value) ?? null;
                activeEventoIdRef.current = selected?.id ?? null;
                scanStateRef.current = "idle";
                setScanState("idle");
                setResult(null);
                setEvento(selected);
                if (selected) window.history.replaceState(null, "", `/scanner?evento=${selected.id}`);
              }}
              className="mt-[2px] block max-w-[58vw] cursor-pointer truncate bg-[#09090b] text-[13px] text-[#a1a1aa] outline-none"
            >
              {!evento && <option value="">Sin eventos</option>}
              {eventos.map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </div>
          <button
            onClick={logout}
            className="flex min-h-11 shrink-0 items-center gap-[7px] rounded-[10px] border border-[#27272a] bg-[#18181b] px-[15px] py-[10px] text-[13.5px] font-semibold text-[#a1a1aa] active:text-white"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>

        {/* Camera area */}
        <div
          className="relative mx-auto mb-[18px] aspect-square max-w-[424px] overflow-hidden rounded-[18px] border border-[#27272a] bg-[#101012]"
          style={{ width: "min(calc(100% - 36px), calc(100dvh - 12rem), 424px)" }}
        >
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-[13px] text-[#a1a1aa]">
                <Camera size={26} />
                <span>{cameraStatus === "starting" ? "Iniciando cámara…" : cameraError}</span>
                {cameraStatus === "error" && (
                  <button
                    type="button"
                    onClick={() => setCameraAttempt((attempt) => attempt + 1)}
                    className="min-h-11 rounded-[10px] bg-[#22c55e] px-4 py-2 font-bold text-[#052e16]"
                  >
                    Activar cámara
                  </button>
                )}
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
            <div className="max-w-full break-words text-lg font-semibold [overflow-wrap:anywhere]">{result?.nombre}</div>
            <div className="max-w-full break-words text-[15px] text-[#a1a1aa] [overflow-wrap:anywhere]">
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
            <div className="max-w-full break-words text-lg font-semibold [overflow-wrap:anywhere]">{result?.nombre}</div>
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
        <div className="mt-auto px-[18px] pt-[18px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <label className="flex min-h-[54px] w-full cursor-pointer items-center justify-center gap-[9px] rounded-[13px] border border-[#27272a] bg-[#18181b] px-4 py-4 text-base font-semibold text-[#fafafa] active:bg-[#1f1f23]">
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
    </div>
  );
}
