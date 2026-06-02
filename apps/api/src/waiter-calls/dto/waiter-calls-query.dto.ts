import { IsIn, IsOptional } from 'class-validator';
import { WAITER_CALL_STATUSES, WAITER_CALL_TYPES } from './waiter-call-values';

export class WaiterCallsQueryDto {
  @IsOptional()
  @IsIn(WAITER_CALL_STATUSES)
  status?: (typeof WAITER_CALL_STATUSES)[number];

  @IsOptional()
  @IsIn([...WAITER_CALL_TYPES, 'all'])
  type?: (typeof WAITER_CALL_TYPES)[number] | 'all';
}
