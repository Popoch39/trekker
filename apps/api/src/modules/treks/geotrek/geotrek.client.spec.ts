import { describe, expect, it, vi } from 'vitest';

import { GeotrekApiError, GeotrekClient } from './geotrek.client';

const BASE = 'https://exemple.test/api/v2';

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

const errorResponse = (status: number): Response =>
  ({
    ok: false,
    status,
    json: async () => ({}),
  }) as Response;

const page = (results: unknown[], next: string | null = null) => ({
  count: results.length,
  next,
  results,
});

const rawTrek = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Un trek',
  length_2d: 1000,
  geometry: {
    type: 'LineString',
    coordinates: [
      [6, 44],
      [6.1, 44.1],
    ],
  },
  ...overrides,
});

describe('GeotrekClient.fetchTreks', () => {
  it('suit le lien next jusqu a epuisement des pages', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(page([rawTrek({ id: 1 })], `${BASE}/trek/?page=2`)),
      )
      .mockResolvedValueOnce(jsonResponse(page([rawTrek({ id: 2 })])));

    const client = new GeotrekClient({ fetchFn });
    const { treks, skipped } = await client.fetchTreks(BASE);

    expect(treks.map((trek) => trek.id)).toEqual([1, 2]);
    expect(skipped).toBe(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[0]).toBe(`${BASE}/trek/?page=2`);
  });

  it('ecarte et compte les enregistrements hors schema', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        page([
          rawTrek({ id: 1 }),
          // Geometrie multiple : hors de ce que la table sait stocker.
          rawTrek({
            id: 2,
            geometry: { type: 'MultiLineString', coordinates: [] },
          }),
          { id: 3 },
        ]),
      ),
    );

    const { treks, skipped } = await new GeotrekClient({ fetchFn }).fetchTreks(
      BASE,
    );

    expect(treks.map((trek) => trek.id)).toEqual([1]);
    expect(skipped).toBe(2);
  });

  it('ecarte et compte les treks non publies', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          page([rawTrek({ id: 1, published: false }), rawTrek({ id: 2 })]),
        ),
      );

    const { treks, skipped } = await new GeotrekClient({ fetchFn }).fetchTreks(
      BASE,
    );

    expect(treks.map((trek) => trek.id)).toEqual([2]);
    expect(skipped).toBe(1);
  });

  it('leve une erreur explicite sur une reponse non 2xx', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(errorResponse(503));

    await expect(
      new GeotrekClient({ fetchFn }).fetchTreks(BASE),
    ).rejects.toThrow(GeotrekApiError);
  });

  it('leve une erreur si l enveloppe de pagination est invalide', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ oups: true }));

    await expect(
      new GeotrekClient({ fetchFn }).fetchTreks(BASE),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('GeotrekClient.fetchReferentials', () => {
  it('indexe les difficultes et les types de parcours par identifiant', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(page([{ id: 4, label: 'Difficile', cirkwi_level: 4 }])),
      )
      .mockResolvedValueOnce(jsonResponse(page([{ id: 1, route: 'Boucle' }])));

    const referentials = await new GeotrekClient({ fetchFn }).fetchReferentials(
      BASE,
    );

    expect(referentials.difficulties.get(4)?.label).toBe('Difficile');
    expect(referentials.routes.get(1)?.route).toBe('Boucle');
  });
});

describe('GeotrekClient', () => {
  it('utilise le fetch global par defaut', async () => {
    const globalFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(page([])));

    await new GeotrekClient().fetchTreks(BASE);

    expect(globalFetch).toHaveBeenCalledOnce();
    globalFetch.mockRestore();
  });
});
