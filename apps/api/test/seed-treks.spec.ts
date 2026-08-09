import { createDbClient, schema, type DbClient } from '@repo/db';
import { asc, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedTreks } from '../src/scripts/seed-treks';
import { startTestDatabase, type TestDatabase } from './setup/postgres';
import { TREKS_FIXTURE } from './setup/treks-fixture';

/**
 * L'idempotence du seed est une propriete verifiee, pas une intention : d'autres
 * tables referenceront les treks importes, et un `id` qui change au re-import
 * casserait ces references en silence.
 */
describe('seedTreks', () => {
  let database: TestDatabase;
  let client: DbClient;

  /**
   * Nom de la contrainte violee par une insertion, ou `null` si elle passe.
   *
   * Drizzle enveloppe l'erreur du driver : le nom ne figure pas dans le message
   * mais dans `cause.constraint`, et l'assertion doit viser la contrainte
   * precise — sinon un test reste vert parce qu'une *autre* regle a refuse la
   * ligne.
   */
  const violatedConstraint = async (
    overrides: Partial<typeof schema.treks.$inferInsert> &
      Pick<typeof schema.treks.$inferInsert, 'name' | 'source'>,
  ): Promise<string | null> => {
    const failure = await client.db
      .insert(schema.treks)
      .values({
        distanceMeters: 4_200,
        geometry: {
          type: 'LineString',
          coordinates: [
            [6.3, 44.9],
            [6.31, 44.91],
          ],
        },
        startPoint: { type: 'Point', coordinates: [6.3, 44.9] },
        ...overrides,
      })
      .then(() => null)
      .catch((error: unknown) => error);

    return (
      (failure as { cause?: { constraint?: string } } | null)?.cause
        ?.constraint ?? null
    );
  };

  const snapshot = () =>
    client.db
      .select({ id: schema.treks.id, sourceId: schema.treks.sourceId })
      .from(schema.treks)
      .orderBy(asc(schema.treks.sourceId));

  beforeAll(async () => {
    database = await startTestDatabase();
    client = createDbClient({ connectionString: database.connectionString });
  });

  afterAll(async () => {
    await client?.close();
    await database?.stop();
  });

  it('insere les itineraires au premier passage', async () => {
    const { processed } = await seedTreks(client.db, TREKS_FIXTURE);

    expect(processed).toBe(TREKS_FIXTURE.length);
    expect(await snapshot()).toHaveLength(TREKS_FIXTURE.length);
  });

  it('rejoue sans creer de doublon ni changer les identifiants', async () => {
    const before = await snapshot();

    await seedTreks(client.db, TREKS_FIXTURE);

    expect(await snapshot()).toEqual(before);
  });

  it('met a jour les fiches existantes plutot que de les ignorer', async () => {
    const renamed = TREKS_FIXTURE.map((row) =>
      row.sourceId === '1'
        ? { ...row, name: 'Boucle du Lautaret (revisee)' }
        : row,
    );

    await seedTreks(client.db, renamed);

    const [updated] = await client.db
      .select({ name: schema.treks.name })
      .from(schema.treks)
      .where(sql`${schema.treks.sourceId} = '1'`);

    expect(updated?.name).toBe('Boucle du Lautaret (revisee)');
  });

  it('ne touche pas aux itineraires crees par un utilisateur', async () => {
    await client.db.insert(schema.treks).values({
      name: 'Ma sortie perso',
      distanceMeters: 4_200,
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.3, 44.9],
          [6.31, 44.91],
        ],
      },
      startPoint: { type: 'Point', coordinates: [6.3, 44.9] },
      source: 'user',
    });

    await seedTreks(client.db, TREKS_FIXTURE);

    const [{ total } = { total: 0 }] = await client.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.treks)
      .where(sql`${schema.treks.source} = 'user'`);

    expect(total).toBe(1);
  });

  /**
   * L'index unique de provenance ne contraint rien tant qu'une colonne du
   * triplet peut etre nulle : deux NULL ne s'opposent pas en Postgres, et
   * chaque seed recreerait la ligne au lieu de la mettre a jour. La garde est
   * donc en base, pas seulement dans le mapper.
   */
  it('refuse un trek importe sans reference de source', async () => {
    expect(
      await violatedConstraint({
        name: 'Import sans reference',
        source: 'geotrek',
      }),
    ).toBe('treks_source_ref_check');
  });

  it('refuse une mesure negative', async () => {
    expect(
      await violatedConstraint({
        name: 'Distance negative',
        distanceMeters: -1,
        source: 'user',
      }),
    ).toBe('treks_measures_check');
  });

  it('accepte un lot vide', async () => {
    expect(await seedTreks(client.db, [])).toEqual({ processed: 0 });
  });

  it('traite les lots au-dela de la taille de decoupage', async () => {
    const many = Array.from({ length: 250 }, (_, index) => ({
      ...(TREKS_FIXTURE[0] as (typeof TREKS_FIXTURE)[number]),
      name: `Itineraire en lot ${index}`,
      sourceInstance: 'lot',
      sourceId: String(index),
    }));

    expect(await seedTreks(client.db, many)).toEqual({ processed: 250 });
  });
});
