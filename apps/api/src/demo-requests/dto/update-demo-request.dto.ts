import { DemoRequestStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateDemoRequestDto {
  @IsOptional()
  @IsEnum(DemoRequestStatus)
  status?: DemoRequestStatus;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string;

  @IsOptional()
  @IsISO8601()
  lastContactedAt?: string;
}
