import {
  trekListQuerySchema,
  trekListSchema,
  trekSchema,
} from '@repo/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * DTO derives des schemas de `@repo/contracts` : le contrat est ecrit une seule
 * fois et partage avec le web et le mobile. Aucun schema n'est defini ici.
 *
 * `ZodValidationPipe` est global, ces classes n'ont donc pas de pipe a declarer.
 */
export class TrekListQueryDto extends createZodDto(trekListQuerySchema) {}
export class TrekListDto extends createZodDto(trekListSchema) {}
export class TrekDto extends createZodDto(trekSchema) {}
