import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';
import {
  blankAsUndefined,
  entityBaseSchema,
  nonEmptyString,
} from './primitives';

/**
 * Contrat des itineraires de randonnee.
 *
 * Un trek est un parcours reutilisable et intemporel. Une sortie organisee a
 * une date donnee est un concept distinct, qui aura son propre contrat.
 */

/** Position GeoJSON : `[longitude, latitude]`, dans cet ordre. */
export const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const pointSchema = z.object({
  type: z.literal('Point'),
  coordinates: positionSchema,
});

/** Une trace comporte au moins deux points, sinon ce n'est pas un parcours. */
export const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(positionSchema).min(2),
});

export const trekDifficultySchema = z.enum([
  'facile',
  'moyen',
  'difficile',
  'tres_difficile',
]);

export const trekRouteTypeSchema = z.enum([
  'loop',
  'out_and_back',
  'point_to_point',
]);

export const trekSourceSchema = z.enum(['geotrek', 'user']);

/**
 * Forme resumee, servie dans les listes.
 *
 * Sans la trace : une page de vingt itineraires porterait plusieurs megaoctets
 * de coordonnees, pour un ecran qui n'affiche qu'un titre et une vignette.
 */
export const trekSummarySchema = entityBaseSchema.extend({
  name: nonEmptyString,
  distanceMeters: z.int().min(0),
  ascentMeters: z.int().min(0).nullable(),
  descentMeters: z.int().min(0).nullable(),
  durationMinutes: z.int().min(0).nullable(),
  difficulty: trekDifficultySchema.nullable(),
  /** Libelle de difficulte tel que publie par la source. */
  sourceDifficulty: z.string().nullable(),
  routeType: trekRouteTypeSchema.nullable(),
  startPoint: pointSchema,
  source: trekSourceSchema,
  /**
   * Licence et lien vers la source. Exposes et non purement internes : ODbL et
   * CC-BY imposent de crediter, ce qu'un client ne peut faire que s'il sait
   * quoi afficher pour chaque itineraire.
   */
  license: z.string().nullable(),
  sourceUrl: z.url().nullable(),
});

/**
 * Forme complete, servie sur la fiche d'un itineraire.
 *
 * La description n'apparait qu'ici : c'est un texte editorial long, inutile
 * dans une liste et couteux a transporter vingt fois par page.
 */
export const trekSchema = trekSummarySchema.extend({
  description: z.string().nullable(),
  geometry: lineStringSchema,
});

export const trekListSchema = paginatedSchema(trekSummarySchema);

/**
 * Sur quoi porte un filtre spatial.
 *
 * `start` ne retient que le point de depart, `trace` interroge le parcours
 * entier : un GR qui traverse la zone mais demarre soixante kilometres plus
 * loin repond a la seconde question, pas a la premiere. Le defaut preserve le
 * comportement des clients deja deployes.
 */
export const trekMatchOnSchema = z.enum(['start', 'trace']);

/**
 * Cadre de carte, `minLon,minLat,maxLon,maxLat` — l'ordre GeoJSON, coherent
 * avec `positionSchema`.
 *
 * Un cadre degenere (coin superieur au coin inferieur) est refuse plutot
 * qu'interprete : c'est presque toujours une inversion d'axes cote client, et
 * la seule reponse honnete est une liste vide qu'aucun client ne saurait
 * distinguer d'une absence de resultats.
 */
export const bboxSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').map(Number) : value),
  z
    .tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ])
    .refine(
      ([minLon, minLat, maxLon, maxLat]) => minLon < maxLon && minLat < maxLat,
      {
        message:
          'bbox attend minLon,minLat,maxLon,maxLat, coin inferieur en premier.',
      },
    ),
);

/**
 * Query params de la liste.
 *
 * La recherche par proximite exige les trois parametres ensemble : une latitude
 * sans rayon n'a pas de sens, et l'accepter silencieusement renverrait un
 * resultat non filtre que le client croirait filtre.
 */
export const trekListQuerySchema = paginationQuerySchema
  .extend({
    difficulty: trekDifficultySchema.optional(),
    minDistanceMeters: blankAsUndefined(
      z.coerce.number().int().min(0).optional(),
    ),
    maxDistanceMeters: blankAsUndefined(
      z.coerce.number().int().min(0).optional(),
    ),
    lat: blankAsUndefined(z.coerce.number().min(-90).max(90).optional()),
    lon: blankAsUndefined(z.coerce.number().min(-180).max(180).optional()),
    radiusKm: blankAsUndefined(
      z.coerce.number().positive().max(500).optional(),
    ),
    bbox: blankAsUndefined(bboxSchema.optional()),
    matchOn: trekMatchOnSchema.default('start'),
  })
  .refine(
    (query) =>
      query.bbox === undefined ||
      [query.lat, query.lon, query.radiusKm].every(
        (value) => value === undefined,
      ),
    {
      message:
        'bbox et la recherche par proximite (lat, lon, radiusKm) s excluent.',
      path: ['bbox'],
    },
  )
  .refine(
    (query) =>
      [query.lat, query.lon, query.radiusKm].every(
        (value) => value === undefined,
      ) ||
      [query.lat, query.lon, query.radiusKm].every(
        (value) => value !== undefined,
      ),
    {
      message: 'lat, lon et radiusKm doivent etre fournis ensemble.',
      path: ['radiusKm'],
    },
  )
  .refine(
    (query) =>
      query.minDistanceMeters === undefined ||
      query.maxDistanceMeters === undefined ||
      query.minDistanceMeters <= query.maxDistanceMeters,
    {
      message:
        'minDistanceMeters doit etre inferieur ou egal a maxDistanceMeters.',
      path: ['minDistanceMeters'],
    },
  );

export type Position = z.infer<typeof positionSchema>;
export type Point = z.infer<typeof pointSchema>;
export type LineString = z.infer<typeof lineStringSchema>;
export type TrekDifficulty = z.infer<typeof trekDifficultySchema>;
export type TrekRouteType = z.infer<typeof trekRouteTypeSchema>;
export type TrekSource = z.infer<typeof trekSourceSchema>;
export type TrekMatchOn = z.infer<typeof trekMatchOnSchema>;
export type Bbox = z.infer<typeof bboxSchema>;
export type TrekSummary = z.infer<typeof trekSummarySchema>;
export type Trek = z.infer<typeof trekSchema>;
export type TrekList = z.infer<typeof trekListSchema>;
export type TrekListQuery = z.infer<typeof trekListQuerySchema>;
