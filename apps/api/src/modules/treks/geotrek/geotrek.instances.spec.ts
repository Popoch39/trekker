import { describe, expect, it } from 'vitest';

import { findInstance, GEOTREK_INSTANCES } from './geotrek.instances';

/**
 * La liste blanche est le point ou une erreur devient juridique et non plus
 * technique : ces tests verifient ses invariants, pas seulement qu'elle est
 * lisible.
 */
describe('GEOTREK_INSTANCES', () => {
  it('n est pas vide', () => {
    expect(GEOTREK_INSTANCES.length).toBeGreaterThan(0);
  });

  it('a des cles uniques : elles distinguent les identifiants source', () => {
    const keys = GEOTREK_INSTANCES.map((instance) => instance.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('documente pour chaque instance une licence et ou elle a ete constatee', () => {
    for (const instance of GEOTREK_INSTANCES) {
      expect(instance.license.trim()).not.toBe('');
      expect(instance.publisher.trim()).not.toBe('');
      expect(instance.licenseSourceUrl).toMatch(/^https:\/\//);
    }
  });

  it('pointe des API v2 en https, sans slash final', () => {
    for (const instance of GEOTREK_INSTANCES) {
      expect(instance.apiBaseUrl).toMatch(/^https:\/\/\S+\/api\/v2$/);
    }
  });

  it('expose un site public en https quand il est renseigne', () => {
    const portals = GEOTREK_INSTANCES.map(
      (instance) => instance.portalUrl,
    ).filter((url) => url !== null);

    for (const portal of portals) {
      expect(portal).toMatch(/^https:\/\//);
    }
  });
});

describe('findInstance', () => {
  it('retrouve une instance par sa cle', () => {
    const key = GEOTREK_INSTANCES[0]?.key as string;

    expect(findInstance(key)?.key).toBe(key);
  });

  it('rend undefined sur une cle inconnue', () => {
    expect(findInstance('instance-absente')).toBeUndefined();
  });
});
