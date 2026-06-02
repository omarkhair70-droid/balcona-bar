import { IsNotEmpty, IsUUID } from 'class-validator';

export class CompanyIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;
}

export class BranchIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}

export class ContentBlockIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  contentBlockId!: string;
}

export class NotificationTemplateIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  templateId!: string;
}
