import { IsNotEmpty, IsUUID } from 'class-validator';

export class SessionIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  sessionId!: string;
}
