import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createDbClient } from '@repo/db';
import { config } from 'dotenv';

import type { TrekImportRow } from '../modules/treks/geotrek/geotrek.types';
import { seedTreks } from './seed-treks';

/**
 * Amorce du script de seed. Volontairement reduite a l'orchestration : toute la
 * logique testable vit dans `seed-treks.ts`.
 *
 *   pnpm --filter api seed [chemin/du/jeu.json]
 *
 * Sans argument, la fixture livree avec l'application est utilisee : le seed
 * fonctionne donc hors ligne, sur un poste neuf comme dans l'image Docker.
 */
const DEFAULT_DATASET = path.resolve(__dirname, '../data/treks.fixture.json');

async function main(): Promise<void> {
  // `.env` unique de la racine du monorepo. En environnement deploye il
  // n'existe pas et les variables sont deja presentes : dotenv n'ecrase rien.
  config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL est absente. Copier .env.example en .env a la racine du repo.',
    );
  }

  const dataset = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_DATASET;

  const rows = JSON.parse(await readFile(dataset, 'utf8')) as TrekImportRow[];
  const client = createDbClient({ connectionString });

  try {
    const { processed } = await seedTreks(client.db, rows);

    process.stdout.write(`${processed} itineraires seedes depuis ${dataset}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
