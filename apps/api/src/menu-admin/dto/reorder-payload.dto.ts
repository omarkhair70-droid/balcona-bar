import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ReorderItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsInt()
  sortOrder!: number;
}

export class ReorderPayloadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
