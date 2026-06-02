import { IsUUID } from 'class-validator';

export class BillRequestIdParamDto {
  @IsUUID('4')
  billRequestId!: string;
}
