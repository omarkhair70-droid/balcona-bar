import { IsString, MinLength } from "class-validator";

export class AcceptStaffInviteDto {
  @IsString()
  @MinLength(12)
  password!: string;
}
