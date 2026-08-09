import { z } from 'zod';

import {
  geotrekDifficultySchema,
  geotrekPageSchema,
  geotrekRouteSchema,
  geotrekTrekSchema,
  type GeotrekReferentials,
  type GeotrekTrek,
} from './geotrek.types';

/**
 * Client de l'API Geotrek v2.
 *
 * Volontairement en dehors de Nest : il sert a un script d'import lance a la
 * main, pas a une requete HTTP entrante. L'injecter dans le conteneur
 * imposerait de demarrer l'application pour peupler une base.
 */

/**
 * Taille de page. Geotrek accepte davantage, mais chaque trek embarque sa trace
 * complete : au-dela, certaines instances mettent plusieurs dizaines de
 * secondes a repondre, voire expirent.
 */
const PAGE_SIZE = 50;

export interface GeotrekClientOptions {
  /** Injectable pour les tests ; `globalThis.fetch` par defaut. */
  fetchFn?: typeof fetch;
}

export class GeotrekApiError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`Geotrek a repondu ${status} sur ${url}`);
    this.name = 'GeotrekApiError';
  }
}

export class GeotrekClient {
  private readonly fetchFn: typeof fetch;

  constructor(options: GeotrekClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private async getJson(url: string): Promise<unknown> {
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new GeotrekApiError(url, response.status);
    }

    return response.json();
  }

  /**
   * Parcourt toutes les pages d'un endpoint en suivant le lien `next` fourni
   * par l'API plutot qu'en incrementant un numero de page : c'est la seule
   * forme qui reste correcte si l'instance change sa pagination.
   */
  private async *paginate<T extends z.ZodType>(
    baseUrl: string,
    resource: string,
    item: T,
  ): AsyncGenerator<z.infer<T>> {
    const pageSchema = geotrekPageSchema(item);
    let url: string | null =
      `${baseUrl}/${resource}/?format=json&language=fr&page_size=${PAGE_SIZE}`;

    while (url !== null) {
      const page = pageSchema.parse(await this.getJson(url));

      for (const result of page.results) {
        yield result as z.infer<T>;
      }

      url = page.next;
    }
  }

  /**
   * Referentiels de difficulte et de type de parcours. Chaque instance
   * numerote les siens : ils doivent etre resolus avant de mapper ses treks.
   */
  async fetchReferentials(baseUrl: string): Promise<GeotrekReferentials> {
    const difficulties = new Map<
      number,
      z.infer<typeof geotrekDifficultySchema>
    >();
    const routes = new Map<number, z.infer<typeof geotrekRouteSchema>>();

    for await (const difficulty of this.paginate(
      baseUrl,
      'trek_difficulty',
      geotrekDifficultySchema,
    )) {
      difficulties.set(difficulty.id, difficulty);
    }

    for await (const route of this.paginate(
      baseUrl,
      'trek_route',
      geotrekRouteSchema,
    )) {
      routes.set(route.id, route);
    }

    return { difficulties, routes };
  }

  /**
   * Treks publies d'une instance.
   *
   * Les enregistrements qui ne satisfont pas le schema sont ecartes et
   * comptes, jamais devines : une geometrie multiple ou un champ manquant
   * concerne une poignee de fiches, et faire echouer tout l'import pour elles
   * rendrait le peuplement impossible. Le decompte est retourne pour que
   * l'appelant le rende visible.
   */
  async fetchTreks(
    baseUrl: string,
  ): Promise<{ treks: GeotrekTrek[]; skipped: number }> {
    const treks: GeotrekTrek[] = [];
    let skipped = 0;

    for await (const raw of this.paginate(baseUrl, 'trek', z.unknown())) {
      const parsed = geotrekTrekSchema.safeParse(raw);

      if (!parsed.success) {
        skipped += 1;
        continue;
      }

      if (parsed.data.published === false) {
        skipped += 1;
        continue;
      }

      treks.push(parsed.data);
    }

    return { treks, skipped };
  }
}
