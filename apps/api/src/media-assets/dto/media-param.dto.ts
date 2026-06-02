import { IsNotEmpty, IsUUID } from 'class-validator';

export class CompanyIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;
}

export class MediaAssetIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  mediaAssetId!: string;
}

export class MediaUsageIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  usageId!: string;
}
