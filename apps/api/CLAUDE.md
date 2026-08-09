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
