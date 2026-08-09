import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { DatabaseHealthIndicator } from './database.health';

/**
 * Sondes destinees a l'orchestrateur (Docker, k8s), hors prefixe `/api` et
 * hors versionnement : leur URL ne doit jamais changer.
 */
@ApiExcludeController()
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
