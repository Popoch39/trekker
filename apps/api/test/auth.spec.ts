import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AUTH_SECRET,
  startTestDatabase,
  type TestDatabase,
} from './setup/postgres';

/**
 * Chaine d'authentification de bout en bout : inscription, connexion, jeton
 * porteur, et protection des routes metier par le guard global.
 *
 * Postgres jetable et migrations reelles : c'est le seul moyen de verifier que
 * les `id` generes par Better Auth entrent bien dans nos colonnes `uuid`.
 */
@Controller('secret')
class SecretController {
  @Get()
  secret(@Session() session: UserSession): { email: string } {
    return { email: session.user.email };
  }
}

const CREDENTIALS = {
  email: 'randonneur@example.test',
  password: 'motdepasse-de-test-123',
  name: 'Randonneur',
};

/** UUID v7 : version `7` sur le 15e caractere, variant `8|9|a|b` sur le 20e. */
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Authentification', () => {
  let database: TestDatabase;
  let app: NestExpressApplication;

  beforeAll(async () => {
    database = await startTestDatabase();

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = database.connectionString;
    process.env.LOG_LEVEL = 'silent';
    process.env.CORS_ORIGINS = '';
    process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
    // Poses explicitement plutot que laisses aux defauts du schema : le test
    // doit decrire la configuration qu'il exerce, pas en heriter.
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'http://localhost:3000';

    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SecretController],
    }).compile();

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

  it('inscrit un utilisateur avec un identifiant au format du projet', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send(CREDENTIALS);

    expect(response.status).toBe(200);
    // `advanced.database.generateId` : sans lui, l'insert echouerait sur la
    // colonne `uuid`.
    expect(response.body.user.id).toMatch(UUID_V7);
    expect(response.body.user.email).toBe(CREDENTIALS.email);
  });

  it('emet un jeton porteur a la connexion', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password });

    expect(response.status).toBe(200);
    // Plugin `bearer` : c'est ce que consomme l'app mobile, qui n'a pas de jar
    // de cookies.
    expect(response.headers['set-auth-token']).toBeTruthy();
  });

  it('refuse une route metier sans session', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/secret');

    expect(response.status).toBe(401);
  });

  it('accepte une route metier avec un jeton porteur', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password });

    const token = signIn.headers['set-auth-token'];

    const response = await request(app.getHttpServer())
      .get('/api/v1/secret')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ email: CREDENTIALS.email });
  });

  it('laisse la sonde de liveness accessible sans authentification', async () => {
    const response = await request(app.getHttpServer()).get('/health/liveness');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
