import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  BRANCH_REALTIME_STREAM_CHANNELS,
  BranchRealtimeStreamChannel,
  REALTIME_EVENT_TYPES,
  RealtimeEventTypeValue,
} from './realtime-event-values';

export class BranchRealtimeEventsQueryDto {
  @IsOptional()
  @IsIn([...BRANCH_REALTIME_STREAM_CHANNELS])
  channel?: BranchRealtimeStreamChannel;

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
