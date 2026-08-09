import type {
  LineString,
  Point,
  TrekDifficulty,
  TrekRouteType,
} from '@repo/contracts';
import { z } from 'zod';

/**
 * Forme des reponses de l'API Geotrek v2.
 *
 * Decrite en Zod plutot qu'en interface : ces donnees viennent d'instances
 * tierces mises a jour independamment de nous, et un champ qui change de type
 * doit echouer a l'import plutot que produire des lignes silencieusement
 * fausses en base.
 *
 * Seuls les champs consommes sont declares ; Zod ignore le reste.
 */

/** Enveloppe paginee, commune a tous les endpoints (Django REST Framework). */
export const geotrekPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    count: z.number().int(),
    next: z.url().nullable(),
    results: z.array(item),
  });

/**
 * Position telle que publiee par Geotrek : `[longitude, latitude]`, parfois
 * suivie d'une altitude que nous n'exploitons pas.
 */
const geotrekPositionSchema = z.array(z.number()).min(2);

export const geotrekTrekSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullish(),
  description_teaser: z.string().nullish(),
  /** Longueur planimetrique, en metres. */
  length_2d: z.number().nullish(),
  /** Denivele positif, en metres. */
  ascent: z.number().nullish(),
  /** Denivele negatif, publie en valeur negative. */
  descent: z.number().nullish(),
  /** Duree en heures, decimale (0.5 = trente minutes). */
  duration: z.number().nullish(),
  /** Identifiant vers `/trek_difficulty`, propre a chaque instance. */
  difficulty: z.number().int().nullish(),
  /** Identifiant vers `/trek_route`, propre a chaque instance. */
  route: z.number().int().nullish(),
  departure_geom: geotrekPositionSchema.nullish(),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(geotrekPositionSchema).min(2),
  }),
  published: z.boolean().nullish(),
});

/**
 * Le champ `cirkwi_level` de ce referentiel n'est volontairement pas lu.
 *
 * Il ressemble a une echelle normalisee, mais il est configure par chaque
 * instance : releve en aout 2026, le libelle "Facile" vaut 3 aux Ecrins, aux
 * Cevennes et sur Chemins des Parcs, et 2 dans les Alpes-de-Haute-Provence.
 * S'y fier traduisait "Facile" en "moyen". Les libelles, eux, sont identiques
 * d'une instance a l'autre : c'est sur eux que porte la correspondance.
 */
export const geotrekDifficultySchema = z.object({
  id: z.number().int(),
  label: z.string(),
});

export const geotrekRouteSchema = z.object({
  id: z.number().int(),
  route: z.string(),
});

export type GeotrekTrek = z.infer<typeof geotrekTrekSchema>;
export type GeotrekDifficulty = z.infer<typeof geotrekDifficultySchema>;
export type GeotrekRoute = z.infer<typeof geotrekRouteSchema>;

/** Referentiels d'une instance, resolus une fois avant de mapper ses treks. */
export interface GeotrekReferentials {
  difficulties: Map<number, GeotrekDifficulty>;
  routes: Map<number, GeotrekRoute>;
}

/**
 * Ligne prete a inserer dans `treks`, telle qu'ecrite dans le fichier
 * d'import. Volontairement sans `id` ni horodatages : ils sont produits par la
 * base, et les figer dans un fichier casserait la stabilite des identifiants.
 */
export interface TrekImportRow {
  name: string;
  description: string | null;
  distanceMeters: number;
  ascentMeters: number | null;
  descentMeters: number | null;
  durationMinutes: number | null;
  difficulty: TrekDifficulty | null;
  sourceDifficulty: string | null;
  routeType: TrekRouteType | null;
  geometry: LineString;
  startPoint: Point;
  source: 'geotrek';
  sourceInstance: string;
  sourceId: string;
  sourceUrl: string | null;
  license: string;
}
