import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';
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
