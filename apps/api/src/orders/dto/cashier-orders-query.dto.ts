import { IsIn, IsOptional } from 'class-validator';

export class CashierOrdersQueryDto {
  @IsOptional()
  @IsIn([
    'submitted',
    'cashier_accepted',
    'preparing',
    'ready',
    'served',
    'completed',
    'cashier_rejected',
    'cancelled',
    'all',
  ])
  status?:
    | 'submitted'
    | 'cashier_accepted'
    | 'preparing'
    | 'ready'
    | 'served'
    | 'completed'
    | 'cashier_rejected'
    | 'cancelled'
    | 'all';
}
