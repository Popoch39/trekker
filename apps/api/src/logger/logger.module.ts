import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';

/**
 * Logs structures JSON via pino, avec un identifiant de correlation par
 * requete (`requestId`, repris dans les reponses d'erreur problem+json).
 *
 * Les en-tetes sensibles sont expurges : ils ne doivent jamais atterrir dans
 * un agregateur de logs.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req, res) => {
            const existing = req.headers['x-request-id'];
            const id =
              typeof existing === 'string' && existing.length > 0
                ? existing
                : randomUUID();

            res.setHeader('x-request-id', id);

            return id;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["set-cookie"]',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
          autoLogging: {
            // Le bruit des sondes de sante n'a aucune valeur en observabilite.
            ignore: (req) => req.url?.startsWith('/health') ?? false,
          },
          // JSON en production, sortie lisible en local.
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  translateTime: 'SYS:HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
