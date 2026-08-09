import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryKeyColumn, timestampColumns } from '../columns';

/**
 * Schema requis par Better Auth, reecrit aux conventions du projet.
 *
 * Better Auth genere par defaut des `id` en `text` aleatoire ; ici les cles
 * primaires restent des UUID v7 (`primaryKeyColumn()`) pour qu'une cle
 * etrangere metier vers `users.id` ait le meme type que partout ailleurs.
 * L'instance Better Auth doit donc fournir `advanced.database.generateId`.
 *
 * Les tables sont au pluriel (`user` est un mot reserve SQL) ; la
 * correspondance vers les modeles Better Auth (singuliers) se fait via
 * l'option `schema` du `drizzleAdapter`.
 *
 * Les colonnes sont nommees explicitement, comme dans `../columns` : le
 * `casing: 'snake_case'` de `drizzle.config.ts` ne s'applique qu'a drizzle-kit,
 * pas au client runtime.
 */

export const users = pgTable('users', {
  id: primaryKeyColumn(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  ...timestampColumns,
});

export const sessions = pgTable(
  'sessions',
  {
    id: primaryKeyColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Le jeton porte la session : cookie cote web, `Authorization: Bearer`
    // cote mobile via le plugin `bearer`.
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestampColumns,
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: primaryKeyColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Identifiant chez le fournisseur, et fournisseur lui-meme
    // (`credential` pour email + mot de passe).
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    // Renseigne uniquement pour `credential` : hash scrypt, jamais le clair.
    password: text('password'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    ...timestampColumns,
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: primaryKeyColumn(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    ...timestampColumns,
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

/**
 * Rate limiting de Better Auth, en base plutot qu'en memoire : le compteur
 * memoire ment des la deuxieme instance et repart a zero au redemarrage.
 * `ThrottlerGuard` ne couvre pas `/api/auth/*` (handler monte en middleware,
 * pas en route Nest), c'est donc la seule protection de ces routes.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: primaryKeyColumn(),
    key: text('key').notNull(),
    count: integer('count').notNull().default(0),
    lastRequest: bigint('last_request', { mode: 'number' })
      .notNull()
      .default(0),
    ...timestampColumns,
  },
  (table) => [index('rate_limits_key_idx').on(table.key)],
);
