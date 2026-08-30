"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Building2,
  Flag,
  Plug,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
import {
  OfficeControlSection,
  OfficeFact,
  OfficeInlineNotice,
  OfficeStatusBadge,
  asRecord,
  formatOfficeDate,
  recordsFrom,
  textValue,
} from "@/features/staff/office-control-ui";
import {
  getOfficeAuditLogs,
  getOfficeFeatureFlags,
  getOfficeOperatingSettings,
  updateOfficeFeatureFlag,
  updateOfficeOperatingSettings,
} from "@/features/staff/office-control-data";
import { updateCompanyOnboardingProfile } from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  canAccessStaffRoute,
  hasCompanyStaffPermission,
} from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

const flagConsequences: Record<string, string> = {
  ai_waiter: "Controls branch AI waiter availability.",
  waiter_calls: "Controls guest-to-service waiter call flow.",
  smart_cashier: "Controls smart cashier automation surfaces.",
  realtime: "Controls realtime branch event delivery.",
  media_experience: "Controls media-backed guest experience.",
  bill_flow: "Controls branch bill request / bill flow.",
  table_attention: "Controls table attention workflow.",
  analytics: "Controls analytics collection/surfaces.",
  notifications: "Controls notification generation/delivery.",
  presence_triggers: "Controls presence-triggered experience behavior.",
};

function SettingsContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId,
  );
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const staffSession = useStaffAuthStore((state) => state.staffSession);

  const branchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId,
  );
  const company = branchAccess?.company;
  const branch = branchAccess?.branch;

  const canManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["settings.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canReadFlags = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["feature_flags.read"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canManageFlags = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["feature_flags.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canReadAudit = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["audit.read"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canManageBusiness = hasCompanyStaffPermission(
    effectiveAccess,
    "tenant_onboarding.manage",
    company?.id,
  );

  const operatingQuery = useQuery({
    queryKey: ["office-control", "settings", "operating", selectedBranchId],
    queryFn: () =>
      getOfficeOperatingSettings(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const flagsQuery = useQuery({
    queryKey: ["office-control", "settings", "flags", selectedBranchId],
    queryFn: () =>
      getOfficeFeatureFlags(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadFlags),
    retry: false,
  });

  const auditQuery = useQuery({
    queryKey: ["office-control", "settings", "audit", selectedBranchId],
    queryFn: () =>
      getOfficeAuditLogs(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadAudit),
    retry: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["office-control", "settings"],
    });

  const operatingMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateOfficeOperatingSettings(
        selectedBranchId ?? "",
        payload,
        accessToken ?? "",
      ),
    onSuccess: () => void invalidate(),
  });

  const flagMutation = useMutation({
    mutationFn: ({
      key,
      enabled,
    }: {
      key: string;
      enabled: boolean;
    }) =>
      updateOfficeFeatureFlag(
        selectedBranchId ?? "",
        key,
        enabled,
        accessToken ?? "",
      ),
    onSuccess: () => void invalidate(),
  });

  const businessMutation = useMutation({
    mutationFn: ({
      name,
      slug,
    }: {
      name: string;
      slug: string;
    }) =>
      updateCompanyOnboardingProfile(
        company?.id ?? "",
        { name, slug },
        accessToken,
      ),
    onSuccess: () => void invalidate(),
  });

  if (operatingQuery.isPending) {
    return <LoadingState label="Loading branch settings…" />;
  }

  if (operatingQuery.isError) {
    return (
      <EmptyState
        title="Settings could not be loaded"
        description={formatErrorMessage(operatingQuery.error)}
        action={
          <Button
            variant="secondary"
            onClick={() => void operatingQuery.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const settings = asRecord(operatingQuery.data?.settings);
  const flags = flagsQuery.data?.featureFlags ?? [];
  const auditLogs = recordsFrom(auditQuery.data, ["auditLogs"]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StaffBranchSelector
          access={effectiveAccess}
          selectedBranchId={selectedBranchId}
          onChange={setSelectedBranchId}
        />
        <OfficeInlineNotice title="Scope-aware settings">
          Company identity is company-scoped. Operating settings and feature
          flags are location-scoped. Mutations are permission checked again by
          the API and recorded by backend audit services where supported.
        </OfficeInlineNotice>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OfficeControlSection
          title="Business"
          description="Company identity. The current supported mutation is the existing company profile update service."
          action={<Building2 className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <OfficeFact label="Company" value={company?.name ?? "—"} />
            <OfficeFact label="Slug" value={company?.slug ?? "—"} />
          </div>
          {canManageBusiness && company ? (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const name = String(formData.get("name") ?? "").trim();
                const slug = String(formData.get("slug") ?? "").trim();

                if (name && slug) {
                  businessMutation.mutate({ name, slug });
                }
              }}
            >
              <label className="text-xs font-medium">
                Business name
                <Input
                  className="mt-1.5"
                  name="name"
                  defaultValue={company.name}
                  required
                />
              </label>
              <label className="text-xs font-medium">
                Business slug
                <Input
                  className="mt-1.5"
                  name="slug"
                  defaultValue={company.slug}
                  required
                />
              </label>
              <div className="sm:col-span-2">
                <Button
                  size="sm"
                  type="submit"
                  disabled={businessMutation.isPending}
                >
                  Save company identity
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-3">
              <OfficeInlineNotice title="Read-only company identity">
                tenant_onboarding.manage is required by the only existing
                company profile mutation. No second settings mutation is
                fabricated here.
              </OfficeInlineNotice>
            </div>
          )}
          {businessMutation.isError ? (
            <div className="mt-3">
              <OfficeInlineNotice title="Business update failed">
                {formatErrorMessage(businessMutation.error)}
              </OfficeInlineNotice>
            </div>
          ) : null}
        </OfficeControlSection>

        <OfficeControlSection
          title="Branch operating settings"
          description="Operating mode, service mode, and runtime capabilities are persisted in BranchOperatingSettings."
          action={<Settings2 className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              Operating mode
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={textValue(settings.operatingMode, "manual")}
                disabled={!canManage || operatingMutation.isPending}
                onChange={(event) => {
                  const operatingMode = event.target.value;
                  if (
                    window.confirm(
                      `Set operating mode to ${operatingMode}? This changes branch runtime behavior.`,
                    )
                  ) {
                    operatingMutation.mutate({ operatingMode });
                  }
                }}
              >
                <option value="manual">Manual</option>
                <option value="assisted">Assisted</option>
                <option value="autopilot">Autopilot</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Service mode
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={textValue(settings.serviceMode, "mixed")}
                disabled={!canManage || operatingMutation.isPending}
                onChange={(event) => {
                  const serviceMode = event.target.value;
                  if (
                    window.confirm(
                      `Set service mode to ${serviceMode.replaceAll("_", " ")}?`,
                    )
                  ) {
                    operatingMutation.mutate({ serviceMode });
                  }
                }}
              >
                <option value="dine_in">Dine in</option>
                <option value="takeaway">Takeaway</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <OfficeFact
              label="Scope"
              value={branch?.name ?? "Selected location"}
              hint="No implicit company-wide write."
            />
            <OfficeFact
              label="Last changed"
              value={formatOfficeDate(settings.updatedAt)}
              hint="Backend updatedAt on BranchOperatingSettings."
            />
          </div>
          {operatingMutation.isError ? (
            <div className="mt-3">
              <OfficeInlineNotice title="Operating update failed">
                {formatErrorMessage(operatingMutation.error)}
              </OfficeInlineNotice>
            </div>
          ) : null}
        </OfficeControlSection>
      </div>

      <OfficeControlSection
        title="Feature flags"
        description="Each key is a real branch feature flag. Unstored keys inherit the backend default (enabled) until explicitly written."
        action={<Flag className="size-4 text-[#777770]" aria-hidden="true" />}
      >
        {!canReadFlags ? (
          <OfficeInlineNotice title="Feature flag access required">
            feature_flags.read is not granted in this scope.
          </OfficeInlineNotice>
        ) : flagsQuery.isPending ? (
          <LoadingState label="Loading feature flags…" />
        ) : flagsQuery.isError ? (
          <EmptyState
            title="Feature flags could not be loaded"
            description={formatErrorMessage(flagsQuery.error)}
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {flags.map((flag) => {
              const key = textValue(flag.key, "");
              const enabled = flag.enabled === true;
              const inherited = flag.id === null || flag.id === undefined;

              return (
                <div
                  key={key}
                  className="rounded-md border border-[#E4E4DF] bg-[#FAFAF7] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {key.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#73736D]">
                        {flagConsequences[key] ?? "Branch runtime feature."}
                      </p>
                    </div>
                    <OfficeStatusBadge
                      value={enabled ? "enabled" : "disabled"}
                    />
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#888881]">
                    {inherited ? "Inherited backend default" : "Explicit branch value"}
                  </p>
                  {canManageFlags ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="secondary"
                      disabled={flagMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${enabled ? "Disable" : "Enable"} ${key.replaceAll("_", " ")} for this location?`,
                          )
                        ) {
                          flagMutation.mutate({ key, enabled: !enabled });
                        }
                      }}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {flagMutation.isError ? (
          <div className="mt-3">
            <OfficeInlineNotice title="Feature flag update failed">
              {formatErrorMessage(flagMutation.error)}
            </OfficeInlineNotice>
          </div>
        ) : null}
      </OfficeControlSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <OfficeControlSection
          title="Integrations"
          description="Integration status is deliberately conservative: staff settings do not expose provider credentials or a live-certification toggle."
          action={<Plug className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="space-y-2">
            <OfficeInlineNotice title="Online payments">
              Provider choice and credentials are server configuration. Money
              shows transaction-level environment evidence; this page does not
              label Paymob or Fawry live merely because adapters exist.
            </OfficeInlineNotice>
            <div className="grid gap-2 sm:grid-cols-2">
              <OfficeFact
                label="Realtime"
                value={
                  <OfficeStatusBadge
                    value={settings.realtimeEnabled === true ? "enabled" : "disabled"}
                  />
                }
              />
              <OfficeFact
                label="Notifications"
                value={
                  <OfficeStatusBadge
                    value={
                      settings.notificationsEnabled === true
                        ? "enabled"
                        : "disabled"
                    }
                  />
                }
              />
            </div>
          </div>
        </OfficeControlSection>

        <OfficeControlSection
          title="Security"
          description="Current session identity and server-side authorization scope. Full multi-device session administration is not exposed by the backend."
          action={<ShieldCheck className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <OfficeFact
              label="Session"
              value={staffSession?.id ? staffSession.id.slice(0, 12) : "—"}
            />
            <OfficeFact
              label="Status"
              value={<OfficeStatusBadge value={staffSession?.status} />}
            />
            <OfficeFact
              label="Expires"
              value={formatOfficeDate(staffSession?.expiresAt)}
            />
            <OfficeFact
              label="Effective permissions"
              value={effectiveAccess?.permissions.length ?? 0}
            />
          </div>
          <a
            className="mt-3 inline-flex text-xs font-semibold underline underline-offset-4"
            href="/office/team"
          >
            Open Team sessions & access
          </a>
        </OfficeControlSection>
      </div>

      <OfficeControlSection
        title="Advanced"
        description="Structured branch JSON configuration remains visible without inventing a free-form mutation that bypasses validated DTOs."
        action={<BookOpenCheck className="size-4 text-[#777770]" aria-hidden="true" />}
      >
        <div className="grid gap-3 xl:grid-cols-3">
          {[
            ["Opening hours", settings.openingHours],
            ["Service config", settings.serviceConfig],
            ["Attention config", settings.attentionConfig],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0">
              <p className="text-xs font-semibold">{String(label)}</p>
              <pre className="mt-2 max-h-52 overflow-auto rounded-md border border-[#E4E4DF] bg-[#F8F8F5] p-3 text-[10px] leading-4">
                {JSON.stringify(value ?? null, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </OfficeControlSection>

      <OfficeControlSection
        title="Audit trail"
        description="Recent branch audit records show consequences and last-change evidence where the backend records it."
      >
        {!canReadAudit ? (
          <OfficeInlineNotice title="Audit access required">
            audit.read is not granted in this location.
          </OfficeInlineNotice>
        ) : auditQuery.isPending ? (
          <LoadingState label="Loading audit trail…" />
        ) : auditQuery.isError ? (
          <EmptyState
            title="Audit trail could not be loaded"
            description={formatErrorMessage(auditQuery.error)}
          />
        ) : auditLogs.length === 0 ? (
          <EmptyState
            title="No audit records"
            description="No audit entry was returned for the selected branch."
          />
        ) : (
          <div className="space-y-2">
            {auditLogs.slice(0, 30).map((log) => (
              <div
                key={textValue(log.id)}
                className="grid gap-2 rounded-md border border-[#E4E4DF] p-3 md:grid-cols-[180px_1fr_auto]"
              >
                <p className="text-[11px] text-[#777770]">
                  {formatOfficeDate(log.createdAt)}
                </p>
                <div>
                  <p className="text-xs font-semibold">
                    {textValue(log.action).replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-[11px] text-[#777770]">
                    {textValue(log.targetType)} · {textValue(log.message, "No message")}
                  </p>
                </div>
                <p className="text-[11px] text-[#777770]">
                  {textValue(log.actorType)}
                </p>
              </div>
            ))}
          </div>
        )}
      </OfficeControlSection>
    </div>
  );
}

export function OfficeSettingsPage() {
  return (
    <OfficeStaffShell
      activeDomain="settings"
      title="Settings"
      description="Business identity, branch operating settings, service mode, feature flags, integrations, security, advanced configuration, and audit evidence."
    >
      <StaffAuthGate
        requiredPermissions={["settings.read"]}
        branchScoped
        deniedTitle="Settings access required"
        deniedDescription="This surface requires settings.read in the selected location."
      >
        <SettingsContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
