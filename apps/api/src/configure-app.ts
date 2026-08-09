import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';

import { AppConfigService } from './config/app-config.service';

/** Prefixe commun a toutes les routes metier. */
export const GLOBAL_PREFIX = 'api';

/**
 * Sondes de l'orchestrateur : hors prefixe et hors versionnement, leur URL ne
 * doit jamais changer.
 */
const PREFIX_EXCLUDE = ['health/liveness', 'health/readiness'];

/**
 * Configuration commune a l'application qui tourne (`main.ts`) et a celle des
 * tests.
 *
 * Elle est partagee et non dupliquee : sans ca les tests valident une
 * application qui n'est pas celle qui sert le trafic, et la divergence ne se
 * voit qu'en production.
 *
 * Attention : `bodyParser: false` est une option de `NestFactory.create` /
 * `createNestApplication`, elle ne peut pas etre posee ici. Elle doit etre
 * passee par chaque appelant.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfigService);

  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDE });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
