import { IsNotEmpty, IsUUID } from 'class-validator';

export class StaffUserIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  staffUserId!: string;
}
