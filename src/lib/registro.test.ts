import { describe, expect, it } from "vitest";
import { datosRegistroSchema } from "./registro";

const solicitud = {
  ente_id: "00000000-0000-4000-8000-000000000001",
  pin: "123456",
  nombre: "Ana Pérez",
  cargo: "Directora",
  email: "ana@example.com",
  telefono: "+58 412 000 0000",
  confirmacion: true,
};

describe("datosRegistroSchema", () => {
  it("normaliza los textos y el correo", () => {
    const parsed = datosRegistroSchema.parse({
      ...solicitud,
      nombre: "  Ana Pérez  ",
      email: "  ANA@EXAMPLE.COM ",
    });

    expect(parsed.nombre).toBe("Ana Pérez");
    expect(parsed.email).toBe("ana@example.com");
  });

  it("rechaza nombres vacíos", () => {
    const result = datosRegistroSchema.safeParse({
      ...solicitud,
      nombre: "   ",
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

  it("rechaza un PIN que no tiene seis dígitos", () => {
    const result = datosRegistroSchema.safeParse({
      ...solicitud,
      pin: "123",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza el formato de registro masivo", () => {
    const result = datosRegistroSchema.safeParse({
      ente_id: solicitud.ente_id,
      pin: solicitud.pin,
      confirmacion: true,
      personas: [{ ...solicitud }, { ...solicitud }],
    });

    expect(result.success).toBe(false);
  });
});
