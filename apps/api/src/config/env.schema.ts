import { z } from 'zod';

/**
 * Schema des variables d'environnement.
 *
 * Toute variable manquante ou mal typee fait echouer le demarrage de
 * l'application : mieux vaut ne pas booter qu'exposer un service a moitie
 * configure. C'est la seule lecture de `process.env` du projet.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /** Origines CORS autorisees, separees par des virgules. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  /** Fenetre de rate limiting, en millisecondes. */
  THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),

  /** Nombre de requetes autorisees par fenetre et par IP. */
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Utilise par `ConfigModule.forRoot({ validate })`. Les erreurs Zod sont
 * remises en forme pour que le message de crash designe directement la
 * variable fautive.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuration d'environnement invalide :\n${details}\n\n` +
        'Verifier le fichier .env a la racine du repo (voir .env.example).',
    );
  }

  return result.data;
}
