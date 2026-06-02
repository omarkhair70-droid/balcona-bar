import { IsIn, IsOptional } from 'class-validator';
import {
  BRANCH_REALTIME_STREAM_CHANNELS,
  BranchRealtimeStreamChannel,
} from './realtime-event-values';

export class BranchRealtimeQueryDto {
  @IsOptional()
  @IsIn([...BRANCH_REALTIME_STREAM_CHANNELS])
  channel?: BranchRealtimeStreamChannel;
}
