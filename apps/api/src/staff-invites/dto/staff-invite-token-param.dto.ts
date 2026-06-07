import { IsNotEmpty, IsString } from "class-validator";

export class StaffInviteTokenParamDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
