import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

