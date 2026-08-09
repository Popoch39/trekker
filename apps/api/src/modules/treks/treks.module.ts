import { Module } from '@nestjs/common';

import { TreksController } from './treks.controller';
import { TreksService } from './treks.service';

/** `DatabaseModule` etant global, il n'y a rien a importer ici. */
@Module({
  controllers: [TreksController],
  providers: [TreksService],
})
export class TreksModule {}
