import { IsUUID } from 'class-validator';

export class OrderIdParamDto {
  @IsUUID('4')
  orderId!: string;
}
