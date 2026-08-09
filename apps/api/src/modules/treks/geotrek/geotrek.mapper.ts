import type {
  LineString,
  Point,
  TrekDifficulty,
  TrekRouteType,
} from '@repo/contracts';

import type { GeotrekInstance } from './geotrek.instances';
import type {
  GeotrekReferentials,
  GeotrekTrek,
  TrekImportRow,
} from './geotrek.types';

/**
 * Traduction d'un trek Geotrek vers une ligne de notre table.
 *
 * Fonctions pures, sans reseau ni base : c'est la seule couche ou une erreur se
 * propage silencieusement a des milliers de lignes, elle doit donc rester
 * entierement testable en memoire.
 */

/**
 * Correspondance des difficultes, par mot-cle sur le libelle.
 *
 * Le champ `cirkwi_level` de l'API serait plus commode, mais il est configure
 * par chaque instance et n'est donc pas comparable : voir le commentaire de
 * `geotrekDifficultySchema`. Les libelles, eux, sont stables d'un publicateur a
 * l'autre.
 *
 * Notre echelle compte quatre niveaux : "Tres facile" et "Facile" se
 * rejoignent, la distinction n'etant pas exploitable pour filtrer.
 *
 * L'ordre est significatif : "tres difficile" doit etre teste avant
 * "difficile", faute de quoi le prefixe serait ignore.
 */
const DIFFICULTY_BY_LABEL: [RegExp, TrekDifficulty][] = [
  [/tres\s*difficile/, 'tres_difficile'],
  [/tres\s*facile/, 'facile'],
  [/difficile|sportif|expert/, 'difficile'],
  [/facile|debutant/, 'facile'],
  [/moyen|intermediaire|modere/, 'moyen'],
];

/**
 * Correspondance des types de parcours, egalement par mot-cle : ce referentiel
 * est libre et chaque publicateur y ajoute ses propres entrees ("Descente",
 * "Sejour itinerant", "Acces : Approche"...). Une valeur non reconnue donne
 * `null` plutot qu'une supposition.
 */
const ROUTE_TYPE_BY_LABEL: [RegExp, TrekRouteType][] = [
  [/boucle/, 'loop'],
  [/aller[\s-]*(et[\s-]*)?retour/, 'out_and_back'],
  [
    /travers|itiner|etape|sejour|descente|acces|approche|aller[\s-]*simple/,
    'point_to_point',
  ],
];

/**
 * Minuscules sans accents : les referentiels sont saisis a la main par les
 * publicateurs, et "Traversee" y cotoie "Traversée".
 */
export function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  ocirc: 'ô',
  ucirc: 'û',
  ugrave: 'ù',
  icirc: 'î',
  deg: '°',
  laquo: '«',
  raquo: '»',
  euro: '€',
};

/**
 * Convertit le HTML editorial des sources en texte brut.
 *
 * Les descriptions Geotrek sont du HTML saisi par des redacteurs tiers. Le
 * stocker tel quel ferait transiter du balisage non maitrise jusqu'au
 * navigateur ; le texte brut est aussi le seul format directement affichable
 * cote mobile.
 */
export function htmlToPlainText(html: string): string {
  return (
    html
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      // Ouvrantes et fermantes de bloc : deux `<p>` consecutifs produisent ainsi
      // deux sauts, soit une ligne vide entre les paragraphes. Les `<li>` n'ont
      // qu'une fermante, une liste restant plus lisible sans interligne.
      .replace(/<\s*(p|div|h[1-6])[^>]*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCodePoint(Number(code)),
      )
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16)),
      )
      .replace(
        /&([a-z]+);/gi,
        (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
      )
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n{2,}/g, '\n\n')
      .trim()
  );
}

/** Retire l'altitude eventuelle : le denivele a ses propres colonnes. */
function toPosition(coordinates: number[]): [number, number] {
  return [coordinates[0] as number, coordinates[1] as number];
}

export function toDifficulty(
  trek: GeotrekTrek,
  referentials: GeotrekReferentials,
): { difficulty: TrekDifficulty | null; sourceDifficulty: string | null } {
  const reference =
    trek.difficulty == null
      ? undefined
      : referentials.difficulties.get(trek.difficulty);

  if (!reference) {
    return { difficulty: null, sourceDifficulty: null };
  }

  const normalized = normalizeLabel(reference.label);
  const match = DIFFICULTY_BY_LABEL.find(([pattern]) =>
    pattern.test(normalized),
  );

  return {
    difficulty: match ? match[1] : null,
    sourceDifficulty: reference.label,
  };
}

export function toRouteType(
  trek: GeotrekTrek,
  referentials: GeotrekReferentials,
): TrekRouteType | null {
  const reference =
    trek.route == null ? undefined : referentials.routes.get(trek.route);

  if (!reference) {
    return null;
  }

  const normalized = normalizeLabel(reference.route);
  const match = ROUTE_TYPE_BY_LABEL.find(([pattern]) =>
    pattern.test(normalized),
  );

  return match ? match[1] : null;
}

/**
 * Point de depart. Geotrek le publie separement, mais pas toujours : on retombe
 * alors sur le premier point de la trace, qui est la meme information.
 */
export function toStartPoint(trek: GeotrekTrek): Point {
  const coordinates =
    trek.departure_geom ?? (trek.geometry.coordinates[0] as number[]);

  return { type: 'Point', coordinates: toPosition(coordinates) };
}

export function toGeometry(trek: GeotrekTrek): LineString {
  return {
    type: 'LineString',
    coordinates: trek.geometry.coordinates.map(toPosition),
  };
}

/**
 * Description : le chapeau editorial (`description_teaser`) est prefere quand
 * il existe, la description complete servant de repli.
 */
export function toDescription(trek: GeotrekTrek): string | null {
  for (const candidate of [trek.description_teaser, trek.description]) {
    const text = candidate ? htmlToPlainText(candidate) : '';

    if (text !== '') {
      return text;
    }
  }

  return null;
}

export function toTrekRow(
  trek: GeotrekTrek,
  instance: GeotrekInstance,
  referentials: GeotrekReferentials,
): TrekImportRow {
  const { difficulty, sourceDifficulty } = toDifficulty(trek, referentials);

  return {
    name: trek.name.trim(),
    description: toDescription(trek),
    distanceMeters: Math.round(trek.length_2d ?? 0),
    ascentMeters:
      trek.ascent == null ? null : Math.round(Math.abs(trek.ascent)),
    // Geotrek publie le denivele negatif en valeur negative ; la colonne stocke
    // une amplitude, toujours positive.
    descentMeters:
      trek.descent == null ? null : Math.round(Math.abs(trek.descent)),
    durationMinutes:
      trek.duration == null ? null : Math.round(trek.duration * 60),
    difficulty,
    sourceDifficulty,
    routeType: toRouteType(trek, referentials),
    geometry: toGeometry(trek),
    startPoint: toStartPoint(trek),
    source: 'geotrek',
    sourceInstance: instance.key,
    sourceId: String(trek.id),
    sourceUrl: instance.portalUrl,
    license: instance.license,
  };
}
