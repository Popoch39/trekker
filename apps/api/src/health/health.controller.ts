import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { DatabaseHealthIndicator } from './database.health';

/**
 * Sondes destinees a l'orchestrateur (Docker, k8s), hors prefixe `/api` et
 * hors versionnement : leur URL ne doit jamais changer.
 *
 * `@AllowAnonymous()` n'est pas cosmetique : l'`AuthGuard` est global, sans
 * cette exception les sondes repondent 401 et l'orchestrateur redemarre
 * l'application en boucle.
 */
@ApiExcludeController()
@AllowAnonymous()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Le process est vivant. Ne touche a aucune dependance externe. */
  @Get('liveness')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /** Le service peut traiter du trafic : la base repond. */
  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.database.isHealthy('database')]);
  }
}
