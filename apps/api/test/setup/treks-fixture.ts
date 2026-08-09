import type { TrekImportRow } from '../../src/modules/treks/geotrek/geotrek.types';

/**
 * Itineraires de test, ecrits a la main plutot qu'extraits du jeu importe : les
 * tests doivent exercer des cas choisis (une difficulte de chaque, des
 * distances aux bornes, un point de depart eloigne) et rester lisibles.
 *
 * Les coordonnees sont dans les Ecrins, sauf `Sentier littoral` volontairement
 * place a plusieurs centaines de kilometres pour verifier le filtre de
 * proximite.
 */
const trace = (lon: number, lat: number): TrekImportRow['geometry'] => ({
  type: 'LineString',
  coordinates: [
    [lon, lat],
    [lon + 0.01, lat + 0.01],
    [lon + 0.02, lat + 0.005],
  ],
});

const row = (
  overrides: Partial<TrekImportRow> & Pick<TrekImportRow, 'name' | 'sourceId'>,
): TrekImportRow => {
  const [lon, lat] = overrides.startPoint?.coordinates ?? [6.29, 44.93];

  return {
    description: null,
    distanceMeters: 10_000,
    ascentMeters: 500,
    descentMeters: 500,
    durationMinutes: 240,
    difficulty: 'moyen',
    sourceDifficulty: 'Moyen',
    routeType: 'loop',
    geometry: trace(lon as number, lat as number),
    startPoint: { type: 'Point', coordinates: [lon as number, lat as number] },
    source: 'geotrek',
    sourceInstance: 'ecrins',
    sourceUrl: 'https://rando.ecrins-parcnational.fr',
    license: 'Licence Ouverte / Open Licence 2.0',
    ...overrides,
  };
};

export const TREKS_FIXTURE: TrekImportRow[] = [
  row({
    name: 'Boucle du Lautaret',
    sourceId: '1',
    difficulty: 'facile',
    sourceDifficulty: 'Facile',
    distanceMeters: 5_000,
    description: 'Une boucle courte et sans difficulte.',
  }),
  row({
    name: 'Col du Galibier',
    sourceId: '2',
    difficulty: 'difficile',
    sourceDifficulty: 'Difficile',
    distanceMeters: 20_000,
    routeType: 'out_and_back',
  }),
  row({
    name: 'Arete des Ecrins',
    sourceId: '3',
    difficulty: 'tres_difficile',
    sourceDifficulty: 'Tres difficile',
    distanceMeters: 30_000,
    routeType: 'point_to_point',
  }),
  row({
    name: 'Plateau d Emparis',
    sourceId: '4',
    difficulty: null,
    sourceDifficulty: 'Echelle maison',
    distanceMeters: 15_000,
  }),
  row({
    // Volontairement loin des Ecrins : sert de temoin negatif au filtre de
    // proximite.
    name: 'Sentier littoral',
    sourceId: '5',
    startPoint: { type: 'Point', coordinates: [-4.48, 48.39] },
    distanceMeters: 8_000,
  }),
  // Deux homonymes au meme point de depart : le cas qui rend une pagination
  // visible. Sans depart par `id`, l'ordre de ces deux lignes est libre entre
  // deux requetes, aussi bien pour le tri alphabetique que pour le tri par
  // distance — et une page en montre alors une deux fois pendant que l'autre
  // disparait. Les distances les tiennent hors du filtre 8-15 km.
  row({ name: 'Tour du lac', sourceId: '6', distanceMeters: 25_000 }),
  row({ name: 'Tour du lac', sourceId: '7', distanceMeters: 26_000 }),
  row({
    // Demarre a une soixantaine de kilometres du point de reference des tests,
    // donc hors rayon, mais sa trace revient a moins de cinq kilometres :
    // temoin de la difference entre `matchOn=start` et `matchOn=trace`.
    name: 'Traversee du Champsaur',
    sourceId: '8',
    distanceMeters: 40_000,
    startPoint: { type: 'Point', coordinates: [7.1, 44.93] },
    geometry: {
      type: 'LineString',
      coordinates: [
        [7.1, 44.93],
        // Plus de decimales que la sortie n'en conserve : sert de temoin a
        // l'arrondi de `ST_AsGeoJSON`.
        [6.712345678, 44.951234567],
        [6.35, 44.93],
      ],
    },
  }),
];
