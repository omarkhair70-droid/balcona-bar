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
  branchId: string;
  tableId: string;
  status: string;
  guestLabel?: string | null;
  partySize?: number | null;
};

export type StaffLoginPayload = {
  email: string;
  password: string;
  branchId?: string;
};

export type StaffLoginResult = {
  token: string;
  expiresAt?: string;
  staffUser?: StaffUserSummary;
};

export type StaffUserSummary = {
  id: string;
  email: string;
  name?: string | null;
  status?: string;
  companyId?: string | null;
  branchId?: string | null;
};
