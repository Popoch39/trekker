-- Ajoute a la main : drizzle-kit n'emet jamais de `CREATE EXTENSION`. Sans
-- cette ligne, un Postgres sans PostGIS pre-charge echoue sur le type
-- `geometry`. L'instruction est idempotente, donc sans effet sur les images
-- `postgis/postgis` qui la jouent deja a l'initialisation.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."trek_difficulty" AS ENUM('facile', 'moyen', 'difficile', 'tres_difficile');--> statement-breakpoint
CREATE TYPE "public"."trek_route_type" AS ENUM('loop', 'out_and_back', 'point_to_point');--> statement-breakpoint
CREATE TYPE "public"."trek_source" AS ENUM('geotrek', 'user');--> statement-breakpoint
CREATE TABLE "treks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"distance_meters" integer NOT NULL,
	"ascent_meters" integer,
	"descent_meters" integer,
	"duration_minutes" integer,
	"difficulty" "trek_difficulty",
	"source_difficulty" text,
	"route_type" "trek_route_type",
	"geometry" geometry(linestring,4326) NOT NULL,
	"start_point" geometry(point,4326) NOT NULL,
	"source" "trek_source" NOT NULL,
	"source_instance" text,
	"source_id" text,
	"source_url" text,
	"license" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treks" ADD CONSTRAINT "treks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treks_source_ref_idx" ON "treks" USING btree ("source","source_instance","source_id");--> statement-breakpoint
CREATE INDEX "treks_start_point_idx" ON "treks" USING gist (("start_point"::geography));--> statement-breakpoint
CREATE INDEX "treks_difficulty_idx" ON "treks" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "treks_distance_meters_idx" ON "treks" USING btree ("distance_meters");