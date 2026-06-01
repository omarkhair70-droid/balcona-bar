import { IsNotEmpty, IsString } from 'class-validator';

export class CompanySlugParamDto {
  @IsString()
  @IsNotEmpty()
  companySlug!: string;
}
