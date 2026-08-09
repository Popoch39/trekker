import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

/**
 * Conventions de colonnes partagees par toutes les tables du projet.
 *
 * Les identifiants sont des UUID v7 generes cote application : ils restent
 * triables chronologiquement (bon pour l'index B-tree) tout en etant non
 * devinables, ce qui compte des lors qu'ils transitent vers un client mobile.
 */
export const primaryKeyColumn = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

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
