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

export class CategoryIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;
}

export class ItemIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;
}

export class GroupIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  groupId!: string;
}

export class OptionIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  optionId!: string;
}

export class ItemModifierGroupLinkParamDto extends ItemIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  linkId!: string;
}

export class BranchItemOverrideParamDto extends BranchIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;
}
