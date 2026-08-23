UPDATE "invitado"
SET "nombre" = "nombre" || ' ' || "apellido";
--> statement-breakpoint
ALTER TABLE "invitado" DROP COLUMN "apellido";
