import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  OnlinePaymentReconciliationIssueStatus,
  OnlinePaymentReconciliationMovementType,
} from "@prisma/client";

export class StartOnlinePaymentReconciliationDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsString()
  @MaxLength(12)
  currency!: string;

  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;
}

export class SettlementStatementLineDto {
  @IsString()
  @MaxLength(160)
  providerTransactionId!: string;

  @IsEnum(OnlinePaymentReconciliationMovementType)
  movementType!: OnlinePaymentReconciliationMovementType;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsInt()
  @Min(0)
  feeMinor!: number;

  @IsInt()
  netMinor!: number;

  @IsString()
  @MaxLength(12)
  currency!: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  settlementReference?: string;

  @IsDateString()
  @IsOptional()
  settledAt?: string;
}

export class ImportOnlinePaymentSettlementDto {
  @IsString()
  @MaxLength(200)
  externalReference!: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  payoutReference?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsDateString()
  @IsOptional()
  settledAt?: string;

  @IsString()
  @MaxLength(12)
  currency!: string;

  @IsInt()
  @Min(0)
  grossMinor!: number;

  @IsInt()
  @Min(0)
  adjustmentMinor!: number;

  @IsInt()
  @Min(0)
  feeMinor!: number;

  @IsInt()
  netMinor!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SettlementStatementLineDto)
  lines!: SettlementStatementLineDto[];
}

export class ReconciliationRunsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

export class ReconciliationIssuesQueryDto {
  @IsEnum(OnlinePaymentReconciliationIssueStatus)
  @IsOptional()
  status?: OnlinePaymentReconciliationIssueStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

export class ReconciliationIssueActionDto {
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}

export class OnlinePaymentReconciliationRunIdParamDto {
  @IsUUID()
  runId!: string;
}

export class OnlinePaymentSettlementBatchIdParamDto {
  @IsUUID()
  batchId!: string;
}

export class OnlinePaymentReconciliationIssueIdParamDto {
  @IsUUID()
  issueId!: string;
}
