import { newId, schema, type Database } from '@repo/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

export interface CreateAuthOptions {
  db: Database;
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
}

/**
 * Chemin de montage du handler Better Auth.
 *
 * Le handler est monte en middleware Express par `AuthModule`, donc en dehors
 * de `setGlobalPrefix('api')` et du versionnement URI : ce chemin est complet,
 * il ne recoit ni prefixe ni `/v1`. C'est voulu, `/api/auth/*` est du protocole
 * Better Auth consomme par `better-auth/client`, pas une route metier.
 */
export const AUTH_BASE_PATH = '/api/auth';

export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    basePath: AUTH_BASE_PATH,
    secret: options.secret,
    baseURL: options.baseUrl,
    trustedOrigins: options.trustedOrigins,

    database: drizzleAdapter(options.db, {
      provider: 'pg',
      // Les tables du projet sont au pluriel (`user` est un mot reserve SQL) ;
      // Better Auth nomme ses modeles au singulier.
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.rateLimits,
      },
    }),

    advanced: {
      database: {
        // Indispensable : sans ca Better Auth genere des chaines aleatoires qui
        // ne sont pas des UUID, et l'insert echoue sur nos colonnes `uuid`.
        generateId: newId,
      },
    },

    emailAndPassword: {
      enabled: true,
      // La verification d'email suppose un transport mail : chantier distinct.
      requireEmailVerification: false,
    },

    // `ThrottlerGuard` ne voit pas ces routes (middleware, pas route Nest) :
    // c'est l'unique protection de `sign-in/email` contre le bruteforce.
    // Stockage en base et non en memoire, qui repart a zero au redemarrage et
    // ment des la deuxieme instance.
    rateLimit: {
      enabled: true,
      storage: 'database',
    },

    // Le mobile n'a pas de jar de cookies : le jeton de session est renvoye
    // dans `set-auth-token` et rejoue en `Authorization: Bearer`.
    plugins: [bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
