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
  },
  plugins: [
    // Indispensable : Nest s'appuie sur les decorateurs et sur
    // `emitDecoratorMetadata`, que esbuild (defaut de Vitest) ne genere pas.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
