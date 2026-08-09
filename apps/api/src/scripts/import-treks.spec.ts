import { describe, expect, it, vi } from 'vitest';

import type { GeotrekClient } from '../modules/treks/geotrek/geotrek.client';
import {
  GEOTREK_INSTANCES,
  type GeotrekInstance,
} from '../modules/treks/geotrek/geotrek.instances';
import type { GeotrekTrek } from '../modules/treks/geotrek/geotrek.types';
import { importTreks } from './import-treks';

const instance = (key: string): GeotrekInstance => ({
  key,
  apiBaseUrl: `https://${key}.test/api/v2`,
  publisher: `Publicateur ${key}`,
  license: 'Licence Ouverte / Open Licence 2.0',
  licenseSourceUrl: 'https://exemple.test/licence',
  portalUrl: `https://${key}.test`,
});

const trek = (id: number): GeotrekTrek => ({
  id,
  name: `Itineraire ${id}`,
  length_2d: 1000,
  difficulty: 1,
  route: 1,
  geometry: {
    type: 'LineString',
    coordinates: [
      [6, 44],
      [6.1, 44.1],
    ],
  },
});

const stubClient = (overrides: Partial<GeotrekClient> = {}): GeotrekClient =>
  ({
    fetchReferentials: vi.fn().mockResolvedValue({
      difficulties: new Map([[1, { id: 1, label: 'Facile' }]]),
      routes: new Map([[1, { id: 1, route: 'Boucle' }]]),
    }),
    fetchTreks: vi.fn().mockResolvedValue({ treks: [trek(1)], skipped: 0 }),
    ...overrides,
  }) as unknown as GeotrekClient;

describe('importTreks', () => {
  it('produit une ligne par trek et un rapport par instance', async () => {
    const client = stubClient({
      fetchTreks: vi.fn().mockResolvedValue({
        treks: [trek(1), trek(2)],
        skipped: 3,
      }),
    } as Partial<GeotrekClient>);

    const { rows, reports } = await importTreks({
      client,
      instances: [instance('ecrins'), instance('cevennes')],
    });

    expect(rows).toHaveLength(4);
    expect(rows[0]?.sourceInstance).toBe('ecrins');
    expect(rows[0]?.license).toBe('Licence Ouverte / Open Licence 2.0');
    expect(rows[3]?.sourceInstance).toBe('cevennes');
    expect(reports).toEqual([
      { instance: 'ecrins', imported: 2, skipped: 3 },
      { instance: 'cevennes', imported: 2, skipped: 3 },
    ]);
  });

  it('trace la progression quand un journal est fourni', async () => {
    const log = vi.fn();

    await importTreks({
      client: stubClient(),
      instances: [instance('ecrins')],
      log,
    });

    expect(log).toHaveBeenCalledWith('Import de ecrins...');
    expect(log).toHaveBeenCalledWith('  1 itineraires, 0 ecartes.');
  });

  it('poursuit les autres instances quand l une echoue, et le signale', async () => {
    const log = vi.fn();
    const client = stubClient({
      fetchReferentials: vi
        .fn()
        .mockRejectedValueOnce(new Error('503 sur la premiere'))
        .mockResolvedValue({ difficulties: new Map(), routes: new Map() }),
    } as Partial<GeotrekClient>);

    const { rows, reports } = await importTreks({
      client,
      instances: [instance('indisponible'), instance('ecrins')],
      log,
    });

    expect(rows).toHaveLength(1);
    expect(reports[0]).toEqual({
      instance: 'indisponible',
      imported: 0,
      skipped: 0,
    });
    expect(reports[1]).toEqual({ instance: 'ecrins', imported: 1, skipped: 0 });
    expect(log).toHaveBeenCalledWith('  Echec : 503 sur la premiere');
  });

  it('signale aussi un echec qui n est pas une Error', async () => {
    const log = vi.fn();
    const client = stubClient({
      fetchReferentials: vi.fn().mockRejectedValue('panne brute'),
    } as Partial<GeotrekClient>);

    await importTreks({ client, instances: [instance('ecrins')], log });

    expect(log).toHaveBeenCalledWith('  Echec : panne brute');
  });

  it('retombe sur la liste blanche du projet quand aucune instance n est passee', async () => {
    // Le client factice echoue immediatement : la liste reelle est parcourue,
    // mais aucun appel reseau n'a lieu.
    const client = stubClient({
      fetchReferentials: vi.fn().mockRejectedValue(new Error('hors ligne')),
    } as Partial<GeotrekClient>);

    const { rows, reports } = await importTreks({ client });

    expect(rows).toHaveLength(0);
    expect(reports.map((report) => report.instance)).toEqual(
      GEOTREK_INSTANCES.map((known) => known.key),
    );
  });

  it('construit un client par defaut sans l utiliser quand il n y a rien a importer', async () => {
    expect(await importTreks({ instances: [] })).toEqual({
      rows: [],
      reports: [],
    });
  });
});
