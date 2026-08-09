import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Trek, TrekList } from '@repo/contracts';

import { TrekDto, TrekListDto, TrekListQueryDto } from './treks.dto';
import { TreksService } from './treks.service';

/**
 * Catalogue d'itineraires, sur `/api/v1/treks`.
 *
 * Aucun `@AllowAnonymous()` : l'`AuthGuard` global s'applique, une session est
 * donc requise. C'est un choix produit, pas un oubli — le catalogue n'est pas
 * consultable avant inscription.
 */
@ApiTags('treks')
@Controller('treks')
export class TreksController {
  constructor(private readonly treks: TreksService) {}

  @Get()
  @ApiOkResponse({ type: TrekListDto })
  list(@Query() query: TrekListQueryDto): Promise<TrekList> {
    return this.treks.findMany(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: TrekDto })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<Trek> {
    return this.treks.findOne(id);
  }
}
