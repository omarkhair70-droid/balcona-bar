import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MENU_CATEGORY_STATUSES,
  MENU_ITEM_STATUSES,
  MODIFIER_GROUP_STATUSES,
  PREPARATION_STATIONS,
} from './menu-admin-values';

export class MenuAdminLimitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ListMenuCategoriesQueryDto extends MenuAdminLimitQueryDto {
  @IsOptional()
  @IsIn([...MENU_CATEGORY_STATUSES, 'all'])
  status?: (typeof MENU_CATEGORY_STATUSES)[number] | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListMenuItemsQueryDto extends MenuAdminLimitQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn([...MENU_ITEM_STATUSES, 'all'])
  status?: (typeof MENU_ITEM_STATUSES)[number] | 'all';

  @IsOptional()
  @IsIn(PREPARATION_STATIONS)
  station?: (typeof PREPARATION_STATIONS)[number];

  @IsOptional()
  @IsBooleanString()
  featured?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListModifierGroupsQueryDto extends MenuAdminLimitQueryDto {
  @IsOptional()
  @IsIn([...MODIFIER_GROUP_STATUSES, 'all'])
  status?: (typeof MODIFIER_GROUP_STATUSES)[number] | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListBranchItemOverridesQueryDto extends MenuAdminLimitQueryDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsBooleanString()
  available?: string;

  @IsOptional()
  @IsBooleanString()
  visible?: string;
}
