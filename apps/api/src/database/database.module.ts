import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createDbClient, type DbClient } from '@repo/db';

import { AppConfigService } from '../config/app-config.service';
import { DATABASE, DATABASE_CLIENT } from './database.tokens';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): DbClient =>
        createDbClient({ connectionString: config.databaseUrl }),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CLIENT],
      useFactory: (client: DbClient) => client.db,
    },
  ],
  exports: [DATABASE, DATABASE_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: DbClient) {}

  /** Ferme le pool pg au shutdown pour ne pas laisser de connexions ouvertes. */
  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
