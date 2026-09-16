import { z } from "zod";

export const datosRegistroSchema = z.object({
  ente_id: z.string().uuid("Selecciona un ente"),
  pin: z.string().regex(/^\d{6}$/, "PIN de 6 dígitos requerido"),
  nombre: z
    .string()
    .trim()
    .min(1, "Nombre completo requerido")
    .max(401, "Nombre demasiado largo"),
  cargo: z.string().trim().min(1, "Cargo requerido").max(200),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  telefono: z.string().trim().min(1, "Teléfono requerido").max(50),
  confirmacion: z.boolean().refine(Boolean, {
    message: "Debes confirmar la asistencia",
  }),
});

export const solicitudRegistroSchema = datosRegistroSchema.extend({
  evento_id: z.string().uuid(),
});

export type DatosRegistro = z.infer<typeof datosRegistroSchema>;
