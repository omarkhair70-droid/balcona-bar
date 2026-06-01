import { IsIn, IsOptional } from 'class-validator';

export class CashierOrdersQueryDto {
  @IsOptional()
  @IsIn(['submitted', 'cashier_accepted', 'cashier_rejected', 'all'])
  status?: 'submitted' | 'cashier_accepted' | 'cashier_rejected' | 'all';
}
