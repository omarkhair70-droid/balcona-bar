import { IsIn, IsOptional } from 'class-validator';
import {
  SESSION_REALTIME_STREAM_CHANNELS,
  SessionRealtimeStreamChannel,
} from './realtime-event-values';

export class SessionRealtimeQueryDto {
  @IsOptional()
  @IsIn([...SESSION_REALTIME_STREAM_CHANNELS])
  channel?: SessionRealtimeStreamChannel;
}
