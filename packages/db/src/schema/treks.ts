import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  lineStringGeometry,
  pointGeometry,
  primaryKeyColumn,
  timestampColumns,
} from '../columns';
import { users } from './auth';

/**
 * Itineraires de randonnee.
 *
 * Un trek est un parcours reutilisable et intemporel : ni date, ni
 * participants. Une sortie organisee a une date donnee est un concept distinct,
 * qui aura sa propre table.
 *
 * La table melange deux provenances : des itineraires importes depuis des
 * sources ouvertes (`created_by` nul) et, a terme, des itineraires crees par
 * les utilisateurs. C'est le triplet source qui les distingue.
 */

/**
 * Echelle de difficulte du projet. Volontairement nullable en base : chaque
 * source a sa propre echelle, et une correspondance douteuse vaut moins qu'une
 * absence assumee. Le libelle d'origine reste dans `source_difficulty`.
 */
export const trekDifficultyEnum = pgEnum('trek_difficulty', [
  'facile',
  'moyen',
  'difficile',
  'tres_difficile',
]);

export const trekRouteTypeEnum = pgEnum('trek_route_type', [
  'loop',
  'out_and_back',
  'point_to_point',
]);

/**
 * Provenance. L'instance precise vit dans `source_instance` : ajouter un parc
 * ou un departement ne doit pas imposer une migration de schema.
 */
export const trekSourceEnum = pgEnum('trek_source', ['geotrek', 'user']);

export const treks = pgTable(
  'treks',
  {
    id: primaryKeyColumn(),
    name: text('name').notNull(),
    description: text('description'),
    // Distances et deniveles en metres entiers : les sources publient des
    // flottants, les arrondir une fois a l'import evite des ecarts d'affichage
    // entre clients.
    distanceMeters: integer('distance_meters').notNull(),
    ascentMeters: integer('ascent_meters'),
    descentMeters: integer('descent_meters'),
    durationMinutes: integer('duration_minutes'),
    difficulty: trekDifficultyEnum('difficulty'),
    // Libelle de difficulte tel que publie par la source. Conserve pour que la
    // correspondance vers `difficulty` reste verifiable et corrigeable.
    sourceDifficulty: text('source_difficulty'),
    routeType: trekRouteTypeEnum('route_type'),
    geometry: lineStringGeometry('geometry').notNull(),
    // Point de depart, derive de la trace a l'import. Duplique une information
    // deja presente dans `geometry`, mais c'est ce qui rend la recherche par
    // proximite indexable.
    startPoint: pointGeometry('start_point').notNull(),
    source: trekSourceEnum('source').notNull(),
    sourceInstance: text('source_instance'),
    sourceId: text('source_id'),
    sourceUrl: text('source_url'),
    // Licence de la source, exposee au client : ODbL et CC-BY imposent de
    // crediter, ce qui suppose de savoir quoi afficher pour chaque itineraire.
    license: text('license'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestampColumns,
  },
  (table) => [
    // Cle d'idempotence du seed. Les treks utilisateurs ont les trois colonnes
    // nulles : en Postgres, deux NULL ne sont pas egaux, ils n'entrent donc
    // jamais en conflit entre eux.
    uniqueIndex('treks_source_ref_idx').on(
      table.source,
      table.sourceInstance,
      table.sourceId,
    ),
    // Index d'expression sur le cast en `geography` : c'est sous cette forme
    // que les requetes de proximite interrogent la colonne (`ST_DWithin` en
    // metres). Un index sur la `geometry` brute ne serait pas retenu.
    index('treks_start_point_idx').using(
      'gist',
      sql`(${table.startPoint}::geography)`,
    ),
    index('treks_difficulty_idx').on(table.difficulty),
    index('treks_distance_meters_idx').on(table.distanceMeters),
  ],
);
