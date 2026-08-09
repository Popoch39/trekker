import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // Testcontainers doit demarrer Postgres : large, mais atteint en pratique
    // seulement au premier telechargement de l'image.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        // Declaratif pur : couvrir un `@Module({...})` ou un `createZodDto`
        // ne prouve rien sur le comportement.
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        // Amorces de scripts (`require.main === module`) : non testables sans
        // lancer un process. La logique qu'elles appellent est, elle, exportee
        // et couverte a 100 %.
        'src/scripts/*.bin.ts',
      ],
      /**
       * Seuils bloquants, restreints par glob aux modules metier : le socle
       * (bootstrap, config, auth) n'est pas encore couvert et le contraindre
       * ici transformerait chaque ajout en chantier de rattrapage.
       */
      thresholds: {
        'src/modules/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        'src/scripts/**/*.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
  plugins: [
    // Indispensable : Nest s'appuie sur les decorateurs et sur
    // `emitDecoratorMetadata`, que esbuild (defaut de Vitest) ne genere pas.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
