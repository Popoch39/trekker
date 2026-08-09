import { schema } from '@repo/db';
import { sql } from 'drizzle-orm';

import type { Database } from '../database/database.tokens';
import type { TrekImportRow } from '../modules/treks/geotrek/geotrek.types';

/**
 * Seed : fichier vers base.
 *
 * Aucun acces reseau : le script lit un fichier et ecrit en base, ce qui le
 * rend rejouable a l'identique sur n'importe quel poste et utilisable depuis
 * les tests.
 */

/**
 * Taille des lots. Postgres plafonne a 65535 parametres par requete ; a une
 * quinzaine de colonnes par ligne, deux cents lignes laissent une marge
 * confortable tout en evitant une requete par itineraire.
 */
const CHUNK_SIZE = 200;

export interface SeedReport {
  /** Lignes soumises, insertions et mises a jour confondues. */
  processed: number;
}

/**
 * Insere ou met a jour les itineraires importes.
 *
 * L'upsert porte sur `(source, source_instance, source_id)` : rejouer le seed
 * met a jour les fiches existantes sans jamais changer leur `id`. C'est ce qui
 * permet a d'autres tables de referencer un trek importe sans craindre qu'un
 * re-import ne casse la reference.
 *
 * Les itineraires crees par les utilisateurs ne sont jamais touches : ils ont
 * les trois colonnes de provenance nulles et n'entrent donc dans aucun
 * conflit.
 */
export async function seedTreks(
  db: Database,
  rows: TrekImportRow[],
): Promise<SeedReport> {
  const { treks } = schema;
  let processed = 0;

  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);

    const inserted = await db
      .insert(treks)
      .values(chunk)
      .onConflictDoUpdate({
        target: [treks.source, treks.sourceInstance, treks.sourceId],
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          distanceMeters: sql`excluded.distance_meters`,
          ascentMeters: sql`excluded.ascent_meters`,
          descentMeters: sql`excluded.descent_meters`,
          durationMinutes: sql`excluded.duration_minutes`,
          difficulty: sql`excluded.difficulty`,
          sourceDifficulty: sql`excluded.source_difficulty`,
          routeType: sql`excluded.route_type`,
          geometry: sql`excluded.geometry`,
          startPoint: sql`excluded.start_point`,
          sourceUrl: sql`excluded.source_url`,
          license: sql`excluded.license`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: treks.id });

    processed += inserted.length;
  }

  return { processed };
}
