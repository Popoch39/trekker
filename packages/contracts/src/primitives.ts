import { z } from 'zod';

/** Identifiant d'entite : UUID (v7 cote base, mais la version n'est pas contractuelle). */
export const uuidSchema = z.uuid();

/** Date serialisee en ISO 8601 UTC. */
export const timestampSchema = z.iso.datetime({ offset: true });

/** Chaine non vide, espaces de bordure retires. */
export const nonEmptyString = z.string().trim().min(1);

/**
 * Champs presents sur toute entite exposee par l'API, derives des conventions
 * de colonnes de `@repo/db` (voir `primaryKeyColumn` / `timestampColumns`).
 */
export const entityBaseSchema = z.object({
  id: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/**
 * Traite un parametre de query string vide comme absent.
 *
 * `z.coerce.number()` rend `0` pour une chaine vide : sans ce prefiltre,
 * `?lat=&lon=&radiusKm=10` decrirait une recherche autour du point (0, 0) que
 * le client croirait filtree sur sa position. Un parametre present mais vide
 * vaut absent, ce qui laisse les `refine` de coherence faire leur travail.
 */
export const blankAsUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

export type Uuid = z.infer<typeof uuidSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
export type EntityBase = z.infer<typeof entityBaseSchema>;
