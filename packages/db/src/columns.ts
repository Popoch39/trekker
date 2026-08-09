import { sql } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

/**
 * Generateur d'identifiant du projet.
 *
 * UUID v7 genere cote application : triable chronologiquement (bon pour
 * l'index B-tree) tout en restant non devinable, ce qui compte des lors qu'il
 * transite vers un client mobile.
 *
 * Expose separement de `primaryKeyColumn()` car certaines librairies
 * (Better Auth) generent l'`id` elles-memes, en amont de Drizzle : elles
 * doivent produire exactement le meme format.
 */
export const newId = (): string => uuidv7();

/** Cle primaire commune a toutes les tables du projet. */
export const primaryKeyColumn = () => uuid('id').primaryKey().$defaultFn(newId);

/**
 * `created_at` / `updated_at` en `timestamptz`. `updated_at` est remis a jour
 * par Drizzle a chaque `update()` via `$onUpdate`.
 */
export const timestampColumns = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
};

/**
 * Position en coordonnees geographiques, ordre GeoJSON : `[longitude, latitude]`.
 *
 * L'altitude eventuelle des sources n'est pas conservee : le denivele est deja
 * porte par des colonnes dediees, et une troisieme coordonnee alourdirait
 * chaque trace sans etre exploitee.
 */
export type GeoPosition = [number, number];

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: GeoPosition;
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: GeoPosition[];
}

/**
 * Le `geometry()` de Drizzle n'emet que du `geometry(point)` : sa configuration
 * `type` / `srid` est acceptee par TypeScript mais ignoree a l'execution, et son
 * decodeur leve `Unsupported geometry type` sur autre chose qu'un point. Les
 * colonnes geographiques du projet passent donc par `customType`.
 *
 * Le type SQL est ecrit en minuscules : drizzle-kit compare les types en
 * minuscules et produirait sinon un `ALTER COLUMN TYPE` a chaque generation.
 */
const readViaGeoJson = (column: string) => (): never => {
  throw new Error(
    `La colonne ${column} ne peut pas etre lue directement : elle arrive en EWKB ` +
      'hexadecimal. Selectionner `ST_AsGeoJSON(colonne)::json` explicitement.',
  );
};

/** Trace d'un itineraire. */
export const lineStringGeometry = customType<{
  data: GeoJsonLineString;
  driverData: string;
}>({
  dataType() {
    return 'geometry(linestring,4326)';
  },
  toDriver(value) {
    // `ST_GeomFromGeoJSON` ne fixe pas toujours le SRID ; `ST_SetSRID` le force
    // a 4326, sans quoi l'insertion est refusee par la colonne typee.
    return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(value)}), 4326)`;
  },
  fromDriver: readViaGeoJson('geometry(linestring)'),
});

/**
 * Point de depart.
 *
 * Declare en `geometry` et non en `geography` : drizzle-kit ne connait comme
 * type natif que `geometry(...)` et citerait `"geography(point,4326)"` comme un
 * type utilisateur, produisant un SQL invalide a chaque generation.
 *
 * Les requetes de proximite castent donc explicitement en `::geography` pour
 * raisonner en metres, et l'index GiST de `treks` porte sur cette meme
 * expression afin de rester utilisable.
 */
export const pointGeometry = customType<{
  data: GeoJsonPoint;
  driverData: string;
}>({
  dataType() {
    return 'geometry(point,4326)';
  },
  toDriver(value) {
    return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(value)}), 4326)`;
  },
  fromDriver: readViaGeoJson('geometry(point)'),
});
