# apps/api — instructions

NestJS 11, Express, Postgres via Drizzle. Lire d'abord le `CLAUDE.md` de la
racine (frontières entre packages, contrats, base de données, environnement).

## Ajouter une feature

Un dossier par feature sous `src/modules/<feature>/` :

```
src/modules/treks/
  treks.module.ts
  treks.controller.ts
  treks.service.ts        # appelle Drizzle directement
  treks.dto.ts            # createZodDto sur les schémas de @repo/contracts
```

Architecture **feature module + service**. Le service injecte Drizzle et fait
ses requêtes. Ne pas introduire de couche repository, de mappers ou de ports &
adapters : ce n'est pas la convention du projet et ça n'a pas été retenu.

Le module se déclare dans les `imports` de `src/app.module.ts`.

### Injecter la base

```ts
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type Database } from '../../database/database.tokens';

@Injectable()
export class TreksService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
}
```

`DatabaseModule` est global : aucun import à ajouter. Le pool se ferme tout seul
au shutdown, ne pas le gérer dans un service.

### Valider les entrées

Les schémas viennent de `@repo/contracts`, jamais définis dans le contrôleur :

```ts
import { createZodDto } from 'nestjs-zod';
import { createTrekSchema } from '@repo/contracts';

export class CreateTrekDto extends createZodDto(createTrekSchema) {}
```

`ZodValidationPipe` est déclaré globalement dans `app.module.ts` : aucun
`@UsePipes` à écrire. Ne pas introduire `class-validator` — les DTO classes ne
sont pas partageables avec le mobile, ce qui est précisément le problème que
Zod résout ici.

### Routes

- Toutes les routes métier sont sous `/api` et versionnées `/v1`
  (`VersioningType.URI`, défaut `1`). Un `@Controller('treks')` répond donc sur
  `/api/v1/treks`.
- Breaking change destiné aux clients existants : créer une `@Version('2')`
  plutôt que modifier `v1` — une app mobile déjà installée continue d'appeler
  `v1`.
- `/health/*` est hors préfixe et `VERSION_NEUTRAL` : ne pas y toucher, les
  sondes de l'orchestrateur en dépendent.

## Authentification

Better Auth, via `@thallesp/nestjs-better-auth`. Instance construite par
`createAuth()` (`src/auth/auth.config.ts`), câblée par `src/auth/auth.module.ts`.
Le schéma des tables vit dans `packages/db/src/schema/auth.ts`.

**Toute route est protégée par défaut.** Un `AuthGuard` global exige une
session ; pour ouvrir une route, la décorer explicitement :

```ts
import {
  AllowAnonymous,
  OptionalAuth,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';

@Controller('treks')
export class TreksController {
  @Get() // protege : 401 sans session
  list(@Session() session: UserSession) {}

  @Get('publics')
  @AllowAnonymous() // ouvert
  publics() {}

  @Get('mixte')
  @OptionalAuth() // session injectee si presente, sinon undefined
  mixte(@Session() session?: UserSession) {}
}
```

### `/api/auth/*` est une frontière

Le handler Better Auth est monté en **middleware Express**, pas en contrôleur
Nest. Conséquences à connaître avant de debugger :

- il échappe à `setGlobalPrefix` et au versionnement : `/api/auth/sign-in/email`
  n'est **pas** `/api/v1/...`, et ne doit pas le devenir (les clients
  `better-auth` construisent ces URL eux-mêmes) ;
- il échappe à `ProblemDetailsFilter` : ces routes répondent au **format
  Better Auth** (`{ message, code }`), pas en RFC 9457. C'est assumé : réécrire
  ces réponses casserait `better-auth/client`. Le format RFC 9457 reste la
  règle pour **toutes** les routes métier ;
- il échappe à `ThrottlerGuard` : le rate limiting de ces routes est celui de
  Better Auth (`rateLimit`, stocké en base, table `rate_limits`).

### Sessions web et mobile

Le web utilise des cookies. Le mobile n'a pas de jar de cookies : le plugin
`bearer` renvoie le jeton dans l'en-tête `set-auth-token` à la connexion, que
le client rejoue en `Authorization: Bearer <token>`.

`BETTER_AUTH_TRUSTED_ORIGINS` (protection CSRF) est **distinct** de
`CORS_ORIGINS` : il accepte aussi des schemes applicatifs (`trekker://`) qu'un
navigateur n'enverrait jamais. Le CORS reste décidé uniquement dans
`configure-app.ts` (`disableTrustedOriginsCors: true` côté librairie).

### Pièges

- `bodyParser: false` est passé à `NestFactory.create` **et** à
  `createNestApplication` dans les tests : Better Auth lit le corps brut. La
  librairie remet les parsers pour les routes non-auth. L'oublier dans un test
  donne des corps de requête vides sur des routes sans rapport avec l'auth.
- `advanced.database.generateId: newId` est indispensable : les `id` sont des
  colonnes `uuid`, et Better Auth génère sinon des chaînes aléatoires.

## Erreurs

Lever les exceptions Nest habituelles (`NotFoundException`,
`BadRequestException`, ...). `ProblemDetailsFilter`
(`src/common/filters/problem-details.filter.ts`) les convertit toutes en
`application/problem+json` (RFC 9457), avec `requestId` de corrélation.

Ne jamais construire une réponse d'erreur à la main dans un contrôleur, ni
renvoyer un format d'enveloppe différent. Pour un nouveau type d'erreur métier,
étendre le filtre — pas le contourner.

## Logs

`nestjs-pino` est câblé globalement (`src/logger/logger.module.ts`). Injecter
`Logger` de `nestjs-pino` ou utiliser le `Logger` Nest ; ne jamais utiliser
`console.log`. Les en-têtes `authorization` et `cookie` sont expurgés — ne pas
logger de secrets à la main pour contourner ça.

## Configuration

Nouvelle variable d'environnement :

1. l'ajouter à `envSchema` dans `src/config/env.schema.ts` (avec un défaut si
   c'est raisonnable) ;
2. exposer un getter typé dans `AppConfigService` ;
3. l'ajouter à `.env.example` à la racine.

L'application refuse de démarrer si une variable manque : c'est voulu, ne pas
adoucir en défaut silencieux ce qui doit être fourni explicitement.

## Bootstrap

`configureApp(app)` (`src/configure-app.ts`) porte tout ce qui est commun à
l'application qui tourne et à celle des tests : helmet, compression, CORS,
préfixe global, versionnement. `main.ts` ne garde que ce qui lui est propre
(logger, shutdown hooks, Swagger, `listen`).

Ne pas re-déclarer ces réglages à la main dans un test : une divergence entre
les deux fait passer des tests sur une application qui n'est pas celle qui sert
le trafic.

## Tests

Vitest (`vitest.config.mts`), pas Jest. Le plugin SWC est nécessaire aux
décorateurs Nest — ne pas le retirer.

Les tests d'intégration passent par un vrai Postgres jetable :
`startTestDatabase()` (`test/setup/postgres.ts`) démarre un conteneur et
applique les migrations réelles. Pas de mock de la base.

Deux pièges vérifiés en pratique, à respecter dans tout nouveau test :

- `ConfigModule.forRoot()` valide l'environnement **à l'évaluation du module**.
  Poser les `process.env` d'abord, puis importer `AppModule` dynamiquement
  (`await import('../src/app.module.js')`), sinon le test échoue au chargement.
- En `NODE_ENV=test` le `.env` du poste est ignoré : les tests sont pilotés
  uniquement par `process.env`, et doivent le rester pour être déterministes.

Un guard global (rate limiting) ne s'exécute que sur une route effectivement
résolue : le tester via un 404 ne prouve rien.

## Production

`Dockerfile` multi-stage, Node 22 alpine, non-root, `dumb-init` en PID 1 pour
que SIGTERM déclenche les shutdown hooks. Swagger n'est monté qu'en dehors de la
production — ne pas l'exposer par défaut.
