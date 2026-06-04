import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReprintKitchenTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
