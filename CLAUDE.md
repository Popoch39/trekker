# trekker — instructions du dépôt

Monorepo Turborepo + pnpm. `apps/api` (NestJS 11), `packages/db` (Drizzle),
`packages/contracts` (Zod partagé).

L'API est consommée par un **front web** et une **app mobile**. Toute décision
d'API se juge à cette aune : un contrat implicite ou un format d'erreur maison
coûte cher côté mobile, où les vieilles versions restent en circulation.

## Outillage — ne jamais supposer

- **pnpm 9** (`pnpm-lock.yaml`). Jamais `npm` ni `yarn`.
- **oxlint / oxfmt**, pas ESLint ni Prettier. `pnpm lint`, `pnpm format`.
- **Turborepo** orchestre : `pnpm build`, `pnpm check-types`, `pnpm test`.
- **Node >= 22**.

Avant de déclarer une tâche terminée, faire tourner et lire la sortie de :

```sh
pnpm lint && pnpm format:check && pnpm check-types && pnpm build && pnpm test
```

`pnpm test` nécessite Docker (Testcontainers).

## Frontières entre packages

Elles ne sont pas décoratives — c'est ce qui permet au mobile d'importer les
contrats sans embarquer `pg` :

- `@repo/contracts` ne dépend **que de `zod`**. Aucune dépendance vers
  `@repo/db`, NestJS ou quoi que ce soit de serveur. Ne jamais y ajouter l'une
  de ces dépendances.
- `@repo/db` ne dépend pas de NestJS. Il expose un client, des helpers de
  colonnes et les migrations — pas de logique métier.
- `apps/api` dépend des deux. Rien ne dépend de `apps/api`.

Les deux packages sont **compilés** (`dist/` + `.d.ts`), avec
`dependsOn: ["^build"]` dans `turbo.json`. Ne pas passer à des exports de
sources TS : `nest build` ne compile pas les dépendances workspace et l'image
Docker ne verrait que du TypeScript.

## Contrats : toujours passer par `@repo/contracts`

Tout ce qui traverse la frontière HTTP est décrit par un schéma Zod dans
`packages/contracts/src/`, jamais par une interface ad-hoc dans un contrôleur.

- Les DTO d'entrée et de sortie se dérivent de ces schémas via `createZodDto`
  (`nestjs-zod`), voir `apps/api/CLAUDE.md`.
- Les réponses paginées utilisent `paginatedSchema`, `buildPaginationMeta` et
  `toLimitOffset` (`packages/contracts/src/pagination.ts`) — ne pas réécrire de
  calcul de pagination.
- Les identifiants et dates utilisent `uuidSchema` / `timestampSchema` /
  `entityBaseSchema` (`primitives.ts`).
- Un schéma dupliqué entre l'API et un client est un bug : il vit dans
  `contracts`.

## Base de données

- Schéma Drizzle dans `packages/db/src/schema/`, un fichier par entité,
  ré-exporté depuis `schema/index.ts`.
- Toute table utilise `primaryKeyColumn()` et `timestampColumns`
  (`packages/db/src/columns.ts`) : UUID v7 généré côté application,
  `timestamptz`. Ne pas redéclarer ces colonnes à la main, ne pas introduire de
  clés auto-incrémentées (IDs énumérables exposés aux clients).
- Migrations **versionnées** : `pnpm db:generate` puis `pnpm db:migrate`, le SQL
  généré est commité. Ne jamais utiliser `drizzle-kit push`.
- Les migrations ne sont **jamais** appliquées au démarrage de l'API — c'est une
  étape de déploiement explicite.

## Environnement

- Un seul `.env`, à la racine, lu par docker compose **et** par l'API.
  `.env.example` est commité et doit rester synchronisé.
- Toute nouvelle variable s'ajoute dans `apps/api/src/config/env.schema.ts`
  **et** dans `.env.example`.
- Aucun `process.env` ailleurs que dans ce schéma : passer par
  `AppConfigService`.

## Hors périmètre actuel

- **Pas d'authentification** : c'est un chantier dédié, ne pas l'improviser au
  détour d'une feature.
- **Pas de CI** pour l'instant.
- **Aucune entité métier** : le schéma est volontairement vide.

## Conventions de code

- Fichiers en `kebab-case`, classes et composants en `PascalCase`.
- Commentaires en français, expliquant le **pourquoi** (contrainte, arbitrage),
  pas le quoi.
- Changements chirurgicaux : ne pas réécrire ce qui n'est pas demandé.
