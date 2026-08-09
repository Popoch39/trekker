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
        'Tour du lac',
        'Tour du lac',
        'Traversee du Champsaur',
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
        total: TREKS_FIXTURE.length,
        totalPages: 4,
      });
      expect(second.body.data[0].name).toBe('Col du Galibier');
    });

    /**
     * Le vrai test de la pagination : deux itineraires homonymes partagent la
     * cle de tri, et seul un depart stable empeche l'un de sortir deux fois
     * pendant que l'autre est saute. Une page par ligne maximise les occasions
     * de le prendre en defaut.
     */
    it('ne perd ni ne duplique de ligne quand la cle de tri est ex aequo', async () => {
      const pages = await Promise.all(
        Array.from({ length: TREKS_FIXTURE.length }, (_unused, index) =>
          list(`?page=${index + 1}&pageSize=1`),
        ),
      );

      const ids = pages.flatMap((page) =>
        page.body.data.map((trek: { id: string }) => trek.id),
      );

      expect(ids).toHaveLength(TREKS_FIXTURE.length);
      expect(new Set(ids).size).toBe(TREKS_FIXTURE.length);
    });

    it('departage aussi les ex aequo du tri par distance', async () => {
      const query = '?lat=44.93&lon=6.29&radiusKm=50&pageSize=1';

      const pages = await Promise.all([
        list(`${query}&page=1`),
        list(`${query}&page=2`),
        list(`${query}&page=3`),
        list(`${query}&page=4`),
        list(`${query}&page=5`),
        list(`${query}&page=6`),
      ]);

      const ids = pages.flatMap((page) =>
        page.body.data.map((trek: { id: string }) => trek.id),
      );

      expect(new Set(ids).size).toBe(6);
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
      // Le sentier littoral, a plusieurs centaines de kilometres, est exclu ;
      // la traversee du Champsaur aussi, car seul son depart compte ici.
      expect(response.body.meta.total).toBe(6);

      const names = response.body.data.map(
        (trek: { name: string }) => trek.name,
      );

      expect(names).not.toContain('Sentier littoral');
      expect(names).not.toContain('Traversee du Champsaur');
    });

    it('elargit la proximite a la trace entiere avec matchOn=trace', async () => {
      const response = await list(
        '?lat=44.93&lon=6.29&radiusKm=50&matchOn=trace',
      );

      expect(response.status).toBe(200);
      // La traversee demarre hors rayon mais y revient : elle repond a « quels
      // itineraires passent pres d ici », pas a « lesquels partent d ici ».
      expect(response.body.meta.total).toBe(7);
      expect(
        response.body.data.map((trek: { name: string }) => trek.name),
      ).toContain('Traversee du Champsaur');
    });

    it('filtre par cadre de carte', async () => {
      const response = await list('?bbox=6.0,44.5,6.8,45.2');

      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(6);
      expect(
        response.body.data.map((trek: { name: string }) => trek.name),
      ).not.toContain('Sentier littoral');
    });

    it('etend le cadre de carte a la trace avec matchOn=trace', async () => {
      const response = await list('?bbox=6.0,44.5,6.8,45.2&matchOn=trace');

      expect(response.body.meta.total).toBe(7);
      expect(
        response.body.data.map((trek: { name: string }) => trek.name),
      ).toContain('Traversee du Champsaur');
    });

    it('refuse un cadre de carte combine a une recherche par proximite', async () => {
      const response = await list(
        '?bbox=6.0,44.5,6.8,45.2&lat=44.93&lon=6.29&radiusKm=50',
      );

      expect(response.status).toBe(422);
    });

    it('refuse un cadre de carte aux coins inverses', async () => {
      expect((await list('?bbox=6.8,45.2,6.0,44.5')).status).toBe(422);
    });

    it('refuse un cadre de carte incomplet', async () => {
      expect((await list('?bbox=6.0,44.5')).status).toBe(422);
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

    /**
     * `z.coerce.number()` rend `0` pour une chaine vide : sans prefiltre, cette
     * requete decrirait une recherche autour du point (0, 0) — au large du
     * golfe de Guinee — et rendrait une liste vide que le client prendrait pour
     * « aucun itineraire pres de vous ».
     */
    it('traite un parametre vide comme absent plutot que comme zero', async () => {
      const response = await list('?lat=&lon=&radiusKm=10');

      expect(response.status).toBe(422);
    });

    it('ignore des bornes de distance vides', async () => {
      const response = await list('?minDistanceMeters=&maxDistanceMeters=');

      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(TREKS_FIXTURE.length);
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

    /**
     * Six decimales valent une dizaine de centimetres, un ordre de grandeur
     * sous la precision d'un GPS de randonnee. Les neuf decimales par defaut de
     * `ST_AsGeoJSON` ne transportent que du bruit, facture au client mobile.
     */
    it('arrondit les coordonnees a six decimales', async () => {
      const [summary] = (await list('?bbox=7.0,44.5,7.2,45.2')).body.data;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/treks/${summary.id}`)
        .set('authorization', `Bearer ${token}`);

      expect(response.body.name).toBe('Traversee du Champsaur');
      expect(response.body.geometry.coordinates[1]).toEqual([
        6.712346, 44.951235,
      ]);
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
