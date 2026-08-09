import { describe, expect, it } from 'vitest';

import type { GeotrekInstance } from './geotrek.instances';
import {
  htmlToPlainText,
  normalizeLabel,
  toDescription,
  toDifficulty,
  toGeometry,
  toRouteType,
  toStartPoint,
  toTrekRow,
} from './geotrek.mapper';
import type { GeotrekReferentials, GeotrekTrek } from './geotrek.types';

const instance: GeotrekInstance = {
  key: 'ecrins',
  apiBaseUrl: 'https://exemple.test/api/v2',
  publisher: 'Parc national des Ecrins',
  license: 'Licence Ouverte / Etalab 2.0',
  licenseSourceUrl: 'https://exemple.test/licence',
  portalUrl: 'https://exemple.test',
};

const referentials = (): GeotrekReferentials => ({
  // Libelles releves sur les quatre instances de la liste blanche.
  difficulties: new Map([
    [1, { id: 1, label: 'Très facile' }],
    [2, { id: 2, label: 'Facile' }],
    [3, { id: 3, label: 'Moyen' }],
    [4, { id: 4, label: 'Difficile' }],
    [5, { id: 5, label: 'Très difficile' }],
    [6, { id: 6, label: 'Echelle maison' }],
  ]),
  routes: new Map([
    [1, { id: 1, route: 'Boucle' }],
    [2, { id: 2, route: 'Aller-retour' }],
    [3, { id: 3, route: 'Traversée' }],
    [4, { id: 4, route: 'Itinérance' }],
    [5, { id: 5, route: 'Séjour itinérant' }],
    [6, { id: 6, route: 'Descente' }],
    [7, { id: 7, route: 'Accès : Approche' }],
    [8, { id: 8, route: 'Randonnee en etoile' }],
  ]),
});

const trek = (overrides: Partial<GeotrekTrek> = {}): GeotrekTrek => ({
  id: 837,
  name: '  Pic Coolidge  ',
  description: '<p>De la Berarde, prendre le sentier.</p>',
  description_teaser: null,
  length_2d: 5394.1,
  ascent: 705,
  descent: -10,
  duration: 2.5,
  difficulty: 4,
  route: 1,
  departure_geom: [6.2933, 44.9323],
  geometry: {
    type: 'LineString',
    coordinates: [
      [6.1, 44.1, 1717],
      [6.2, 44.2, 1800],
    ],
  },
  published: true,
  ...overrides,
});

describe('htmlToPlainText', () => {
  it('retire les balises et rend les sauts de ligne structurels', () => {
    expect(htmlToPlainText('<p>Premier</p><p>Second</p>')).toBe(
      'Premier\n\nSecond',
    );
    expect(htmlToPlainText('Ligne<br>Suivante')).toBe('Ligne\nSuivante');
    expect(htmlToPlainText('Un<br />Deux')).toBe('Un\nDeux');
    expect(htmlToPlainText('<ul><li>a</li><li>b</li></ul>')).toBe('a\nb');
    expect(htmlToPlainText('<h2>Titre</h2>Texte')).toBe('Titre\nTexte');
  });

  it('decode les entites nommees, decimales et hexadecimales', () => {
    expect(htmlToPlainText('Bourg d&rsquo;Oisans')).toBe('Bourg d’Oisans');
    expect(htmlToPlainText('Brian&ccedil;on 35&deg;')).toBe('Briançon 35°');
    expect(htmlToPlainText('a&nbsp;b')).toBe('a b');
    expect(htmlToPlainText('&#233;t&#233;')).toBe('été');
    expect(htmlToPlainText('&#x00e9;t&#x00e9;')).toBe('été');
  });

  it('laisse intacte une entite inconnue plutot que de la deviner', () => {
    expect(htmlToPlainText('&inconnue; fin')).toBe('&inconnue; fin');
  });

  it('normalise les espaces et supprime les bordures', () => {
    expect(htmlToPlainText('  <p>  trop    d espaces  </p>  ')).toBe(
      'trop d espaces',
    );
    expect(htmlToPlainText('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
  });
});

describe('normalizeLabel', () => {
  it('met en minuscules, retire accents et espaces de bordure', () => {
    expect(normalizeLabel('  Très Difficile ')).toBe('tres difficile');
    expect(normalizeLabel('Traversée')).toBe('traversee');
  });
});

describe('toDifficulty', () => {
  it('traduit chaque libelle et conserve celui d origine', () => {
    const expected: [number, string, string][] = [
      [1, 'facile', 'Très facile'],
      [2, 'facile', 'Facile'],
      [3, 'moyen', 'Moyen'],
      [4, 'difficile', 'Difficile'],
      [5, 'tres_difficile', 'Très difficile'],
    ];

    for (const [id, difficulty, sourceDifficulty] of expected) {
      expect(toDifficulty(trek({ difficulty: id }), referentials())).toEqual({
        difficulty,
        sourceDifficulty,
      });
    }
  });

  it('ne confond pas "tres difficile" avec "difficile"', () => {
    const referentiels = referentials();
    referentiels.difficulties.set(9, { id: 9, label: 'TRÈS DIFFICILE' });

    expect(toDifficulty(trek({ difficulty: 9 }), referentiels).difficulty).toBe(
      'tres_difficile',
    );
  });

  it('rend une difficulte nulle mais garde le libelle non reconnu', () => {
    expect(toDifficulty(trek({ difficulty: 6 }), referentials())).toEqual({
      difficulty: null,
      sourceDifficulty: 'Echelle maison',
    });
  });

  it('rend tout nul quand le trek n a pas de difficulte', () => {
    expect(toDifficulty(trek({ difficulty: null }), referentials())).toEqual({
      difficulty: null,
      sourceDifficulty: null,
    });
  });

  it('rend tout nul quand la difficulte reference une entree absente', () => {
    expect(toDifficulty(trek({ difficulty: 999 }), referentials())).toEqual({
      difficulty: null,
      sourceDifficulty: null,
    });
  });
});

describe('toRouteType', () => {
  it('reconnait tous les libelles rencontres sur les instances importees', () => {
    const expected: [number, string | null][] = [
      [1, 'loop'],
      [2, 'out_and_back'],
      [3, 'point_to_point'],
      [4, 'point_to_point'],
      [5, 'point_to_point'],
      [6, 'point_to_point'],
      [7, 'point_to_point'],
    ];

    for (const [id, routeType] of expected) {
      expect(toRouteType(trek({ route: id }), referentials())).toBe(routeType);
    }
  });

  it('rend null sur un libelle non reconnu plutot que de supposer', () => {
    expect(toRouteType(trek({ route: 8 }), referentials())).toBeNull();
  });

  it('rend null quand le trek n a pas de type de parcours', () => {
    expect(toRouteType(trek({ route: null }), referentials())).toBeNull();
  });

  it('rend null quand le type reference une entree absente', () => {
    expect(toRouteType(trek({ route: 999 }), referentials())).toBeNull();
  });
});

describe('toStartPoint', () => {
  it('utilise le point de depart publie', () => {
    expect(toStartPoint(trek())).toEqual({
      type: 'Point',
      coordinates: [6.2933, 44.9323],
    });
  });

  it('retombe sur le premier point de la trace quand il est absent', () => {
    expect(toStartPoint(trek({ departure_geom: null }))).toEqual({
      type: 'Point',
      coordinates: [6.1, 44.1],
    });
  });

  it('retire l altitude du point de depart publie', () => {
    expect(toStartPoint(trek({ departure_geom: [6.5, 44.5, 1200] }))).toEqual({
      type: 'Point',
      coordinates: [6.5, 44.5],
    });
  });
});

describe('toGeometry', () => {
  it('retire l altitude de chaque position', () => {
    expect(toGeometry(trek())).toEqual({
      type: 'LineString',
      coordinates: [
        [6.1, 44.1],
        [6.2, 44.2],
      ],
    });
  });
});

describe('toDescription', () => {
  it('prefere le chapeau editorial quand il existe', () => {
    expect(toDescription(trek({ description_teaser: '<p>Chapeau</p>' }))).toBe(
      'Chapeau',
    );
  });

  it('retombe sur la description complete', () => {
    expect(toDescription(trek({ description_teaser: '   ' }))).toBe(
      'De la Berarde, prendre le sentier.',
    );
  });

  it('rend null quand les deux champs sont vides ou absents', () => {
    expect(
      toDescription(trek({ description: null, description_teaser: null })),
    ).toBeNull();
    expect(
      toDescription(trek({ description: '<p> </p>', description_teaser: '' })),
    ).toBeNull();
  });
});

describe('toTrekRow', () => {
  it('produit une ligne complete a partir d un trek renseigne', () => {
    expect(toTrekRow(trek(), instance, referentials())).toEqual({
      name: 'Pic Coolidge',
      description: 'De la Berarde, prendre le sentier.',
      distanceMeters: 5394,
      ascentMeters: 705,
      descentMeters: 10,
      durationMinutes: 150,
      difficulty: 'difficile',
      sourceDifficulty: 'Difficile',
      routeType: 'loop',
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.1, 44.1],
          [6.2, 44.2],
        ],
      },
      startPoint: { type: 'Point', coordinates: [6.2933, 44.9323] },
      source: 'geotrek',
      sourceInstance: 'ecrins',
      sourceId: '837',
      sourceUrl: 'https://exemple.test',
      license: 'Licence Ouverte / Etalab 2.0',
    });
  });

  it('ramene les mesures absentes a null, sauf la distance', () => {
    const row = toTrekRow(
      trek({
        length_2d: null,
        ascent: null,
        descent: null,
        duration: null,
      }),
      instance,
      referentials(),
    );

    expect(row.distanceMeters).toBe(0);
    expect(row.ascentMeters).toBeNull();
    expect(row.descentMeters).toBeNull();
    expect(row.durationMinutes).toBeNull();
  });

  it('rend le denivele positif quel que soit le signe publie', () => {
    const row = toTrekRow(
      trek({ ascent: -705, descent: 10 }),
      instance,
      referentials(),
    );

    expect(row.ascentMeters).toBe(705);
    expect(row.descentMeters).toBe(10);
  });

  it('accepte une instance sans site public', () => {
    const row = toTrekRow(
      trek(),
      { ...instance, portalUrl: null },
      referentials(),
    );

    expect(row.sourceUrl).toBeNull();
  });
});
