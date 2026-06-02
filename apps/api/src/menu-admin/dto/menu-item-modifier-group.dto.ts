import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

export class CreateMenuItemModifierGroupDto {
  @IsUUID()
  modifierGroupId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuItemModifierGroupDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
