import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  buildPaginationMeta,
  toLimitOffset,
  type Trek,
  type TrekList,
  type TrekListQuery,
  type TrekSummary,
} from '@repo/contracts';
import { schema } from '@repo/db';
import { and, asc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.tokens';

const { treks } = schema;

/**
 * Lecture du catalogue d'itineraires.
 *
 * Les colonnes geographiques ne sont jamais selectionnees telles quelles : le
 * driver les renverrait en EWKB hexadecimal. Elles passent toutes par
 * `ST_AsGeoJSON(...)::json`, le cast `::json` etant ce qui fait rendre un objet
 * deja analyse plutot qu'une chaine.
 */
@Injectable()
export class TreksService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Colonnes communes aux deux routes : tout sauf la trace. */
  private get summaryColumns() {
    return {
      id: treks.id,
      name: treks.name,
      distanceMeters: treks.distanceMeters,
      ascentMeters: treks.ascentMeters,
      descentMeters: treks.descentMeters,
      durationMinutes: treks.durationMinutes,
      difficulty: treks.difficulty,
      sourceDifficulty: treks.sourceDifficulty,
      routeType: treks.routeType,
      source: treks.source,
      license: treks.license,
      sourceUrl: treks.sourceUrl,
      createdAt: treks.createdAt,
      updatedAt: treks.updatedAt,
      startPoint: sql<
        TrekSummary['startPoint']
      >`ST_AsGeoJSON(${treks.startPoint})::json`.as('start_point_geojson'),
    };
  }

  /**
   * Point de reference de la recherche par proximite, en `geography` : c'est
   * sous cette forme que `ST_DWithin` raisonne en metres, et c'est l'expression
   * que porte l'index GiST de la table.
   */
  private static referencePoint(lat: number, lon: number): SQL {
    return sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`;
  }

  async findMany(query: TrekListQuery): Promise<TrekList> {
    const conditions: SQL[] = [];

    if (query.difficulty !== undefined) {
      conditions.push(eq(treks.difficulty, query.difficulty));
    }

    if (query.minDistanceMeters !== undefined) {
      conditions.push(gte(treks.distanceMeters, query.minDistanceMeters));
    }

    if (query.maxDistanceMeters !== undefined) {
      conditions.push(lte(treks.distanceMeters, query.maxDistanceMeters));
    }

    // Le contrat garantit que les trois parametres vont ensemble : tester `lat`
    // suffit a etablir la presence des deux autres.
    const nearby =
      query.lat !== undefined
        ? TreksService.referencePoint(query.lat, query.lon as number)
        : null;

    if (nearby) {
      conditions.push(
        sql`ST_DWithin(${treks.startPoint}::geography, ${nearby}, ${(query.radiusKm as number) * 1000})`,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const { limit, offset } = toLimitOffset(query);

    const [rows, total] = await Promise.all([
      this.db
        .select(this.summaryColumns)
        .from(treks)
        .where(where)
        // Sans point de reference, l'ordre alphabetique : une liste paginee
        // sans tri deterministe rendrait des doublons entre deux pages.
        .orderBy(
          nearby
            ? sql`ST_Distance(${treks.startPoint}::geography, ${nearby})`
            : asc(treks.name),
        )
        .limit(limit)
        .offset(offset),
      // `$count` rend directement un nombre : un `select count(*)` obligerait a
      // indexer un tableau, donc a traiter un cas vide qui ne peut pas survenir.
      this.db.$count(treks, where),
    ]);

    return {
      data: rows.map(toSummary),
      meta: buildPaginationMeta(query, total),
    };
  }

  async findOne(id: string): Promise<Trek> {
    const [row] = await this.db
      .select({
        ...this.summaryColumns,
        description: treks.description,
        geometry: sql<
          Trek['geometry']
        >`ST_AsGeoJSON(${treks.geometry})::json`.as('geometry_geojson'),
      })
      .from(treks)
      .where(eq(treks.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Aucun itineraire pour l'identifiant ${id}.`);
    }

    return {
      ...toSummary(row),
      description: row.description,
      geometry: row.geometry,
    };
  }
}

/**
 * Ligne telle que rendue par `summaryColumns`. Les horodatages arrivent en
 * `Date` (mode `date` des colonnes) et sortent en ISO 8601, comme l'exige
 * `timestampSchema`.
 */
type TrekSummaryRow = Omit<TrekSummary, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(row: TrekSummaryRow): TrekSummary {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
