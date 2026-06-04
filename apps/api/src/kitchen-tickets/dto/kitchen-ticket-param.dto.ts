import { IsUUID } from 'class-validator';

export class KitchenTicketIdParamDto {
  @IsUUID('4')
  ticketId!: string;
}
