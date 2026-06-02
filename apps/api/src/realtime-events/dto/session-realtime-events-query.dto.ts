import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  REALTIME_EVENT_TYPES,
  RealtimeEventTypeValue,
  SESSION_REALTIME_STREAM_CHANNELS,
  SessionRealtimeStreamChannel,
} from './realtime-event-values';

export class SessionRealtimeEventsQueryDto {
  @IsOptional()
  @IsIn([...SESSION_REALTIME_STREAM_CHANNELS])
  channel?: SessionRealtimeStreamChannel;

  @IsOptional()
  @IsIn([...REALTIME_EVENT_TYPES])
  type?: RealtimeEventTypeValue;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
