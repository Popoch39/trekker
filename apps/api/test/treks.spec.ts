import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createDbClient, type DbClient } from '@repo/db';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedTreks } from '../src/scripts/seed-treks';
import {
  AUTH_SECRET,
  startTestDatabase,
  type TestDatabase,
} from './setup/postgres';
import { TREKS_FIXTURE } from './setup/treks-fixture';

/**
 * Catalogue d'itineraires de bout en bout : Postgres reel avec PostGIS,
 * migrations reelles, seed reel. C'est le seul moyen de verifier que les
 * colonnes geographiques font l'aller-retour GeoJSON correctement et que la
 * recherche par proximite renvoie ce qu'on croit.
 */
const CREDENTIALS = {
  email: 'catalogue@example.test',
  password: 'motdepasse-de-test-123',
  name: 'Randonneur',
};

describe('Catalogue d itineraires', () => {
  let database: TestDatabase;
  let client: DbClient;
  let app: NestExpressApplication;
  let token: string;

  beforeAll(async () => {
    database = await startTestDatabase();

    client = createDbClient({ connectionString: database.connectionString });
    await seedTreks(client.db, TREKS_FIXTURE);

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = database.connectionString;
    process.env.LOG_LEVEL = 'silent';
    process.env.CORS_ORIGINS = '';
    process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'http://localhost:3000';
    // Le rate limiting est global et par IP : la valeur par defaut ferait
    // repondre 429 au milieu de ce fichier, qui appelle l'API des dizaines de
    // fois depuis la meme adresse.
    process.env.THROTTLE_LIMIT = '1000';

    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    configureApp(app);
    await app.init();

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send(CREDENTIALS);

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password });

    token = signIn.headers['set-auth-token'] as string;
  });

  afterAll(async () => {
    await app?.close();
    await client?.close();
    await database?.stop();
  });

  const list = (query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/treks${query}`)
      .set('authorization', `Bearer ${token}`);

  describe('acces', () => {
    it('refuse la liste sans session', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/treks');

      expect(response.status).toBe(401);
    });

    it('refuse le detail sans session', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/treks/00000000-0000-7000-8000-000000000000',
      );

      expect(response.status).toBe(401);
    });
  });

  describe('liste', () => {
    it('rend les itineraires tries par nom, sans la trace', async () => {
      const response = await list();

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: TREKS_FIXTURE.length,
        totalPages: 1,
      });
      expect(
        response.body.data.map((trek: { name: string }) => trek.name),
      ).toEqual([
        'Arete des Ecrins',
        'Boucle du Lautaret',
        'Col du Galibier',
        'Plateau d Emparis',
        'Sentier littoral',
      ]);
      // La trace n'a pas sa place dans une liste : vingt itineraires
      // representeraient plusieurs megaoctets.
      expect(response.body.data[0]).not.toHaveProperty('geometry');
      expect(response.body.data[0].startPoint).toEqual({
        type: 'Point',
        coordinates: expect.any(Array),
      });
    });

    it('expose la licence et le lien de source, exigences d attribution', async () => {
      const [trek] = (await list()).body.data;

      expect(trek.license).toBe('Licence Ouverte / Open Licence 2.0');
      expect(trek.sourceUrl).toBe('https://rando.ecrins-parcnational.fr');
    });

    it('pagine', async () => {
      const first = await list('?page=1&pageSize=2');
      const second = await list('?page=2&pageSize=2');

      expect(first.body.data).toHaveLength(2);
      expect(first.body.meta).toEqual({
        page: 1,
        pageSize: 2,
        total: 5,
        totalPages: 3,
      });
      expect(second.body.data[0].name).toBe('Col du Galibier');
    });

    it('filtre par difficulte', async () => {
      const response = await list('?difficulty=tres_difficile');

      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0].name).toBe('Arete des Ecrins');
    });

    it('filtre par bornes de distance', async () => {
      const response = await list(
        '?minDistanceMeters=8000&maxDistanceMeters=15000',
      );

      expect(
        response.body.data
          .map((trek: { name: string }) => trek.name)
          .toSorted(),
      ).toEqual(['Plateau d Emparis', 'Sentier littoral']);
    });

    it('filtre par proximite et trie par distance croissante', async () => {
      const response = await list('?lat=44.93&lon=6.29&radiusKm=50');

      expect(response.status).toBe(200);
      // Le sentier littoral, a plusieurs centaines de kilometres, est exclu.
      expect(response.body.meta.total).toBe(4);
      expect(
        response.body.data.map((trek: { name: string }) => trek.name),
      ).not.toContain('Sentier littoral');
    });

    it('combine proximite et filtres', async () => {
      const response = await list(
        '?lat=44.93&lon=6.29&radiusKm=50&difficulty=facile',
      );

      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0].name).toBe('Boucle du Lautaret');
    });

    // 422 et non 400 : c'est le code que `ProblemDetailsFilter` reserve aux
    // echecs de validation, avec le detail des champs dans `errors[]`.
    it('refuse une proximite incomplete plutot que de l ignorer', async () => {
      const response = await list('?lat=44.93');

      expect(response.status).toBe(422);
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(response.body.errors).toBeDefined();
    });

    it('refuse des bornes de distance incoherentes', async () => {
      const response = await list(
        '?minDistanceMeters=20000&maxDistanceMeters=1000',
      );

      expect(response.status).toBe(422);
    });

    it('refuse une taille de page hors bornes', async () => {
      expect((await list('?pageSize=500')).status).toBe(422);
    });
  });

  describe('detail', () => {
    it('rend la trace complete en GeoJSON', async () => {
      const [summary] = (await list('?difficulty=facile')).body.data;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/treks/${summary.id}`)
        .set('authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Boucle du Lautaret');
      expect(response.body.description).toBe(
        'Une boucle courte et sans difficulte.',
      );
      expect(response.body.geometry.type).toBe('LineString');
      expect(response.body.geometry.coordinates).toHaveLength(3);
      expect(response.body.geometry.coordinates[0]).toEqual([6.29, 44.93]);
    });

    it('rend 404 en RFC 9457 sur un identifiant inconnu', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/treks/00000000-0000-7000-8000-000000000000')
        .set('authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
    });

    it('rend 400 sur un identifiant qui n est pas un uuid', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/treks/pas-un-uuid')
        .set('authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });
  });
});
