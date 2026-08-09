import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { setupSwagger } from './swagger';

/** Prefixe et version communs a toutes les routes metier. */
const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);

  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
  });

  // `/health/*` reste hors prefixe et hors versionnement : les sondes de
  // l'orchestrateur ne doivent pas suivre les versions de l'API.
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: ['health/liveness', 'health/readiness'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Ferme proprement les modules (pool pg, transports de logs) sur SIGTERM.
  app.enableShutdownHooks();

  if (!config.isProduction) {
    setupSwagger(app, GLOBAL_PREFIX);
  }

  await app.listen(config.port);
}

void bootstrap();
