import { describe, expect, it } from "vitest";
import { datosRegistroSchema } from "./registro";

const persona = {
  nombre: "Ana Pérez",
  cargo: "Directora",
  email: "ana@example.com",
  telefono: "+58 412 000 0000",
};

const solicitud = {
  ente_id: "00000000-0000-4000-8000-000000000001",
  pin: "123456",
  confirmacion: true,
  personas: [persona],
};

describe("datosRegistroSchema", () => {
  it("normaliza los textos y el correo", () => {
    const parsed = datosRegistroSchema.parse({
      ...solicitud,
      personas: [
        {
          ...persona,
          nombre: "  Ana Pérez  ",
          email: "  ANA@EXAMPLE.COM ",
        },
      ],
    });

    expect(parsed.personas[0].nombre).toBe("Ana Pérez");
    expect(parsed.personas[0].email).toBe("ana@example.com");
  });

  it("rechaza nombres compuestos vacíos", () => {
    const result = datosRegistroSchema.safeParse({
      ...solicitud,
      personas: [{ ...persona, nombre: "   " }],
    });

    expect(result.success).toBe(false);
  });

  it("requiere confirmación", () => {
    const result = datosRegistroSchema.safeParse({
      ...solicitud,
      confirmacion: false,
    });

    expect(result.success).toBe(false);
  });

  it("acepta hasta cinco personas", () => {
    const result = datosRegistroSchema.safeParse({
      ...solicitud,
      personas: Array.from({ length: 5 }, (_, index) => ({
        ...persona,
        email: `persona-${index}@example.com`,
      })),
    });

    expect(result.success).toBe(true);
  });

  it("rechaza seis personas", () => {
    const result = datosRegistroSchema.safeParse({
      ...solicitud,
      personas: Array.from({ length: 6 }, (_, index) => ({
        ...persona,
        email: `persona-${index}@example.com`,
      })),
    });

    expect(result.success).toBe(false);
  });
});
