export type ApiQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean | null | undefined)[];

export type ApiQueryParams = Record<string, ApiQueryValue>;

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  status?: string;
};

export type BranchSummary = {
  id: string;
  companyId?: string;
  name: string;
  slug: string;
  address?: string | null;
  status?: string;
};

export type BranchEffectiveExperience = {
  branchId: string;
  companyId?: string;
  profileId?: string;
  key?: string;
  name?: string;
  theme?: Record<string, unknown> | null;
  designTokens?: Record<string, unknown> | null;
};

export type StartTableSessionPayload = {
  qrToken: string;
  guestLabel?: string;
  partySize?: number;
};

export type TableSessionSummary = {
  id: string;
  companyId: string;
  branchId: string;
  tableId: string;
  status: string;
  source?: string;
  guestLabel?: string | null;
  partySize?: number | null;
  startedAt?: string;
  lastSeenAt?: string;
  expiresAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TableSessionFloorSummary = {
  id: string;
  name: string;
  sortOrder: number;
};

export type TableSessionTableSummary = {
  id: string;
  code: string;
  displayName?: string | null;
  capacity?: number | null;
  qrToken: string;
  status: string;
};

export type CustomerAccessSummary = {
  customerAccessToken: string;
  customerAccessTokenExpiresAt: string | null;
  customerSessionIdentityId: string;
};

export type StartTableSessionResult = {
  session: TableSessionSummary;
  company: CompanySummary;
  branch: BranchSummary;
  floor: TableSessionFloorSummary | null;
  table: TableSessionTableSummary;
  wasResumed: boolean;
  customerAccess: CustomerAccessSummary;
};

export type StaffLoginPayload = {
  email: string;
  password: string;
  branchId?: string;
};

export type StaffLoginResult = {
  accessToken: string;
  expiresAt: string;
  staffUser: StaffUserSummary;
  staffSession: StaffSessionSummary;
  memberships: StaffMembershipSummary[];
  effectivePermissions: string[];
  effectiveAccess: StaffEffectiveAccess;
  defaultBranch: BranchSummary | null;
};

export type StaffUserSummary = {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffSessionSummary = {
  id: string;
  companyId: string;
  branchId?: string | null;
  staffUserId: string;
  status: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffMembershipSummary = {
  id: string;
  role: string;
  status: string;
  scope: "branch" | "company";
  company: CompanySummary;
  branch: BranchSummary | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffEffectiveCompanyAccess = {
  company: CompanySummary;
  branchScope: "all_branches" | "selected_branches";
  roles: string[];
  permissions: string[];
};

export type StaffEffectiveBranchAccess = {
  company: CompanySummary;
  branch: BranchSummary;
  source: "company_membership" | "branch_membership" | "mixed";
  roles: string[];
  permissions: string[];
};

export type StaffEffectiveAccess = {
  companies: StaffEffectiveCompanyAccess[];
  branches: StaffEffectiveBranchAccess[];
  roles: string[];
  permissions: string[];
};
