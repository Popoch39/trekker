import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Query params de pagination. `coerce` parce que les valeurs arrivent en
 * chaine depuis l'URL.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export const paginationMetaSchema = z.object({
  page: z.int().min(1),
  pageSize: z.int().min(1),
  total: z.int().min(0),
  totalPages: z.int().min(0),
});

/**
 * Enveloppe des listes paginees. Generique : a appeler avec le schema de
 * l'element.
 *
 *   const trekListSchema = paginatedSchema(trekSchema);
 */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: paginationMetaSchema,
  });

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type Paginated<T> = { data: T[]; meta: PaginationMeta };

/** Calcule les metadonnees de pagination a partir du total et de la requete. */
export function buildPaginationMeta(
  query: PaginationQuery,
  total: number,
): PaginationMeta {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

/** Traduit une pagination en `limit`/`offset` SQL. */
export function toLimitOffset(query: PaginationQuery): {
  limit: number;
  offset: number;
} {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  };
}
