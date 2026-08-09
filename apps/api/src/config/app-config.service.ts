import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';

/**
 * Acces type a la configuration validee.
 *
 * Les modules injectent ce service plutot que `ConfigService` brut : les
 * valeurs sont deja parsees (nombres, tableaux) et le typage est exact.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.get('PORT');
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS');
  }

  get throttle(): { ttl: number; limit: number } {
    return {
      ttl: this.get('THROTTLE_TTL'),
      limit: this.get('THROTTLE_LIMIT'),
    };
  }

  get auth(): { secret: string; baseUrl: string; trustedOrigins: string[] } {
    return {
      secret: this.get('BETTER_AUTH_SECRET'),
      baseUrl: this.get('BETTER_AUTH_URL'),
      trustedOrigins: this.get('BETTER_AUTH_TRUSTED_ORIGINS'),
    };
  }
}
