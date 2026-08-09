import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';

import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';
import { DATABASE, type Database } from '../database/database.tokens';
import { createAuth } from './auth.config';

/**
 * Cable Better Auth sur l'application.
 *
 * `BetterAuthModule` enregistre un `AuthGuard` global : toute route Nest exige
 * une session, sauf `@AllowAnonymous()` / `@OptionalAuth()`. Ferme par defaut :
 * oublier une exception casse bruyamment, oublier un `@UseGuards` exposerait
 * silencieusement.
 */
@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [DATABASE, AppConfigService],
      useFactory: (db: Database, config: AppConfigService) => ({
        auth: createAuth({ db, ...config.auth }),
        // Le CORS reste decide au seul endroit qui le decide deja
        // (`configure-app.ts`, via `CORS_ORIGINS`). Sans ca la librairie empile
        // un second middleware `cors` a partir de `trustedOrigins`, et les deux
        // ecrivent les memes en-tetes.
        disableTrustedOriginsCors: true,
      }),
    }),
  ],
})
export class AuthModule {}
