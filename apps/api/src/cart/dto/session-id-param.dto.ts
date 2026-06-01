import { IsUUID } from 'class-validator';

export class SessionIdParamDto {
  @IsUUID('4')
  sessionId!: string;
}
