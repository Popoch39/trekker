DROP INDEX "treks_difficulty_idx";--> statement-breakpoint
DROP INDEX "treks_distance_meters_idx";--> statement-breakpoint
CREATE INDEX "treks_geometry_idx" ON "treks" USING gist (("geometry"::geography));--> statement-breakpoint
CREATE INDEX "treks_difficulty_distance_idx" ON "treks" USING btree ("difficulty","distance_meters");--> statement-breakpoint
CREATE INDEX "treks_created_by_idx" ON "treks" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "treks" ADD CONSTRAINT "treks_source_ref_check" CHECK ("treks"."source" <> 'geotrek' OR ("treks"."source_instance" IS NOT NULL AND "treks"."source_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "treks" ADD CONSTRAINT "treks_measures_check" CHECK ("treks"."distance_meters" >= 0
        AND ("treks"."ascent_meters" IS NULL OR "treks"."ascent_meters" >= 0)
        AND ("treks"."descent_meters" IS NULL OR "treks"."descent_meters" >= 0)
        AND ("treks"."duration_minutes" IS NULL OR "treks"."duration_minutes" >= 0));