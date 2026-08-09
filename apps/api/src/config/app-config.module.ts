import path from 'node:path';

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';

/** Chemin du `.env` unique, a la racine du monorepo. */
const ROOT_ENV_PATH = path.resolve(__dirname, '../../../../.env');

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // En production les variables viennent de l'environnement du conteneur.
      // En test elles sont posees par la suite elle-meme : lire le `.env` du
      // poste rendrait les tests dependants d'une configuration locale.
      ignoreEnvFile:
        process.env.NODE_ENV === 'production' ||
        process.env.NODE_ENV === 'test',
      envFilePath: ROOT_ENV_PATH,
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
