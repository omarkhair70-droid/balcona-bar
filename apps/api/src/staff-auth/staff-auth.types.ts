import { Prisma } from '@prisma/client';

export type StaffAuthContext = {
  staffUser: SanitizedStaffUser;
  staffSession: SanitizedStaffSession;
  memberships: unknown[];
  effectiveAccess: unknown;
};

export type SanitizedStaffUser = {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SanitizedStaffSession = {
  id: string;
  companyId: string;
  branchId?: string | null;
  staffUserId: string;
  status: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StaffSessionRecord = Prisma.StaffSessionGetPayload<{
  select: {
    id: true;
    companyId: true;
    branchId: true;
    staffUserId: true;
    status: true;
    expiresAt: true;
    revokedAt: true;
    lastUsedAt: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

