import { IsOptional, IsString } from 'class-validator';

export class StaffLogoutDto {
  @IsOptional()
  @IsString()
  token?: string;
}

