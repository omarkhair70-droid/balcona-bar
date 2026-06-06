import type { PlatformAdminRole, PlatformAdminStatus } from "@prisma/client";

export type PlatformAdminSummary = {
  id: string;
  email: string;
  name: string;
  role: PlatformAdminRole;
  status: PlatformAdminStatus;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformAdminSessionSummary = {
  id: string;
  platformAdminUserId: string;
  status: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformAuthContext = {
  platformAdminUser: PlatformAdminSummary;
  platformAdminSession: PlatformAdminSessionSummary;
};
