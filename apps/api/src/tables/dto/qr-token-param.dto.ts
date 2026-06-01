import { IsNotEmpty, IsString } from 'class-validator';

export class QrTokenParamDto {
  @IsString()
  @IsNotEmpty()
  qrToken!: string;
}
