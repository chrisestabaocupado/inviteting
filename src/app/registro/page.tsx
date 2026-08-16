"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ticket, Calendar, KeyRound, Mail, Phone, Send, Info, Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const schema = z.object({
  ente_id: z.string().uuid("Selecciona un ente"),
  pin: z.string().regex(/^\d{6}$/, "PIN de 6 dígitos requerido"),
  nombre: z.string().min(1, "Nombre requerido").max(200),
  apellido: z.string().min(1, "Apellido requerido").max(200),
  cargo: z.string().min(1, "Cargo requerido").max(200),
  email: z.string().email("Correo inválido").min(1),
  telefono: z.string().min(1, "Teléfono requerido").max(50),
  confirmacion: z.boolean().refine((v) => v === true, { message: "Debes confirmar tu asistencia" }),
});

type FormData = z.infer<typeof schema>;

interface Ente {
  id: string;
  nombre: string;
  cupo_maximo: number;
}

export default function RegistroPage() {
  const [entes, setEntes] = useState<Ente[]>([]);
  const [loadingEntes, setLoadingEntes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { confirmacion: false },
  });

  useEffect(() => {
    fetch("/api/registro/entes")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setEntes(d.data);
      })
      .catch(() => toast.error("No se pudo cargar la lista de entes"))
      .finally(() => setLoadingEntes(false));
  }, []);

  async function onSubmit(data: FormData) {
    setApiError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/registro/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          confirmacion: data.confirmacion,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const msg = json.error || "Error al enviar solicitud";
        setApiError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Solicitud enviada. Recibirás tu invitación con QR al ser aprobada.");
      reset();
    } catch {
      setApiError("Error de conexión");
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-[#f5f5f6]">
      <div className="px-6 pt-11 pb-5 text-center">
        <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-[#4338ca] text-white shadow-[0_8px_20px_rgba(67,56,202,0.28)]">
          <Ticket size={26} />
        </div>
        <h1 className="text-[23px] font-extrabold tracking-tight">Registro de invitados</h1>
        <div className="mt-[5px] text-sm text-[#71717a]">
          Cena de Gala Anual 2026
          <span className="mx-auto mt-2 inline-flex items-center gap-[5px] rounded-full border border-[#e5e5e8] bg-white px-[10px] py-[3px] text-xs font-semibold">
            <Calendar size={13} /> 18 de septiembre · 19:30
          </span>
        </div>
      </div>

      <div className="mx-4 mb-7 rounded-[14px] border border-[#e5e5e8] bg-white p-[22px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-[15px] flex flex-col gap-[6px]">
            <Label className="text-[13.5px] font-semibold">
              Ente <span className="text-[#dc2626]">*</span>
            </Label>
            <Select
              disabled={loadingEntes}
              onValueChange={(v) => setValue("ente_id", v as string, { shouldValidate: true })}
            >
              <SelectTrigger className="h-12 rounded-[10px] border-[#e5e5e8] text-[15px]">
                <SelectValue placeholder="Selecciona tu ente…" />
              </SelectTrigger>
              <SelectContent>
                {entes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      <Landmark size={14} /> {e.nombre}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ente_id && (
              <p className="text-xs font-semibold text-[#dc2626]">{errors.ente_id.message}</p>
            )}
          </div>

          <div className="mb-[15px] flex flex-col gap-[6px]">
            <Label className="text-[13.5px] font-semibold">
              PIN de acceso <span className="text-[#dc2626]">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]">
                <KeyRound size={18} />
              </span>
              <Input
                {...register("pin")}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-[15px] shadow-none focus:border-[#a5b4fc] focus:ring-[3px] focus:ring-[rgba(99,102,241,0.15)]"
              />
            </div>
            <div className="flex items-center gap-[5px] text-xs text-[#a1a1aa]">
              <Info size={13} /> El PIN te lo comparte tu ente.
            </div>
            {errors.pin && (
              <p className="text-xs font-semibold text-[#dc2626]">{errors.pin.message}</p>
            )}
          </div>

          <div className="mb-[15px] grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[6px]">
              <Label className="text-[13.5px] font-semibold">
                Nombre <span className="text-[#dc2626]">*</span>
              </Label>
              <Input
                {...register("nombre")}
                placeholder="Nombre"
                className="h-12 rounded-[10px] border-[#e5e5e8] text-[15px] shadow-none focus:border-[#a5b4fc] focus:ring-[3px] focus:ring-[rgba(99,102,241,0.15)]"
              />
              {errors.nombre && (
                <p className="text-xs font-semibold text-[#dc2626]">{errors.nombre.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-[6px]">
              <Label className="text-[13.5px] font-semibold">
                Apellido <span className="text-[#dc2626]">*</span>
              </Label>
              <Input
                {...register("apellido")}
                placeholder="Apellido"
                className="h-12 rounded-[10px] border-[#e5e5e8] text-[15px] shadow-none focus:border-[#a5b4fc] focus:ring-[3px] focus:ring-[rgba(99,102,241,0.15)]"
              />
              {errors.apellido && (
                <p className="text-xs font-semibold text-[#dc2626]">{errors.apellido.message}</p>
              )}
            </div>
          </div>

          <div className="mb-[15px] flex flex-col gap-[6px]">
            <Label className="text-[13.5px] font-semibold">
              Cargo <span className="text-[#dc2626]">*</span>
            </Label>
            <Input
              {...register("cargo")}
              placeholder="Ej. Directora de Protocolo"
              className="h-12 rounded-[10px] border-[#e5e5e8] text-[15px] shadow-none focus:border-[#a5b4fc] focus:ring-[3px] focus:ring-[rgba(99,102,241,0.15)]"
            />
            {errors.cargo && (
              <p className="text-xs font-semibold text-[#dc2626]">{errors.cargo.message}</p>
            )}
          </div>

          <div className="mb-[15px] flex flex-col gap-[6px]">
            <Label className="text-[13.5px] font-semibold">
              Correo <span className="text-[#dc2626]">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]">
                <Mail size={18} />
              </span>
              <Input
                {...register("email")}
                type="email"
                placeholder="nombre@correo.com"
                className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-[15px] shadow-none focus:border-[#a5b4fc] focus:ring-[3px] focus:ring-[rgba(99,102,241,0.15)]"
              />
            </div>
            {errors.email && (
              <p className="text-xs font-semibold text-[#dc2626]">{errors.email.message}</p>
            )}
          </div>

          <div className="mb-[15px] flex flex-col gap-[6px]">
            <Label className="text-[13.5px] font-semibold">
              Teléfono <span className="text-[#dc2626]">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#a1a1aa]">
                <Phone size={18} />
              </span>
              <Input
                {...register("telefono")}
                type="tel"
                placeholder="+58 412 000 0000"
                className="h-12 rounded-[10px] border-[#e5e5e8] pl-[42px] text-[15px] shadow-none focus:border-[#a5b4fc] focus:ring-[3px] focus:ring-[rgba(99,102,241,0.15)]"
              />
            </div>
            {errors.telefono && (
              <p className="text-xs font-semibold text-[#dc2626]">{errors.telefono.message}</p>
            )}
          </div>

          <div className="mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-[#e5e5e8] bg-[#fafafa] p-[14px]">
            <Checkbox
              id="confirm"
              checked={watch("confirmacion")}
              onCheckedChange={(c) => setValue("confirmacion", c === true, { shouldValidate: true })}
              className="mt-[2px] h-[19px] w-[19px] border-[#e5e5e8] data-[state=checked]:border-[#4338ca] data-[state=checked]:bg-[#4338ca]"
            />
            <div>
              <Label htmlFor="confirm" className="text-[13.5px] font-semibold">
                Confirmo mi asistencia <span className="text-[#dc2626]">*</span>
              </Label>
              <p className="mt-[2px] text-xs text-[#71717a]">
                Al enviar, tu solicitud quedará pendiente de aprobación.
              </p>
              {errors.confirmacion && (
                <p className="mt-1 text-xs font-semibold text-[#dc2626]">
                  {errors.confirmacion.message}
                </p>
              )}
            </div>
          </div>

          {apiError && (
            <p className="mb-3 text-center text-sm font-semibold text-[#dc2626]">{apiError}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="h-[52px] w-full rounded-[12px] bg-[#4338ca] text-[15.5px] font-bold text-white hover:bg-[#3730a3] active:scale-[0.99]"
          >
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send size={18} />}
            {submitting ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </form>
      </div>

      <div className="mt-auto flex items-center justify-center gap-[6px] px-6 pb-9 text-center text-xs text-[#71717a]">
        <Ticket size={14} /> Recibirás tu invitación con código QR al ser aprobada.
      </div>
    </div>
  );
}
