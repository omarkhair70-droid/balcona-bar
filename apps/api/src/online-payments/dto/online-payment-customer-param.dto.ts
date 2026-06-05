import { IsUUID } from "class-validator";

export class CustomerBillOnlinePaymentParamDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  billId!: string;
}

export class CustomerOnlinePaymentIntentParamDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  intentId!: string;
}
