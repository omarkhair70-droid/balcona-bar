import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BranchKitchenTicketsQueryDto {
  @IsOptional()
  @IsIn(['barista', 'kitchen', 'dessert', 'all'])
  station?: 'barista' | 'kitchen' | 'dessert' | 'all';

  @IsOptional()
  @IsIn(['queued', 'in_progress', 'ready', 'served', 'cancelled', 'voided', 'all'])
  status?: 'queued' | 'in_progress' | 'ready' | 'served' | 'cancelled' | 'voided' | 'all';

  @IsOptional()
  @IsIn(['kitchen_order', 'barista_order', 'dessert_order', 'receipt', 'void', 'reprint', 'all'])
  type?: 'kitchen_order' | 'barista_order' | 'dessert_order' | 'receipt' | 'void' | 'reprint' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
