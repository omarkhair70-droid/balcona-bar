import { IsUUID } from 'class-validator';

export class CashierShiftIdParamDto {
  @IsUUID()
  shiftId!: string;
}
