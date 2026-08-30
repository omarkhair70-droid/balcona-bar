import { apiRequest } from "@/lib/api/client";

export type OfficeRecord = Record<string, unknown>;

export type OfficeStaffMembership = {
  id: string;
  role: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  company: {
    id: string;
    name: string;
    slug: string;
  };
  branch: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type OfficeStaffPerson = {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  memberships: OfficeStaffMembership[];
};

export type OfficeOperatingSettingsResult = {
  branch: OfficeRecord;
  settings: OfficeRecord;
};

export type OfficeFeatureFlagsResult = {
  branch: OfficeRecord;
  featureFlags: OfficeRecord[];
};

export function getOfficeStaff(token: string) {
  return apiRequest<OfficeStaffPerson[]>("/staff", { token });
}

export function getOfficeStaffAccess(staffUserId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/staff/${encodeURIComponent(staffUserId)}/access`,
    { token },
  );
}

export function getOfficeReconciliationRuns(
  branchId: string,
  token: string,
  limit = 50,
) {
  return apiRequest<OfficeRecord[]>(
    `/branches/${branchId}/online-payment-reconciliation/runs`,
    { token, query: { limit } },
  );
}

export function getOfficeReconciliationIssues(
  branchId: string,
  token: string,
  status?: string,
) {
  return apiRequest<OfficeRecord[]>(
    `/branches/${branchId}/online-payment-reconciliation/issues`,
    {
      token,
      query: {
        limit: 100,
        ...(status ? { status } : {}),
      },
    },
  );
}

export function acknowledgeOfficeReconciliationIssue(
  issueId: string,
  note: string,
  token: string,
) {
  return apiRequest<OfficeRecord, { note?: string }>(
    `/online-payment-reconciliation/issues/${issueId}/acknowledge`,
    {
      method: "POST",
      body: note.trim() ? { note: note.trim() } : {},
      token,
    },
  );
}

export function resolveOfficeReconciliationIssue(
  issueId: string,
  note: string,
  token: string,
) {
  return apiRequest<OfficeRecord, { note?: string }>(
    `/online-payment-reconciliation/issues/${issueId}/resolve`,
    {
      method: "POST",
      body: note.trim() ? { note: note.trim() } : {},
      token,
    },
  );
}

export function runOfficeProviderReconciliation(
  branchId: string,
  payload: {
    periodStart: string;
    periodEnd: string;
    currency: string;
    idempotencyKey: string;
  },
  token: string,
) {
  return apiRequest<OfficeRecord, typeof payload>(
    `/branches/${branchId}/online-payment-reconciliation/provider`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function importOfficeSettlement(
  branchId: string,
  payload: OfficeRecord,
  token: string,
) {
  return apiRequest<OfficeRecord, OfficeRecord>(
    `/branches/${branchId}/online-payment-settlements/import`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function refundOfficePayment(
  intentId: string,
  payload: { amountMinor: number; idempotencyKey: string; reason?: string },
  token: string,
) {
  return apiRequest<OfficeRecord, typeof payload>(
    `/online-payment-intents/${intentId}/refund`,
    { method: "POST", body: payload, token },
  );
}

export function voidOfficePayment(
  intentId: string,
  payload: { idempotencyKey: string; reason?: string },
  token: string,
) {
  return apiRequest<OfficeRecord, typeof payload>(
    `/online-payment-intents/${intentId}/void`,
    { method: "POST", body: payload, token },
  );
}

export function captureOfficePayment(
  intentId: string,
  payload: { amountMinor: number; idempotencyKey: string; reason?: string },
  token: string,
) {
  return apiRequest<OfficeRecord, typeof payload>(
    `/online-payment-intents/${intentId}/capture`,
    { method: "POST", body: payload, token },
  );
}

export function recoverOfficePayment(intentId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/online-payment-intents/${intentId}/recover`,
    { method: "POST", token },
  );
}

export function getOfficeBranchExperienceProfiles(
  branchId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/experience/profiles`,
    { token, query: { status: "all", limit: 100 } },
  );
}

export function getOfficeCompanyExperienceProfiles(
  companyId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/companies/${companyId}/experience/profiles`,
    { token, query: { status: "all", limit: 100 } },
  );
}

export function activateOfficeExperienceProfile(
  profileId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/experience/profiles/${profileId}/activate`,
    { method: "POST", token },
  );
}

export function archiveOfficeExperienceProfile(
  profileId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/experience/profiles/${profileId}/archive`,
    { method: "POST", token },
  );
}

export function setDefaultOfficeExperienceProfile(
  profileId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/experience/profiles/${profileId}/set-default`,
    { method: "POST", token },
  );
}

export function previewOfficeBalkonaPack(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/experience-packs/balkona/preview`,
    { token },
  );
}

export function applyOfficeBalkonaPack(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/experience-packs/balkona/apply`,
    { method: "POST", token },
  );
}

export function getOfficeBranchContentBlocks(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/content-blocks`,
    { token, query: { status: "all", limit: 100 } },
  );
}

export function activateOfficeContentBlock(blockId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/content-blocks/${blockId}/activate`,
    { method: "POST", token },
  );
}

export function deactivateOfficeContentBlock(blockId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/content-blocks/${blockId}/deactivate`,
    { method: "POST", token },
  );
}

export function getOfficeBranchNotificationTemplates(
  branchId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/notification-templates`,
    { token, query: { limit: 100 } },
  );
}

export function activateOfficeNotificationTemplate(
  templateId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/notification-templates/${templateId}/activate`,
    { method: "POST", token },
  );
}

export function deactivateOfficeNotificationTemplate(
  templateId: string,
  token: string,
) {
  return apiRequest<OfficeRecord>(
    `/notification-templates/${templateId}/deactivate`,
    { method: "POST", token },
  );
}

export function getOfficeMediaAssets(companyId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/companies/${companyId}/media-assets`,
    { token, query: { status: "all", limit: 100 } },
  );
}

export function archiveOfficeMediaAsset(assetId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/media-assets/${assetId}/archive`,
    { method: "POST", token },
  );
}

export function restoreOfficeMediaAsset(assetId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/media-assets/${assetId}/restore`,
    { method: "POST", token },
  );
}

export function getOfficeVenueZones(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/venue-zones`,
    { token, query: { status: "all", limit: 100 } },
  );
}

export function getOfficePresenceEvents(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/presence/events`,
    { token, query: { limit: 50 } },
  );
}

export function getOfficeNotifications(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/notifications`,
    { token, query: { limit: 50 } },
  );
}

export function getOfficeOperatingSettings(
  branchId: string,
  token: string,
) {
  return apiRequest<OfficeOperatingSettingsResult>(
    `/branches/${branchId}/operating-settings`,
    { token },
  );
}

export function updateOfficeOperatingSettings(
  branchId: string,
  payload: OfficeRecord,
  token: string,
) {
  return apiRequest<OfficeOperatingSettingsResult, OfficeRecord>(
    `/branches/${branchId}/operating-settings`,
    { method: "PUT", body: payload, token },
  );
}

export function getOfficeFeatureFlags(branchId: string, token: string) {
  return apiRequest<OfficeFeatureFlagsResult>(
    `/branches/${branchId}/feature-flags`,
    { token },
  );
}

export function updateOfficeFeatureFlag(
  branchId: string,
  key: string,
  enabled: boolean,
  token: string,
) {
  return apiRequest<OfficeRecord, { enabled: boolean }>(
    `/branches/${branchId}/feature-flags/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: { enabled },
      token,
    },
  );
}

export function getOfficeAuditLogs(branchId: string, token: string) {
  return apiRequest<OfficeRecord>(
    `/branches/${branchId}/audit-logs`,
    { token, query: { limit: 50 } },
  );
}
