import { IsIn, IsNotEmpty } from 'class-validator';
import { BRANCH_FEATURE_FLAG_KEYS } from './branch-settings-values';

export class FeatureFlagKeyParamDto {
  @IsIn(BRANCH_FEATURE_FLAG_KEYS)
  @IsNotEmpty()
  key!: (typeof BRANCH_FEATURE_FLAG_KEYS)[number];
}
