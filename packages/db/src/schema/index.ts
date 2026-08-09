/**
 * Schema de la base.
 *
 * Volontairement vide : le socle ne contient aucune entite metier. Chaque
 * nouvelle table va dans son propre fichier de ce dossier, utilise les helpers
 * de `../columns` (UUID v7 + timestamptz), et est re-exportee ici.
 *
 * Exemple :
 *   export * from './treks';
 */

/** Marqueur de module tant qu'aucune table n'est declaree. A retirer ensuite. */
export type EmptySchema = never;
