import type { Database, DbClient } from '@repo/db';

/**
 * Instance Drizzle a injecter dans les services :
 *
 *   constructor(@Inject(DATABASE) private readonly db: Database) {}
 */
export const DATABASE = Symbol('DATABASE');

/** Client complet (pool + db + close), utile pour le healthcheck. */
export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export type { Database, DbClient };
