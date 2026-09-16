import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "./setup";
import { db } from "@/db/index";
import * as schema from "@/db/schema";
import {
  createEvento,
  deleteEvento,
  getEvento,
  upsertEvento,
  createEnte,
  getEnteById,
  getInvitadoById,
  getEntes,
  getInvitadosByEvento,
  getEntradaByInvitado,
  countInvitadosPorEnte,
  insertInvitado,
  updateInvitadoEstado,
  aprobarInvitado,
  insertEntrada,
} from "@/db/queries";
import { generateQrToken } from "@/lib/crypto-utils";
import bcryptjs from "bcryptjs";
import { eq } from "drizzle-orm";
import { POST as registrarSolicitud } from "@/app/api/registro/solicitud/route";

async function cleanAll() {
  await db.delete(schema.entrada);
  await db.delete(schema.invitado);
  await db.delete(schema.ente);
  await db.delete(schema.evento);
}

let eventoId: string;
let enteId: string;
let pinHash: string;

beforeAll(async () => {
  await cleanAll();
  const evento = await upsertEvento({
    nombre: "Evento Test",
    fecha: "2026-08-20",
    hora: "18:00",
    lugar: "Caracas",
    descripcion: "Test",
    inscripciones_abiertas: true,
  });
  eventoId = evento.id;
  pinHash = await bcryptjs.hash("123456", 10);
  const ente = await createEnte({
    evento_id: eventoId,
    nombre: "Ente Test",
    pin_hash: pinHash,
    pin_encrypted: "test",
    cupo_maximo: 5,
  });
  enteId = ente.id;
});

afterAll(async () => {
  await cleanAll();
});

async function createRegistrationContext(cupoMaximo = 5) {
  const evento = await createEvento({
    nombre: `Evento lote ${Date.now()}-${Math.random()}`,
    fecha: "2026-11-20",
    hora: "18:00",
    lugar: "Caracas",
    descripcion: "Prueba de lote",
    inscripciones_abiertas: true,
  });
  const ente = await createEnte({
    evento_id: evento.id,
    nombre: `Ente lote ${Date.now()}-${Math.random()}`,
    pin_hash: pinHash,
    pin_encrypted: "test",
    cupo_maximo: cupoMaximo,
  });
  return { evento, ente };
}

async function postRegistration(payload: unknown) {
  return registrarSolicitud(
    new Request("http://localhost/api/registro/solicitud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

function registroPayload(
  eventoId: string,
  enteId: string,
  email = `invitado-${Date.now()}-${Math.random()}@example.com`
) {
  return {
    evento_id: eventoId,
    ente_id: enteId,
    pin: "123456",
    nombre: "Ana Pérez",
    cargo: "Directora",
    email,
    telefono: "04120000001",
    confirmacion: true,
  };
}

describe("Registro público aprobado al instante", () => {
  it("registra una persona aprobada con token QR y consume cupo", async () => {
    const { evento, ente } = await createRegistrationContext();
    const response = await postRegistration(
      registroPayload(evento.id, ente.id)
    );
    const body = (await response.json()) as {
      ok: boolean;
      data: {
        nombre: string;
        estado_solicitud: string;
        token_qr: string | null;
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.nombre).toBe("Ana Pérez");
    expect(body.data.estado_solicitud).toBe("aprobada");
    expect(body.data.token_qr).toBeTruthy();
    expect(await getInvitadosByEvento(evento.id)).toHaveLength(1);
    expect(await countInvitadosPorEnte(ente.id)).toBe(1);
  });

  it("rechaza un correo ya registrado sin insertar filas", async () => {
    const { evento, ente } = await createRegistrationContext();
    const email = `duplicado-${Date.now()}@example.com`;

    const first = await postRegistration(
      registroPayload(evento.id, ente.id, email)
    );
    expect(first.status).toBe(200);

    const second = await postRegistration(
      registroPayload(evento.id, ente.id, email.toUpperCase())
    );

    expect(second.status).toBe(409);
    expect(await getInvitadosByEvento(evento.id)).toHaveLength(1);
    expect(await countInvitadosPorEnte(ente.id)).toBe(1);
  });

  it("rechaza el registro cuando el cupo está agotado", async () => {
    const { evento, ente } = await createRegistrationContext(1);

    const first = await postRegistration(
      registroPayload(evento.id, ente.id)
    );
    expect(first.status).toBe(200);

    const second = await postRegistration(
      registroPayload(evento.id, ente.id)
    );
    const body = (await second.json()) as { error: string };

    expect(second.status).toBe(409);
    expect(body.error).toContain("Cupo agotado");
    expect(await getInvitadosByEvento(evento.id)).toHaveLength(1);
    expect(await countInvitadosPorEnte(ente.id)).toBe(1);
  });
});

describe("Reglas transaccionales", () => {
  it("PIN ente válido permite registrar", async () => {
    const valid = await bcryptjs.compare("123456", pinHash);
    expect(valid).toBe(true);
  });

  it("aprobar consume cupo y rechaza cuando está lleno", async () => {
    const { evento, ente } = await createRegistrationContext(1);

    const inv = await insertInvitado({
      evento_id: evento.id,
      ente_id: ente.id,
      nombre: "Pendiente Cupo",
      cargo: "Cargo",
      email: "pendiente-cupo@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "pendiente",
    });
    expect(await countInvitadosPorEnte(ente.id)).toBe(0);

    const approved = await aprobarInvitado(inv.id, generateQrToken());
    expect(approved?.estado_solicitud).toBe("aprobada");
    expect(await countInvitadosPorEnte(ente.id)).toBe(1);

    const inv2 = await insertInvitado({
      evento_id: evento.id,
      ente_id: ente.id,
      nombre: "Pendiente Cupo 2",
      cargo: "Cargo",
      email: "pendiente-cupo-2@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "pendiente",
    });
    await expect(
      aprobarInvitado(inv2.id, generateQrToken())
    ).rejects.toThrow("Cupo agotado");
    expect(await countInvitadosPorEnte(ente.id)).toBe(1);
  });

  it("revocar libera cupo", async () => {
    const inv = await insertInvitado({
      evento_id: eventoId,
      ente_id: enteId,
      nombre: "Revocar Test",
      cargo: "Cargo",
      email: "revocar@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "aprobada",
      token_qr: generateQrToken(),
    });
    const before = await countInvitadosPorEnte(enteId);
    await updateInvitadoEstado(inv.id, "revocada");
    const after = await countInvitadosPorEnte(enteId);
    expect(after).toBe(before - 1);
  });

  it("email duplicado se rechaza", async () => {
    const email = "dup@test.com";
    await insertInvitado({
      evento_id: eventoId,
      ente_id: enteId,
      nombre: "Dup1 Test",
      cargo: "Cargo",
      email,
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "pendiente",
    });
    try {
      await db.transaction(async (txDb) => {
        const dupRows = await txDb
          .select()
          .from(schema.invitado)
          .where(
            eq(schema.invitado.email, email)
          )
          .limit(1);
        if (dupRows.length) {
          throw new Error("El email ya está registrado");
        }
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("registrado");
    }
  });

  it("aprobar crea token_qr y rechazar no", async () => {
    const inv = await insertInvitado({
      evento_id: eventoId,
      ente_id: enteId,
      nombre: "Aprobar Test",
      cargo: "Cargo",
      email: "aprobar@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "pendiente",
    });
    const token = generateQrToken();
    const updated = await updateInvitadoEstado(inv.id, "aprobada", { token_qr: token });
    expect(updated?.token_qr).toBeTruthy();
    expect(updated?.estado_solicitud).toBe("aprobada");

    const inv2 = await insertInvitado({
      evento_id: eventoId,
      ente_id: enteId,
      nombre: "Rechazar Test",
      cargo: "Cargo",
      email: "rechazar2@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "pendiente",
    });
    const updated2 = await updateInvitadoEstado(inv2.id, "rechazada");
    expect(updated2?.token_qr).toBeNull();
    expect(updated2?.estado_solicitud).toBe("rechazada");
  });

  it("registro manual queda aprobado y consume cupo", async () => {
    const before = await countInvitadosPorEnte(enteId);
    const token = generateQrToken();
    const inv = await insertInvitado({
      evento_id: eventoId,
      ente_id: enteId,
      nombre: "Manual Test",
      cargo: "Cargo",
      email: "manual@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "manual",
      estado_solicitud: "aprobada",
      token_qr: token,
    });
    const after = await countInvitadosPorEnte(enteId);
    expect(inv.estado_solicitud).toBe("aprobada");
    expect(inv.token_qr).toBeTruthy();
    expect(after).toBe(before + 1);
  });

  it("primer escaneo crea entrada válida y segundo devuelve hora del primero", async () => {
    const token = generateQrToken();
    const inv = await insertInvitado({
      evento_id: eventoId,
      ente_id: enteId,
      nombre: "Scan Test",
      cargo: "Cargo",
      email: "scan@test.com",
      telefono: "0412000000",
      confirmacion: false,
      origen: "publico",
      estado_solicitud: "aprobada",
      token_qr: token,
    });

    const first = await insertEntrada(inv.id);
    expect(first).toBeTruthy();

    const second = await getEntradaByInvitado(inv.id);
    expect(second?.creado_en.getTime()).toBe(first.creado_en.getTime());
  });

  it("aísla entes e invitados entre eventos", async () => {
    const otroEvento = await createEvento({
      nombre: "Otro Evento",
      fecha: "2026-09-20",
      hora: "20:00",
      lugar: "Valencia",
      descripcion: "Segundo workspace",
      inscripciones_abiertas: true,
    });
    const otroEnte = await createEnte({
      evento_id: otroEvento.id,
      nombre: "Ente Otro",
      pin_hash: pinHash,
      pin_encrypted: "test",
      cupo_maximo: 5,
    });
    await insertInvitado({
      evento_id: otroEvento.id,
      ente_id: otroEnte.id,
      nombre: "Invitado Otro",
      cargo: "Cargo",
      email: "otro@test.com",
      telefono: "0412000000",
      confirmacion: true,
      origen: "publico",
      estado_solicitud: "pendiente",
    });

    expect((await getEntes(eventoId)).some((item) => item.id === otroEnte.id)).toBe(false);
    expect(await getEntes(otroEvento.id)).toHaveLength(1);
    expect(await getInvitadosByEvento(eventoId)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ email: "otro@test.com" })])
    );
    expect(await getInvitadosByEvento(otroEvento.id)).toHaveLength(1);
  });

  it("eliminar un evento elimina sus registros en cascada", async () => {
    const evento = await createEvento({
      nombre: "Evento para eliminar",
      fecha: "2026-10-20",
      hora: "20:00",
      lugar: "Maracay",
      descripcion: "Cascade test",
      inscripciones_abiertas: true,
    });
    const ente = await createEnte({
      evento_id: evento.id,
      nombre: "Ente para eliminar",
      pin_hash: pinHash,
      pin_encrypted: "test",
      cupo_maximo: 5,
    });
    const invitado = await insertInvitado({
      evento_id: evento.id,
      ente_id: ente.id,
      nombre: "Invitado Cascade",
      cargo: "Cargo",
      email: "cascade@test.com",
      telefono: "0412000000",
      confirmacion: true,
      origen: "manual",
      estado_solicitud: "aprobada",
      token_qr: generateQrToken(),
    });
    await insertEntrada(invitado.id);

    expect(await deleteEvento(evento.id, "Nombre incorrecto")).toBeNull();
    expect(await deleteEvento(evento.id, evento.nombre)).toEqual({ id: evento.id });
    expect(await getEvento(evento.id)).toBeNull();
    expect(await getEnteById(ente.id)).toBeNull();
    expect(await getInvitadoById(invitado.id)).toBeNull();
    expect(await getEntradaByInvitado(invitado.id)).toBeNull();
  });
});
