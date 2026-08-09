import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';

import { DATABASE_CLIENT, type DbClient } from '../database/database.tokens';

/** Verifie que Postgres repond, via une vraie requete sur le pool. */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(DATABASE_CLIENT) private readonly client: DbClient,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.client.pool.query('SELECT 1');

      return indicator.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Base de donnees injoignable';

      return indicator.down({ message });
    }
  }
}
