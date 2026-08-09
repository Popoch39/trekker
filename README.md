# trekker

Monorepo Turborepo + pnpm.

| Workspace            | Role                                                        |
| -------------------- | ----------------------------------------------------------- |
| `apps/api`           | API NestJS 11 (Postgres, Drizzle, Swagger)                  |
| `packages/db`        | Schema Drizzle, client Postgres, migrations SQL versionnees |
| `packages/contracts` | Schemas Zod partages (erreurs, pagination, primitives)      |

## Prerequis

- Node >= 22
- pnpm 9 (`corepack enable`)
- Docker (Postgres local et tests d'integration)

## Demarrage

```sh
cp .env.example .env      # ajuster POSTGRES_PORT si 5440 est deja pris
pnpm install
pnpm db:up                # demarre Postgres
pnpm db:migrate           # applique les migrations
pnpm dev                  # API sur http://localhost:3000
```

- Swagger : http://localhost:3000/api/docs (hors production uniquement)
- Sondes : `/health/liveness`, `/health/readiness`

## Base de donnees

Toute la couche base vit dans `packages/db` :

```sh
pnpm db:generate   # genere le SQL apres modification du schema
pnpm db:migrate    # applique les migrations en attente
pnpm db:studio     # explorateur Drizzle
pnpm db:down       # arrete Postgres
```

Le schema est vide : le socle ne contient aucune entite metier. Pour ajouter une
table, creer un fichier dans `packages/db/src/schema/`, utiliser les helpers de
`src/columns.ts` (UUID v7 + `timestamptz`), la re-exporter depuis
`schema/index.ts`, puis lancer `db:generate` et `db:migrate`.

Les migrations ne sont **jamais** appliquees au demarrage de l'API : c'est une
etape explicite de deploiement.

## Conventions de l'API

- Routes metier prefixees `/api` et versionnees `/v1` (`@nestjs/common`
  `VersioningType.URI`). Les sondes de sante en sont exclues.
- Validation par schemas Zod via `nestjs-zod` (`createZodDto`), pipe global.
- Toutes les erreurs sortent en `application/problem+json` (RFC 9457), avec le
  detail par champ pour les echecs de validation. Voir
  `packages/contracts/src/problem.ts`.
- Un module par feature sous `apps/api/src/modules/`, le service appelant
  Drizzle via le token `DATABASE`.
- Configuration validee au demarrage : une variable manquante empeche le boot
  (`apps/api/src/config/env.schema.ts`).
- Logs JSON pino avec `x-request-id` de correlation ; en-tetes sensibles
  expurges.

## Qualite

```sh
pnpm lint
pnpm format:check
pnpm check-types
pnpm test          # necessite Docker (Testcontainers)
pnpm build
```

## Image de production

```sh
docker build -f apps/api/Dockerfile -t trekker-api .
docker run -e DATABASE_URL=... -e NODE_ENV=production -p 3000:3000 trekker-api
```

Build multi-stage (`turbo prune`), Node 22 alpine, utilisateur non-root,
`dumb-init` en PID 1 pour que SIGTERM declenche l'arret propre du pool Postgres.
