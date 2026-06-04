import { IsUUID } from 'class-validator';

export class BillIdParamDto {
  @IsUUID()
  billId!: string;
}
