import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export interface DbClient {
  db: Database;
  pool: Pool;
  /** Ferme le pool. A appeler au shutdown de l'application. */
  close: () => Promise<void>;
}

export interface CreateDbClientOptions extends Omit<
  PoolConfig,
  'connectionString'
> {
  /** Chaine de connexion Postgres (`DATABASE_URL`). */
  connectionString: string;
}

/**
 * Cree un pool `pg` et l'instance Drizzle associee.
 *
 * Aucune migration n'est appliquee ici : elles sont jouees par le script
 * `db:migrate`, jamais au demarrage de l'application.
 */
export function createDbClient(options: CreateDbClientOptions): DbClient {
  const pool = new Pool({
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...options,
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}
