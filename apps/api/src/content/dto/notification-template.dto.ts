import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  KEY_PATTERN,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_KINDS,
} from './content-values';

export class ListNotificationTemplatesQueryDto {
  @IsOptional()
  @IsIn(NOTIFICATION_KINDS)
  kind?: (typeof NOTIFICATION_KINDS)[number];

  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS)
  channel?: (typeof NOTIFICATION_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CreateNotificationTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(KEY_PATTERN)
  key!: string;

  @IsIn(NOTIFICATION_KINDS)
  kind!: (typeof NOTIFICATION_KINDS)[number];

  @IsIn(NOTIFICATION_CHANNELS)
  channel!: (typeof NOTIFICATION_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: unknown;
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(KEY_PATTERN)
  key?: string;

  @IsOptional()
  @IsIn(NOTIFICATION_KINDS)
  kind?: (typeof NOTIFICATION_KINDS)[number];

  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS)
  channel?: (typeof NOTIFICATION_CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: unknown;
}
