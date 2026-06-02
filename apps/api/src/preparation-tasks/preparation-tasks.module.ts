import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PreparationTasksController } from './preparation-tasks.controller';
import { PreparationTasksService } from './preparation-tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [PreparationTasksController],
  providers: [PreparationTasksService],
  exports: [PreparationTasksService],
})
export class PreparationTasksModule {}
