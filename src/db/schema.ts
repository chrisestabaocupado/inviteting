import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Enums
export const origenEnum = pgEnum("origen", ["publico", "manual"]);
export const estadoSolicitudEnum = pgEnum("estado_solicitud", [
  "pendiente",
  "aprobada",
  "rechazada",
  "revocada",
]);
export const estadoInvitacionEnum = pgEnum("estado_invitacion", [
  "no_enviada",
  "enviada",
]);
export const tipoAccesoEnum = pgEnum("tipo_acceso", [
  "pin_general",
  "pin_ente",
]);

// Tablas
export const evento = pgTable("evento", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  fecha: date("fecha").notNull(),
  hora: time("hora").notNull(),
  lugar: text("lugar").notNull(),
  descripcion: text("descripcion").notNull(),
  inscripciones_abiertas: boolean("inscripciones_abiertas")
    .notNull()
    .default(false),
  creado_en: timestamp("creado_en", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  actualizado_en: timestamp("actualizado_en", {
    withTimezone: true,
    mode: "date",
  })
    .notNull()
    .defaultNow(),
});

export const ente = pgTable(
  "ente",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evento_id: uuid("evento_id")
      .notNull()
      .references(() => evento.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    pin_hash: text("pin_hash").notNull(),
    pin_encrypted: text("pin_encrypted"),
    cupo_maximo: integer("cupo_maximo").notNull().default(5),
    creado_en: timestamp("creado_en", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    actualizado_en: timestamp("actualizado_en", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("ente_evento_nombre_unico").on(table.evento_id, table.nombre),
  ]
);

export const invitado = pgTable(
  "invitado",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evento_id: uuid("evento_id")
      .notNull()
      .references(() => evento.id, { onDelete: "cascade" }),
    ente_id: uuid("ente_id")
      .notNull()
      .references(() => ente.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    apellido: text("apellido").notNull(),
    cargo: text("cargo").notNull(),
    email: text("email").notNull(),
    telefono: text("telefono").notNull(),
    confirmacion: boolean("confirmacion").notNull().default(false),
    origen: origenEnum("origen").notNull(),
    estado_solicitud: estadoSolicitudEnum("estado_solicitud").notNull(),
    estado_invitacion: estadoInvitacionEnum("estado_invitacion").notNull(),
    token_qr: text("token_qr").unique(),
    aprobado_en: timestamp("aprobado_en", {
      withTimezone: true,
      mode: "date",
    }),
    rechazado_en: timestamp("rechazado_en", {
      withTimezone: true,
      mode: "date",
    }),
    revocado_en: timestamp("revocado_en", {
      withTimezone: true,
      mode: "date",
    }),
    enviado_en: timestamp("enviado_en", {
      withTimezone: true,
      mode: "date",
    }),
    creado_en: timestamp("creado_en", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    actualizado_en: timestamp("actualizado_en", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invitado_email_unico")
      .on(table.evento_id, sql`lower(${table.email})`)
      .where(
        sql`${table.estado_solicitud} in ('pendiente', 'aprobada')`
      ),
  ]
);

export const entrada = pgTable("entrada", {
  id: uuid("id").primaryKey().defaultRandom(),
  invitado_id: uuid("invitado_id")
    .notNull()
    .references(() => invitado.id, { onDelete: "cascade" })
    .unique(),
  creado_en: timestamp("creado_en", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const intento_acceso = pgTable("intento_acceso", {
  id: uuid("id").primaryKey().defaultRandom(),
  huella: text("huella").notNull().unique(),
  tipo: tipoAccesoEnum("tipo").notNull(),
  intentos_fallidos: integer("intentos_fallidos").notNull().default(0),
  ultimo_fallo_en: timestamp("ultimo_fallo_en", {
    withTimezone: true,
    mode: "date",
  }),
  expira_en: timestamp("expira_en", { withTimezone: true, mode: "date" }),
});
