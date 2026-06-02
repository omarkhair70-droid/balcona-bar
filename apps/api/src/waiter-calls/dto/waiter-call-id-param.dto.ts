import { IsNotEmpty, IsUUID } from 'class-validator';

export class WaiterCallIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  waiterCallId!: string;
}
