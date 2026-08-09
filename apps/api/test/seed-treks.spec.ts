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
