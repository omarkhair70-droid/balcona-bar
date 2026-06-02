import { IsNotEmpty, IsUUID } from "class-validator";

export class AiWaiterSessionIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  aiWaiterSessionId!: string;
}
