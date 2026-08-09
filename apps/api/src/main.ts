import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { configureApp, GLOBAL_PREFIX } from './configure-app';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Better Auth lit le corps brut de la requete. `AuthModule` remet les
    // parsers JSON / urlencoded pour toutes les routes non-auth.
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));

  configureApp(app);

  // Ferme proprement les modules (pool pg, transports de logs) sur SIGTERM.
  app.enableShutdownHooks();

  const config = app.get(AppConfigService);

  if (!config.isProduction) {
    setupSwagger(app, GLOBAL_PREFIX);
  }

  await app.listen(config.port);
}

void bootstrap();
