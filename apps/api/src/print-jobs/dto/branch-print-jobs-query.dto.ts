import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BranchPrintJobsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'printing', 'printed', 'failed', 'cancelled', 'reprint_requested', 'all'])
  status?: 'pending' | 'printing' | 'printed' | 'failed' | 'cancelled' | 'reprint_requested' | 'all';

  @IsOptional()
  @IsIn(['barista', 'kitchen', 'dessert', 'cashier', 'all'])
  station?: 'barista' | 'kitchen' | 'dessert' | 'cashier' | 'all';

  @IsOptional()
  @IsIn(['kitchen_ticket', 'barista_ticket', 'dessert_ticket', 'receipt', 'void_ticket', 'all'])
  kind?: 'kitchen_ticket' | 'barista_ticket' | 'dessert_ticket' | 'receipt' | 'void_ticket' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
