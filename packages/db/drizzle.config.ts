import path from 'node:path';

import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Le `.env` unique vit a la racine du monorepo.
config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DATABASE_URL est absente. Copier .env.example en .env a la racine du repo.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url },
  casing: 'snake_case',
  // Exclut les tables systeme de PostGIS (`spatial_ref_sys`, `geometry_columns`)
  // des diffs : sans ca, `introspect` et `push` proposent de les supprimer.
  extensionsFilters: ['postgis'],
  verbose: true,
  strict: true,
});
