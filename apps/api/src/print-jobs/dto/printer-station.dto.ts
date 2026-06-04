import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePrinterStationDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  slug!: string;

  @IsOptional()
  @IsIn(['barista', 'kitchen', 'dessert', 'cashier'])
  station?: 'barista' | 'kitchen' | 'dessert' | 'cashier' | null;

  @IsOptional()
  @IsIn(['mock', 'browser_print', 'escpos_lan', 'escpos_usb', 'external'])
  adapterType?: 'mock' | 'browser_print' | 'escpos_lan' | 'escpos_usb' | 'external';

  @IsOptional()
  @IsIn(['active', 'inactive', 'maintenance'])
  status?: 'active' | 'inactive' | 'maintenance';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;
}

export class UpdatePrinterStationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsIn(['barista', 'kitchen', 'dessert', 'cashier'])
  station?: 'barista' | 'kitchen' | 'dessert' | 'cashier' | null;

  @IsOptional()
  @IsIn(['mock', 'browser_print', 'escpos_lan', 'escpos_usb', 'external'])
  adapterType?: 'mock' | 'browser_print' | 'escpos_lan' | 'escpos_usb' | 'external';

  @IsOptional()
  @IsIn(['active', 'inactive', 'maintenance'])
  status?: 'active' | 'inactive' | 'maintenance';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;
}
