/**
 * Schema de la base.
 *
 * Chaque table va dans son propre fichier de ce dossier, utilise les helpers
 * de `../columns` (UUID v7 + timestamptz), et est re-exportee ici.
 *
 * Exemple :
 *   export * from './treks';
 */

export * from './auth';
export * from './treks';
