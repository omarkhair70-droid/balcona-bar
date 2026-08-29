"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getBranchEffectiveExperience,
  getBranchOnboarding
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";

function SectionHeading({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-[#DADAD5] pb-3">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#20201D]">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-[#74746E]">{description}</p>
    </div>
  );
}

function Stat({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-[#DEDED8] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#85857F]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#272723]">{value}</p>
    </div>
  );
}

export function OfficeFoundationPanels() {
  const t = useTranslations("staff");
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);

  const onboardingQuery = useQuery({
    queryKey: staffQueryKeys.branchOnboarding(selectedBranchId),
    queryFn: () =>
      getBranchOnboarding(selectedBranchId ?? "", accessToken ?? undefined),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 30_000
  });

  const experienceQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerExperience(selectedBranchId),
    queryFn: () => getBranchEffectiveExperience(selectedBranchId ?? ""),
    enabled: Boolean(selectedBranchId),
    staleTime: 30_000
  });

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: t("office.roleOwner"),
      branch_manager: t("office.roleBranchManager"),
      cashier: t("office.roleCashier"),
      waiter: t("office.roleWaiter"),
      kitchen: t("office.roleKitchen"),
      barista: t("office.roleBarista"),
      menu_admin: t("office.roleMenuAdmin")
    };

    return labels[role] ?? role;
  };

  const statusLabel = (status: string) =>
    status === "active"
      ? t("office.stateActive")
      : status === "inactive"
        ? t("office.stateInactive")
        : status;

  const onboarding = onboardingQuery.data;
  const experience = experienceQuery.data;

  return (
    <div className="grid gap-6">
      <section id="team" className="scroll-mt-24 grid gap-3">
        <SectionHeading
          title={t("office.teamTitle")}
          description={t("office.teamDescription")}
        />

        {onboardingQuery.isPending ? (
          <LoadingState label={t("office.loadingFoundation")} />
        ) : onboardingQuery.isError || !onboarding ? (
          <EmptyState
            title={t("office.teamTitle")}
            description={t("office.foundationError")}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {t("office.teamTotal", { count: onboarding.staff.total })}
              </Badge>
              {Object.entries(onboarding.staff.roleCounts).map(
                ([role, count]) => (
                  <Badge key={role} variant="muted">
                    {roleLabel(role)} {count ?? 0}
                  </Badge>
                )
              )}
            </div>

            {onboarding.staff.staff.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-[#DEDED8] bg-white">
                <div className="divide-y divide-[#ECECE8]">
                  {onboarding.staff.staff.map((assignment) => (
                    <div
                      key={assignment.membership.id}
                      className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#292925]">
                          {assignment.staffUser.name}
                        </p>
                        <p className="truncate text-xs text-[#7B7B75]">
                          {assignment.staffUser.email}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-[#5F5F59]">
                        {roleLabel(assignment.membership.role)}
                      </span>
                      <Badge
                        variant={
                          assignment.membership.status === "active"
                            ? "success"
                            : "muted"
                        }
                      >
                        {statusLabel(assignment.membership.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-[#D7D7D2] p-4 text-sm text-[#777771]">
                {t("office.teamEmpty")}
              </p>
            )}
          </>
        )}
      </section>

      <section id="experience" className="scroll-mt-24 grid gap-3">
        <SectionHeading
          title={t("office.experienceTitle")}
          description={t("office.experienceDescription")}
        />

        {experienceQuery.isPending ? (
          <LoadingState label={t("office.loadingFoundation")} />
        ) : experienceQuery.isError || !experience ? (
          <EmptyState
            title={t("office.experienceTitle")}
            description={t("office.foundationError")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Stat
              label={t("office.experienceSource")}
              value={
                experience.source === "branch"
                  ? t("office.sourceBranch")
                  : t("office.sourceCompany")
              }
            />
            <Stat
              label={t("office.experienceProfile")}
              value={
                experience.profile
                  ? t("office.configured")
                  : t("office.notConfigured")
              }
            />
            <Stat
              label={t("office.experienceContentBlocks")}
              value={experience.contentBlocks.length}
            />
            <Stat
              label={t("office.experienceVenueZones")}
              value={experience.venueZones.length}
            />
            <Stat
              label={t("office.experienceMedia")}
              value={experience.mediaUsages.length}
            />
            <Stat
              label={t("office.experienceTheme")}
              value={
                experience.designTokens &&
                Object.keys(experience.designTokens).length > 0
                  ? t("office.configured")
                  : t("office.notConfigured")
              }
            />
          </div>
        )}
      </section>

      <section id="settings" className="scroll-mt-24 grid gap-3">
        <SectionHeading
          title={t("office.settingsTitle")}
          description={t("office.settingsDescription")}
        />

        {onboardingQuery.isPending ? (
          <LoadingState label={t("office.loadingFoundation")} />
        ) : onboardingQuery.isError || !onboarding ? (
          <EmptyState
            title={t("office.settingsTitle")}
            description={t("office.foundationError")}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label={t("office.settingsCompany")}
                value={onboarding.company.name}
              />
              <Stat
                label={t("office.settingsBranch")}
                value={onboarding.branch.name}
              />
              <Stat
                label={t("office.settingsAddress")}
                value={
                  onboarding.branch.address || t("office.settingsNoValue")
                }
              />
              <Stat
                label={t("office.settingsStatus")}
                value={statusLabel(onboarding.branch.status)}
              />
              <Stat
                label={t("office.settingsPrinters")}
                value={`${onboarding.operations.activePrinterStationCount}/${onboarding.operations.printerStationCount}`}
              />
              <Stat
                label={t("office.settingsOpenShift")}
                value={
                  onboarding.operations.currentOpenShift
                    ? t("office.enabled")
                    : t("office.disabled")
                }
              />
            </div>

            <div className="rounded-md border border-[#DEDED8] bg-white p-3">
              <p className="text-xs font-semibold text-[#55554F]">
                {t("office.settingsFeatureFlags")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(onboarding.operations.featureFlags).length > 0 ? (
                  Object.entries(onboarding.operations.featureFlags).map(
                    ([flag, enabled]) => (
                      <Badge
                        key={flag}
                        variant={enabled ? "success" : "muted"}
                      >
                        {flag}:{" "}
                        {enabled
                          ? t("office.enabled")
                          : t("office.disabled")}
                      </Badge>
                    )
                  )
                ) : (
                  <span className="text-xs text-[#777771]">
                    {t("office.settingsNoValue")}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
