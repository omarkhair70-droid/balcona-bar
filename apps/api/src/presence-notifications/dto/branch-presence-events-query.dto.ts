import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PRESENCE_TRIGGER_TYPES } from './create-presence-event.dto';

export class BranchPresenceEventsQueryDto {
  @IsOptional()
  @IsIn(PRESENCE_TRIGGER_TYPES)
  triggerType?: (typeof PRESENCE_TRIGGER_TYPES)[number];

  @IsOptional()
  @IsUUID()
  tableSessionId?: string;
}
