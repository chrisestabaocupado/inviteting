"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar,
  CheckCircle2,
  Download,
  Info,
  KeyRound,
  Landmark,
  Loader2,
  Mail,
  Phone,
  Send,
  Ticket,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { datosRegistroSchema, type DatosRegistro } from "@/lib/registro";
import { InvitacionPdfDocument } from "@/components/invitacion-pdf";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";

type FormData = z.input<typeof datosRegistroSchema>;

interface Ente {
  id: string;
  nombre: string;
  cupo_maximo: number;
}

interface Evento {
  id: string;
  nombre: string;
  fecha: string;
  hora: string;
  lugar: string;
  inscripciones_abiertas: boolean;
}

interface Registro {
  nombre: string;
  cargo: string;
  ente_id: string;
  token_qr: string;
  qrDataUrl: string;
}

export default function RegistroPage() {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [entes, setEntes] = useState<Ente[]>([]);
  const [loadingEntes, setLoadingEntes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData, unknown, DatosRegistro>({
    resolver: zodResolver(datosRegistroSchema),
    defaultValues: {
      ente_id: "",
      pin: "",
      nombre: "",
      cargo: "",
      email: "",
      telefono: "",
      confirmacion: false,
    },
  });
  const enteId = useWatch({ control, name: "ente_id" });
  const confirmacion = useWatch({ control, name: "confirmacion" });

  useEffect(() => {
    const eventoId = new URLSearchParams(window.location.search).get("evento");
    const url = eventoId
      ? `/api/registro/entes?evento=${encodeURIComponent(eventoId)}`
      : "/api/registro/entes";
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) {
          setEvento(data.data.evento);
          setEntes(data.data.entes);
        } else {
          setApiError(data.error || "No se pudo cargar el evento");
        }
      })
      .catch(() => toast.error("No se pudo cargar la lista de entes"))
      .finally(() => setLoadingEntes(false));
  }, []);

  async function onSubmit(data: DatosRegistro) {
    if (!evento) return;
    setApiError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/registro/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, evento_id: evento.id }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        const message = json.error || "Error al enviar la solicitud";
        setApiError(message);
        toast.error(message);
        return;
      }
      const invitado = json.data as {
        nombre: string;
        cargo: string;
        ente_id: string;
        token_qr: string;
      };
      const qrDataUrl = await QRCode.toDataURL(invitado.token_qr, {
        width: 400,
        margin: 2,
      });
      setRegistro({
        nombre: invitado.nombre,
        cargo: invitado.cargo,
        ente_id: invitado.ente_id,
        token_qr: invitado.token_qr,
        qrDataUrl,
      });
      toast.success("Registro exitoso");
    } catch {
      setApiError("Error de conexión");
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadPdf() {
    if (!registro || !evento) return;
    setDownloading(true);
    try {
      const enteNombre =
        entes.find((item) => item.id === registro.ente_id)?.nombre ?? "—";
      const blob = await pdf(
        <InvitacionPdfDocument
          evento={evento}
          invitado={registro}
          enteNombre={enteNombre}
          qrDataUrl={registro.qrDataUrl}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invitacion-${registro.nombre}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Invitación descargada");
    } catch {
      toast.error("No se pudo generar el PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#f5f5f6]">
      <div className="px-6 pt-11 pb-5 text-center">
        <Image
          src="/logo_intitucional.jpeg"
          alt="Unidad Nacional de Inteligencia Financiera"
          width={54}
          height={54}
          loading="eager"
          className="mx-auto mb-4 h-[54px] w-[54px] rounded-full object-cover shadow-[0_8px_20px_rgba(200,16,46,0.28)]"
        />
        <h1 className="text-[23px] font-extrabold tracking-tight">Registro de invitados</h1>
        <div className="mt-[5px] text-sm text-[#71717a]">
          {evento?.nombre ?? "Evento no seleccionado"}
          <span className="mx-auto mt-2 flex w-fit items-center gap-[5px] rounded-full border border-[#e5e5e8] bg-white px-[10px] py-[3px] text-xs font-semibold">
            <Calendar size={13} /> {evento ? `${evento.fecha} · ${evento.hora.slice(0, 5)}` : "—"}
          </span>
        </div>
      </div>

      <div className="mx-3 mb-7 rounded-[14px] border border-[#e5e5e8] bg-white p-[18px_16px] shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:mx-6 sm:p-[22px_20px]">
        {registro ? (
          <div className="text-center">
            <Image
              src="/logo_intitucional.jpeg"
              alt="Unidad Nacional de Inteligencia Financiera"
              width={52}
              height={52}
              className="mx-auto mb-3 h-[52px] w-[52px] rounded-full object-cover"
            />
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fdf4] text-[#16a34a]">
              <CheckCircle2 size={30} />
            </div>
            <h2 className="text-[20px] font-extrabold tracking-tight">Registro exitoso</h2>
            <p className="mt-1 text-sm text-[#71717a]">
              Tu registro fue aprobado. Presenta este código QR en la entrada.
            </p>

            <div className="mt-5 rounded-[14px] border border-[#e5e5e8] bg-[#fafafa] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={registro.qrDataUrl}
                alt={`Código QR de ${registro.nombre}`}
                className="mx-auto h-60 w-60 max-w-full"
              />
              <p className="mt-4 text-[16px] font-bold text-[#18181b]">{registro.nombre}</p>
              <p className="text-[13px] text-[#71717a]">
                {registro.cargo} ·{" "}
                {entes.find((item) => item.id === registro.ente_id)?.nombre ?? "—"}
              </p>
            </div>

            <Button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="mt-5 h-[52px] w-full rounded-[12px] bg-[#c8102e] text-[15.5px] font-bold text-white hover:bg-[#9e0c24] active:scale-[0.99]"
            >
              {downloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download size={18} />}
              {downloading ? "Generando…" : "Descargar PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRegistro(null);
                reset();
              }}
              className="mt-3 h-12 w-full rounded-[12px]"
            >
              <UserPlus size={18} /> Registrar otra persona
            </Button>
            <p className="mt-3 text-xs text-[#71717a]">
              Si cierras esta página, deberás registrarte de nuevo para obtener tu QR.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-[15px] flex flex-col gap-[6px]">
              <Label htmlFor="ente" className="text-[13.5px] font-semibold">
                Ente <span className="text-[#dc2626]">*</span>
              </Label>
              <Select
                value={enteId || null}
                disabled={loadingEntes}
                onValueChange={(value) =>
                  setValue("ente_id", value as string, { shouldValidate: true })
                }
              >
                <SelectTrigger id="ente" aria-label="Ente" className="h-12 w-full rounded-[10px] border-[#e5e5e8] text-base md:text-[15px]">
                  <SelectValue>
                    {entes.find((item) => item.id === enteId)?.nombre ?? "Selecciona tu ente…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {entes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex min-w-0 items-center gap-2 break-words">
                        <Landmark size={14} /> {item.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ente_id && <p className="text-xs font-semibold text-[#dc2626]">{errors.ente_id.message}</p>}
            </div>

            <div className="mb-[15px] flex flex-col gap-[6px]">
              <Label htmlFor="pin" className="text-[13.5px] font-semibold">
                PIN de acceso <span className="text-[#dc2626]">*</span>
              </Label>
              <div className="relative">
                <KeyRound size={18} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                <Input id="pin" {...register("pin")} type="text" inputMode="numeric" maxLength={6} placeholder="••••••" className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-base shadow-none md:text-[15px]" />
              </div>
              <div className="flex items-center gap-[5px] text-xs text-[#a1a1aa]"><Info size={13} /> El PIN te lo comparte tu ente.</div>
              {errors.pin && <p className="text-xs font-semibold text-[#dc2626]">{errors.pin.message}</p>}
            </div>

            <div className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="nombre" className="text-[13.5px] font-semibold">Nombre completo <span className="text-[#dc2626]">*</span></Label>
                <Input id="nombre" {...register("nombre")} placeholder="Nombre y apellido" className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]" />
                {errors.nombre && <p className="text-xs font-semibold text-[#dc2626]">{errors.nombre.message}</p>}
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="cargo" className="text-[13.5px] font-semibold">Cargo <span className="text-[#dc2626]">*</span></Label>
                <Input id="cargo" {...register("cargo")} placeholder="Ej. Directora de Protocolo" className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]" />
                {errors.cargo && <p className="text-xs font-semibold text-[#dc2626]">{errors.cargo.message}</p>}
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="email" className="text-[13.5px] font-semibold">Correo <span className="text-[#dc2626]">*</span></Label>
                <div className="relative">
                  <Mail size={18} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                  <Input id="email" {...register("email")} type="email" placeholder="nombre@correo.com" className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-base shadow-none md:text-[15px]" />
                </div>
                {errors.email && <p className="text-xs font-semibold text-[#dc2626]">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="telefono" className="text-[13.5px] font-semibold">Teléfono <span className="text-[#dc2626]">*</span></Label>
                <div className="relative">
                  <Phone size={18} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                  <Input id="telefono" {...register("telefono")} type="tel" placeholder="+58 412 000 0000" className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-base shadow-none md:text-[15px]" />
                </div>
                {errors.telefono && <p className="text-xs font-semibold text-[#dc2626]">{errors.telefono.message}</p>}
              </div>
            </div>

            <div className="mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-[#e5e5e8] bg-[#fafafa] p-[14px]">
              <Checkbox id="confirm" checked={confirmacion} onCheckedChange={(checked) => setValue("confirmacion", checked === true, { shouldValidate: true })} className="mt-[2px] h-[19px] w-[19px] border-[#e5e5e8] data-[state=checked]:border-[#c8102e] data-[state=checked]:bg-[#c8102e]" />
              <div>
                <Label htmlFor="confirm" className="text-[13.5px] font-semibold">Confirmo los datos y la asistencia <span className="text-[#dc2626]">*</span></Label>
                <p className="mt-[2px] text-xs text-[#71717a]">Al enviar, tu registro se aprueba al instante y verás tu código QR.</p>
                {errors.confirmacion && <p className="mt-1 text-xs font-semibold text-[#dc2626]">{errors.confirmacion.message}</p>}
              </div>
            </div>

            {apiError && <p className="mb-3 text-center text-sm font-semibold text-[#dc2626]">{apiError}</p>}
            <Button type="submit" disabled={submitting || !evento?.inscripciones_abiertas} className="h-[52px] w-full rounded-[12px] bg-[#c8102e] text-[15.5px] font-bold text-white hover:bg-[#9e0c24] active:scale-[0.99]">
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send size={18} />}
              {submitting ? "Enviando…" : evento && !evento.inscripciones_abiertas ? "Inscripciones cerradas" : "Enviar solicitud"}
            </Button>
          </form>
        )}
      </div>
      <div className="mt-auto flex items-center justify-center gap-[6px] px-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] text-center text-xs text-[#71717a]"><Ticket size={14} /> Tu código QR se genera al registrarte.</div>
    </div>
  );
}
