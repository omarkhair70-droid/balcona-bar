import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PreparationTasksModule } from '../preparation-tasks/preparation-tasks.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, CartModule, PreparationTasksModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
