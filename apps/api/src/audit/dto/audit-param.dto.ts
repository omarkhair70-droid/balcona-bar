import { IsNotEmpty, IsUUID } from 'class-validator';

export class CompanyIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;
}
