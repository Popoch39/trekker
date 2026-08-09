import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDbClient } from './client';

/**
 * Dossier des migrations SQL generees par `drizzle-kit generate`.
 * Resolu depuis ce fichier pour rester valide en source (tsx) comme en
 * compile (`dist/`), y compris depuis `node_modules` dans l'image Docker.
 */
export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../drizzle');

/**
 * Applique les migrations en attente puis ferme la connexion.
 *
 * Volontairement decouple du bootstrap de l'API : les migrations sont jouees
 * par un script dedie (`pnpm db:migrate`) ou une etape de deploiement.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const client = createDbClient({ connectionString, max: 1 });

  try {
    await migrate(client.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  const { config } = await import('dotenv');
  config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL est absente. Copier .env.example en .env a la racine du repo.',
    );
  }

  await runMigrations(connectionString);
  console.log('Migrations appliquees.');
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
