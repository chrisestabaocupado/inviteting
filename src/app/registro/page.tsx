"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar,
  Info,
  KeyRound,
  Landmark,
  Loader2,
  Mail,
  Phone,
  Send,
  Ticket,
  Trash2,
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

const PERSONA_VACIA = { nombre: "", cargo: "", email: "", telefono: "" };
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

export default function RegistroPage() {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [entes, setEntes] = useState<Ente[]>([]);
  const [loadingEntes, setLoadingEntes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
    reset,
  } = useForm<FormData, unknown, DatosRegistro>({
    resolver: zodResolver(datosRegistroSchema),
    defaultValues: {
      ente_id: "",
      pin: "",
      confirmacion: false,
      personas: [{ ...PERSONA_VACIA }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "personas" });
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
        const message = json.error || "Error al enviar solicitudes";
        setApiError(message);
        toast.error(message);
        return;
      }
      const cantidad = data.personas.length;
      toast.success(
        cantidad === 1
          ? "Solicitud enviada. Recibirás tu invitación con QR al ser aprobada."
          : `${cantidad} solicitudes enviadas. Cada invitación quedará pendiente de aprobación.`
      );
      reset({
        ente_id: "",
        pin: "",
        confirmacion: false,
        personas: [{ ...PERSONA_VACIA }],
      });
    } catch {
      setApiError("Error de conexión");
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#f5f5f6]">
      <div className="px-6 pt-11 pb-5 text-center">
        <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-[#4338ca] text-white shadow-[0_8px_20px_rgba(67,56,202,0.28)]">
          <Ticket size={26} />
        </div>
        <h1 className="text-[23px] font-extrabold tracking-tight">Registro de invitados</h1>
        <div className="mt-[5px] text-sm text-[#71717a]">
          {evento?.nombre ?? "Evento no seleccionado"}
          <span className="mx-auto mt-2 inline-flex items-center gap-[5px] rounded-full border border-[#e5e5e8] bg-white px-[10px] py-[3px] text-xs font-semibold">
            <Calendar size={13} /> {evento ? `${evento.fecha} · ${evento.hora.slice(0, 5)}` : "—"}
          </span>
        </div>
      </div>

      <div className="mx-3 mb-7 rounded-[14px] border border-[#e5e5e8] bg-white p-[18px_16px] shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:mx-6 sm:p-[22px_20px]">
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

          <div className="mb-[18px] space-y-3">
            {fields.map((field, index) => {
              const personErrors = errors.personas?.[index];
              return (
                <fieldset key={field.id} className="rounded-[12px] border border-[#e5e5e8] bg-[#fafafa] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <legend className="text-sm font-bold text-[#18181b]">Persona {index + 1}</legend>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" aria-label={`Eliminar persona ${index + 1}`} onClick={() => remove(index)} className="h-11 w-11 shrink-0 p-0 text-[#dc2626]"><Trash2 size={18} /></Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-[6px]">
                      <Label htmlFor={`persona-${index}-nombre`} className="text-[13.5px] font-semibold">Nombre completo <span className="text-[#dc2626]">*</span></Label>
                      <Input id={`persona-${index}-nombre`} {...register(`personas.${index}.nombre`)} placeholder="Nombre y apellido" className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]" />
                      {personErrors?.nombre && <p className="text-xs font-semibold text-[#dc2626]">{personErrors.nombre.message}</p>}
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <Label htmlFor={`persona-${index}-cargo`} className="text-[13.5px] font-semibold">Cargo <span className="text-[#dc2626]">*</span></Label>
                      <Input id={`persona-${index}-cargo`} {...register(`personas.${index}.cargo`)} placeholder="Ej. Directora de Protocolo" className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]" />
                      {personErrors?.cargo && <p className="text-xs font-semibold text-[#dc2626]">{personErrors.cargo.message}</p>}
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <Label htmlFor={`persona-${index}-email`} className="text-[13.5px] font-semibold">Correo <span className="text-[#dc2626]">*</span></Label>
                      <div className="relative">
                        <Mail size={18} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                        <Input id={`persona-${index}-email`} {...register(`personas.${index}.email`)} type="email" placeholder="nombre@correo.com" className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-base shadow-none md:text-[15px]" />
                      </div>
                      {personErrors?.email && <p className="text-xs font-semibold text-[#dc2626]">{personErrors.email.message}</p>}
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <Label htmlFor={`persona-${index}-telefono`} className="text-[13.5px] font-semibold">Teléfono <span className="text-[#dc2626]">*</span></Label>
                      <div className="relative">
                        <Phone size={18} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                        <Input id={`persona-${index}-telefono`} {...register(`personas.${index}.telefono`)} type="tel" placeholder="+58 412 000 0000" className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-base shadow-none md:text-[15px]" />
                      </div>
                      {personErrors?.telefono && <p className="text-xs font-semibold text-[#dc2626]">{personErrors.telefono.message}</p>}
                    </div>
                  </div>
                </fieldset>
              );
            })}
            {fields.length < 5 && (
              <Button type="button" variant="outline" onClick={() => append({ ...PERSONA_VACIA })} className="h-12 w-full rounded-[10px] border-dashed"><UserPlus size={18} /> Agregar persona</Button>
            )}
            {errors.personas?.root?.message && <p className="text-xs font-semibold text-[#dc2626]">{errors.personas.root.message}</p>}
          </div>

          <div className="mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-[#e5e5e8] bg-[#fafafa] p-[14px]">
            <Checkbox id="confirm" checked={confirmacion} onCheckedChange={(checked) => setValue("confirmacion", checked === true, { shouldValidate: true })} className="mt-[2px] h-[19px] w-[19px] border-[#e5e5e8] data-[state=checked]:border-[#4338ca] data-[state=checked]:bg-[#4338ca]" />
            <div>
              <Label htmlFor="confirm" className="text-[13.5px] font-semibold">Confirmo los datos y la asistencia de las personas registradas <span className="text-[#dc2626]">*</span></Label>
              <p className="mt-[2px] text-xs text-[#71717a]">Al enviar, cada solicitud quedará pendiente de aprobación.</p>
              {errors.confirmacion && <p className="mt-1 text-xs font-semibold text-[#dc2626]">{errors.confirmacion.message}</p>}
            </div>
          </div>

          {apiError && <p className="mb-3 text-center text-sm font-semibold text-[#dc2626]">{apiError}</p>}
          <Button type="submit" disabled={submitting || !evento?.inscripciones_abiertas} className="h-[52px] w-full rounded-[12px] bg-[#4338ca] text-[15.5px] font-bold text-white hover:bg-[#3730a3] active:scale-[0.99]">
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send size={18} />}
            {submitting ? "Enviando…" : evento && !evento.inscripciones_abiertas ? "Inscripciones cerradas" : fields.length === 1 ? "Enviar solicitud" : `Enviar ${fields.length} solicitudes`}
          </Button>
        </form>
      </div>
      <div className="mt-auto flex items-center justify-center gap-[6px] px-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] text-center text-xs text-[#71717a]"><Ticket size={14} /> Recibirás tu invitación con código QR al ser aprobada.</div>
    </div>
  );
}
