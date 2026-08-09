import { GeotrekClient } from '../modules/treks/geotrek/geotrek.client';
import {
  GEOTREK_INSTANCES,
  type GeotrekInstance,
} from '../modules/treks/geotrek/geotrek.instances';
import { toTrekRow } from '../modules/treks/geotrek/geotrek.mapper';
import type { TrekImportRow } from '../modules/treks/geotrek/geotrek.types';

/**
 * Import : reseau vers fichier.
 *
 * Separe du seed a dessein. Le seed doit rester deterministe et executable hors
 * ligne — condition pour qu'il serve aussi aux tests ; l'import, lui, depend
 * d'API tierces et de leur disponibilite. Rafraichir les donnees devient alors
 * un acte explicite, dont le resultat se relit dans un diff.
 */

export interface InstanceImportReport {
  instance: string;
  imported: number;
  /** Fiches ecartees : hors schema, geometrie non lineaire, ou non publiees. */
  skipped: number;
}

export interface ImportResult {
  rows: TrekImportRow[];
  reports: InstanceImportReport[];
}

export interface ImportOptions {
  client?: GeotrekClient;
  instances?: GeotrekInstance[];
  /** Trace de progression ; muette par defaut pour ne pas polluer les tests. */
  log?: (message: string) => void;
}

/**
 * Parcourt la liste blanche et produit les lignes pretes a inserer.
 *
 * L'echec d'une instance n'interrompt pas les autres : une API indisponible est
 * un incident courant, et perdre l'import complet pour elle rendrait le
 * peuplement dependant du plus fragile des publicateurs. L'incident est
 * remonte, jamais tu.
 */
export async function importTreks(
  options: ImportOptions = {},
): Promise<ImportResult> {
  const client = options.client ?? new GeotrekClient();
  const instances = options.instances ?? GEOTREK_INSTANCES;
  const log = options.log ?? (() => {});

  const rows: TrekImportRow[] = [];
  const reports: InstanceImportReport[] = [];

  for (const instance of instances) {
    log(`Import de ${instance.key}...`);

    try {
      const referentials = await client.fetchReferentials(instance.apiBaseUrl);
      const { treks, skipped } = await client.fetchTreks(instance.apiBaseUrl);

      for (const trek of treks) {
        rows.push(toTrekRow(trek, instance, referentials));
      }

      reports.push({ instance: instance.key, imported: treks.length, skipped });
      log(`  ${treks.length} itineraires, ${skipped} ecartes.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      reports.push({ instance: instance.key, imported: 0, skipped: 0 });
      log(`  Echec : ${reason}`);
    }
  }

  return { rows, reports };
}
