import { IsIn, IsOptional } from 'class-validator';

export class BranchPreparationTasksQueryDto {
  @IsOptional()
  @IsIn(['barista', 'kitchen', 'dessert', 'all'])
  station?: 'barista' | 'kitchen' | 'dessert' | 'all';

  @IsOptional()
  @IsIn(['pending', 'preparing', 'ready', 'cancelled', 'all'])
  status?: 'pending' | 'preparing' | 'ready' | 'cancelled' | 'all';
}
