import {
  ExperienceProfileScope,
  ExperienceProfileStatus,
} from '@prisma/client';

export const EXPERIENCE_PROFILE_STATUSES = [
  ExperienceProfileStatus.draft,
  ExperienceProfileStatus.active,
  ExperienceProfileStatus.archived,
] as const;

export const EXPERIENCE_PROFILE_SCOPES = [
  ExperienceProfileScope.company,
  ExperienceProfileScope.branch,
] as const;

export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
