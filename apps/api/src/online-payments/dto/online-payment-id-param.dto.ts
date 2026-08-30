import { IsUUID } from "class-validator";

export class OnlinePaymentIntentIdParamDto {
  @IsUUID()
  intentId!: string;
}

export class OnlinePaymentOperationIdParamDto {
  @IsUUID()
  operationId!: string;
}
