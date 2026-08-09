import { z } from 'zod';

/** Content-Type des reponses d'erreur (RFC 9457). */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * Reponse d'erreur au format RFC 9457 (`application/problem+json`).
 * Toutes les erreurs de l'API respectent cette forme : le front web et le
 * client mobile peuvent partager un seul parseur d'erreurs.
 */
export const problemDetailsSchema = z.object({
  /** URI identifiant le type d'erreur. `about:blank` si non specialise. */
  type: z.string().default('about:blank'),
  /** Resume court et stable du type d'erreur. */
  title: z.string(),
  /** Code de statut HTTP, repete ici pour les clients qui ne lisent que le corps. */
  status: z.int().min(100).max(599),
  /** Explication specifique a cette occurrence. */
  detail: z.string().optional(),
  /** URI de la requete ayant produit l'erreur. */
  instance: z.string().optional(),
  /** Identifiant de correlation, a retrouver dans les logs. */
  requestId: z.string().optional(),
});

/** Une erreur de validation portant sur un champ precis de la requete. */
export const validationIssueSchema = z.object({
  /** Chemin du champ en notation pointee (`adresse.ville`, `items.0.nom`). */
  path: z.string(),
  /** Message lisible. */
  message: z.string(),
  /** Code Zod a l'origine de l'erreur (`invalid_type`, `too_small`, ...). */
  code: z.string(),
});

/**
 * Extension de `problemDetails` pour les echecs de validation (HTTP 422),
 * avec le detail par champ.
 */
export const validationProblemSchema = problemDetailsSchema.extend({
  errors: z.array(validationIssueSchema),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationProblem = z.infer<typeof validationProblemSchema>;
