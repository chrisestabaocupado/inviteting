CREATE TYPE "public"."estado_invitacion" AS ENUM('no_enviada', 'enviada');--> statement-breakpoint
CREATE TYPE "public"."estado_solicitud" AS ENUM('pendiente', 'aprobada', 'rechazada', 'revocada');--> statement-breakpoint
CREATE TYPE "public"."origen" AS ENUM('publico', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tipo_acceso" AS ENUM('pin_general', 'pin_ente');--> statement-breakpoint
CREATE TABLE "ente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"pin_hash" text NOT NULL,
	"cupo_maximo" integer DEFAULT 5 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ente_evento_nombre_unico" UNIQUE("evento_id","nombre")
);
--> statement-breakpoint
CREATE TABLE "entrada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitado_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrada_invitado_id_unique" UNIQUE("invitado_id")
);
--> statement-breakpoint
CREATE TABLE "evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"fecha" date NOT NULL,
	"hora" time NOT NULL,
	"lugar" text NOT NULL,
	"descripcion" text NOT NULL,
	"inscripciones_abiertas" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intento_acceso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huella" text NOT NULL,
	"tipo" "tipo_acceso" NOT NULL,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"ultimo_fallo_en" timestamp with time zone,
	"expira_en" timestamp with time zone,
	CONSTRAINT "intento_acceso_huella_unique" UNIQUE("huella")
);
--> statement-breakpoint
CREATE TABLE "invitado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"ente_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"cargo" text NOT NULL,
	"email" text NOT NULL,
	"telefono" text NOT NULL,
	"confirmacion" boolean DEFAULT false NOT NULL,
	"origen" "origen" NOT NULL,
	"estado_solicitud" "estado_solicitud" NOT NULL,
	"estado_invitacion" "estado_invitacion" NOT NULL,
	"token_qr" text,
	"aprobado_en" timestamp with time zone,
	"rechazado_en" timestamp with time zone,
	"revocado_en" timestamp with time zone,
	"enviado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitado_token_qr_unique" UNIQUE("token_qr")
);
--> statement-breakpoint
ALTER TABLE "ente" ADD CONSTRAINT "ente_evento_id_evento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."evento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_invitado_id_invitado_id_fk" FOREIGN KEY ("invitado_id") REFERENCES "public"."invitado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitado" ADD CONSTRAINT "invitado_evento_id_evento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."evento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitado" ADD CONSTRAINT "invitado_ente_id_ente_id_fk" FOREIGN KEY ("ente_id") REFERENCES "public"."ente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitado_email_unico" ON "invitado" USING btree ("evento_id",lower("email")) WHERE "invitado"."estado_solicitud" in ('pendiente', 'aprobada');