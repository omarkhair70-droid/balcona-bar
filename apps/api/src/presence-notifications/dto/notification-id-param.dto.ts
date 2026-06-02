import { IsNotEmpty, IsUUID } from 'class-validator';

export class NotificationIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  notificationId!: string;
}
