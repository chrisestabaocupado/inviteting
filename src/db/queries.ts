import { eq, and, sql, inArray, count } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";

export async function getEvento() {
  const rows = await db.select().from(schema.evento).limit(1);
  return rows[0] ?? null;
}

export async function upsertEvento(data: {
  nombre: string;
  fecha: string;
  hora: string;
  lugar: string;
  descripcion: string;
  inscripciones_abiertas: boolean;
}) {
  const existing = await getEvento();
  if (existing) {
    await db
      .update(schema.evento)
      .set({ ...data, actualizado_en: new Date() })
      .where(eq(schema.evento.id, existing.id));
    return { ...existing, ...data };
  }
  const rows = await db.insert(schema.evento).values(data).returning();
  return rows[0];
}

export async function getEntes() {
  return db.select().from(schema.ente);
}

export async function getEnteById(id: string) {
  const rows = await db
    .select()
    .from(schema.ente)
    .where(eq(schema.ente.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEnteByNombre(eventoId: string, nombre: string) {
  const rows = await db
    .select()
    .from(schema.ente)
    .where(
      and(eq(schema.ente.evento_id, eventoId), eq(schema.ente.nombre, nombre))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createEnte(data: {
  evento_id: string;
  nombre: string;
  pin_hash: string;
  cupo_maximo?: number;
}) {
  const rows = await db.insert(schema.ente).values(data).returning();
  return rows[0];
}

export async function updateEnte(
  id: string,
  data: Partial<{ nombre: string; pin_hash: string; cupo_maximo: number }>
) {
  const rows = await db
    .update(schema.ente)
    .set({ ...data, actualizado_en: new Date() })
    .where(eq(schema.ente.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteEnte(id: string) {
  await db.delete(schema.ente).where(eq(schema.ente.id, id));
}

export async function countInvitadosPorEnte(enteId: string) {
  const rows = await db
    .select({ count: count() })
    .from(schema.invitado)
    .where(
      and(
        eq(schema.invitado.ente_id, enteId),
        inArray(schema.invitado.estado_solicitud, ["pendiente", "aprobada"])
      )
    );
  return rows[0].count;
}

export async function getInvitadoById(id: string) {
  const rows = await db
    .select()
    .from(schema.invitado)
    .where(eq(schema.invitado.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInvitadoByToken(token: string) {
  const rows = await db
    .select()
    .from(schema.invitado)
    .where(eq(schema.invitado.token_qr, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInvitadosByEvento(eventoId: string) {
  return db
    .select()
    .from(schema.invitado)
    .where(eq(schema.invitado.evento_id, eventoId));
}

export async function getInvitadosByEnte(enteId: string) {
  return db
    .select()
    .from(schema.invitado)
    .where(eq(schema.invitado.ente_id, enteId));
}

export async function getInvitadosByEstado(
  eventoId: string,
  estado?: "pendiente" | "aprobada" | "rechazada" | "revocada"
) {
  if (estado) {
    return db
      .select()
      .from(schema.invitado)
      .where(
        and(
          eq(schema.invitado.evento_id, eventoId),
          eq(schema.invitado.estado_solicitud, estado)
        )
      );
  }
  return getInvitadosByEvento(eventoId);
}

export async function insertInvitado(data: {
  evento_id: string;
  ente_id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  email: string;
  telefono: string;
  confirmacion: boolean;
  origen: "publico" | "manual";
  estado_solicitud: "pendiente" | "aprobada" | "rechazada" | "revocada";
  token_qr?: string | null;
}) {
  const rows = await db
    .insert(schema.invitado)
    .values({
      ...data,
      estado_invitacion: "no_enviada",
      token_qr: data.token_qr ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateInvitadoEstado(
  id: string,
  estado: "aprobada" | "rechazada" | "revocada",
  updates?: Partial<typeof schema.invitado.$inferInsert>
) {
  const setData: Record<string, unknown> = {
    estado_solicitud: estado,
    actualizado_en: new Date(),
    ...updates,
  };
  if (estado === "aprobada") setData.aprobado_en = new Date();
  if (estado === "rechazada") setData.rechazado_en = new Date();
  if (estado === "revocada") setData.revocado_en = new Date();
  const rows = await db
    .update(schema.invitado)
    .set(setData)
    .where(eq(schema.invitado.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function markInvitacionEnviada(id: string) {
  const rows = await db
    .update(schema.invitado)
    .set({
      estado_invitacion: "enviada",
      enviado_en: new Date(),
      actualizado_en: new Date(),
    })
    .where(eq(schema.invitado.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function getEntradaByInvitado(invitadoId: string) {
  const rows = await db
    .select()
    .from(schema.entrada)
    .where(eq(schema.entrada.invitado_id, invitadoId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertEntrada(invitadoId: string) {
  const rows = await db
    .insert(schema.entrada)
    .values({ invitado_id: invitadoId })
    .returning();
  return rows[0];
}

export async function getIntentoByHuella(huella: string) {
  const rows = await db
    .select()
    .from(schema.intento_acceso)
    .where(eq(schema.intento_acceso.huella, huella))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertIntentoFallido(
  huella: string,
  tipo: "pin_general" | "pin_ente",
  intentos: number,
  expiraEn: Date | null
) {
  const existing = await getIntentoByHuella(huella);
  if (existing) {
    await db
      .update(schema.intento_acceso)
      .set({
        intentos_fallidos: intentos,
        ultimo_fallo_en: new Date(),
        expira_en: expiraEn,
      })
      .where(eq(schema.intento_acceso.id, existing.id));
    return;
  }
  await db.insert(schema.intento_acceso).values({
    huella,
    tipo,
    intentos_fallidos: intentos,
    ultimo_fallo_en: new Date(),
    expira_en: expiraEn,
  });
}

export async function resetIntento(huella: string) {
  const existing = await getIntentoByHuella(huella);
  if (existing) {
    await db
      .update(schema.intento_acceso)
      .set({ intentos_fallidos: 0, expira_en: null })
      .where(eq(schema.intento_acceso.id, existing.id));
  }
}
