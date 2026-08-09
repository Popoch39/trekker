import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { AuthModule } from './auth/auth.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';
import { TreksModule } from './modules/treks/treks.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [config.throttle],
      }),
    }),
    // Enregistre un `AuthGuard` global : toute route ci-dessous exige une
    // session sauf `@AllowAnonymous()`. A garder avant les modules metier.
    AuthModule,
    HealthModule,
    // Modules metier, un dossier par feature sous `modules/`.
    TreksModule,
  ],
  providers: [
    // Validation Zod globale : chaque DTO cree via `createZodDto` est valide
    // automatiquement, sans pipe a declarer dans les controleurs.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Rate limiting global, par IP.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Toutes les erreurs sortent en RFC 9457.
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
