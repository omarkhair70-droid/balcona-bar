import { IsUUID } from 'class-validator';

export class PrintJobIdParamDto {
  @IsUUID('4')
  printJobId!: string;
}

export class PrinterStationIdParamDto {
  @IsUUID('4')
  printerStationId!: string;
}
