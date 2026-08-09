import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AUTH_SECRET,
  startTestDatabase,
  type TestDatabase,
} from './setup/postgres';

/**
 * Test de plomberie : Postgres jetable, migrations reelles, application Nest
 * complete. Il valide la chaine config -> pool pg -> Drizzle -> sonde de
 * readiness, et le format d'erreur RFC 9457.
 */
/**
 * Route factice : les guards globaux (dont le rate limiting) ne s'executent
 * que sur une route effectivement resolue. Les sondes de sante etant
 * volontairement exclues du throttling, il faut une vraie route pour le
 * verifier tant qu'aucun module metier n'existe.
 */
@AllowAnonymous()
@Controller('ping')
class PingController {
  @Get()
  ping(): { pong: true } {
    return { pong: true };
  }
}

const THROTTLE_LIMIT = 5;

describe('Socle applicatif', () => {
  let database: TestDatabase;
  let app: NestExpressApplication;

  beforeAll(async () => {
    database = await startTestDatabase();

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = database.connectionString;
    process.env.LOG_LEVEL = 'silent';
    process.env.CORS_ORIGINS = '';
    process.env.THROTTLE_LIMIT = String(THROTTLE_LIMIT);
    process.env.BETTER_AUTH_SECRET = AUTH_SECRET;

    // Import differe : `ConfigModule.forRoot()` valide l'environnement des
    // l'evaluation du module, donc apres seulement que les variables ci-dessus
    // soient posees.
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PingController],
    }).compile();

    // Meme configuration que `main.ts`, y compris `bodyParser: false` que
    // `AuthModule` compense pour les routes non-auth.
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    configureApp(app);

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it('repond a la sonde de liveness sans toucher a la base', async () => {
    const response = await request(app.getHttpServer()).get('/health/liveness');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('declare la base comme disponible sur la sonde de readiness', async () => {
    const response = await request(app.getHttpServer()).get(
      '/health/readiness',
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.details.database.status).toBe('up');
  });

  it('renvoie les erreurs au format problem+json', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/route-inexistante',
    );

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/api/v1/route-inexistante',
    });
  });

  it('applique le rate limiting global au-dela du quota', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < THROTTLE_LIMIT; i += 1) {
      const allowed = await request(server).get('/api/v1/ping');
      expect(allowed.status).toBe(200);
    }

    const blocked = await request(server).get('/api/v1/ping');

    expect(blocked.status).toBe(429);
    expect(blocked.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(blocked.body).toMatchObject({
      title: 'Too Many Requests',
      status: 429,
    });
  });
});
