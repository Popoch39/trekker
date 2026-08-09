import { runMigrations } from '@repo/db';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export interface TestDatabase {
  connectionString: string;
  stop: () => Promise<void>;
}

/**
 * Demarre un Postgres jetable et y applique les migrations reelles.
 *
 * Aucun mock : les tests s'executent contre le meme moteur et le meme schema
 * qu'en production. Necessite un daemon Docker accessible.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17-alpine',
  )
    .withDatabase('trekker_test')
    .withUsername('trekker')
    .withPassword('trekker')
    .start();

  const connectionString = container.getConnectionUri();

  await runMigrations(connectionString);

  return {
    connectionString,
    stop: async () => {
      await container.stop();
    },
  };
}
