"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  ImageIcon,
  MapPinned,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  activateOfficeContentBlock,
  activateOfficeExperienceProfile,
  activateOfficeNotificationTemplate,
  applyOfficeBalkonaPack,
  archiveOfficeExperienceProfile,
  archiveOfficeMediaAsset,
  deactivateOfficeContentBlock,
  deactivateOfficeNotificationTemplate,
  getOfficeBranchContentBlocks,
  getOfficeBranchExperienceProfiles,
  getOfficeBranchNotificationTemplates,
  getOfficeCompanyExperienceProfiles,
  getOfficeMediaAssets,
  getOfficeNotifications,
  getOfficeOperatingSettings,
  getOfficePresenceEvents,
  getOfficeVenueZones,
  previewOfficeBalkonaPack,
  restoreOfficeMediaAsset,
  setDefaultOfficeExperienceProfile,
  updateOfficeOperatingSettings,
  type OfficeRecord,
} from "@/features/staff/office-control-data";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  canAccessStaffRoute,
  hasCompanyStaffPermission,
  hasStaffPermission,
} from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

function ExperienceContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);

  const branchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId,
  );
  const companyId = branchAccess?.company.id;

  const canExperienceManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["experience.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canContentManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["content.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canMediaManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["media.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });
  const canSettingsManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["settings.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });

  const canReadCompanyExperience = hasCompanyStaffPermission(
    effectiveAccess,
    "experience.read",
    companyId,
  );
  const canReadContent = hasStaffPermission(
    effectiveAccess,
    "content.read",
    selectedBranchId,
  );
  const canReadCompanyMedia = hasCompanyStaffPermission(
    effectiveAccess,
    "media.read",
    companyId,
  );
  const canReadZones = hasStaffPermission(
    effectiveAccess,
    "venue_zones.read",
    selectedBranchId,
  );
  const canReadPresence = hasStaffPermission(
    effectiveAccess,
    "presence.read",
    selectedBranchId,
  );
  const canReadNotifications = hasStaffPermission(
    effectiveAccess,
    "notifications.read",
    selectedBranchId,
  );
  const canReadSettings = hasStaffPermission(
    effectiveAccess,
    "settings.read",
    selectedBranchId,
  );

  const branchProfilesQuery = useQuery({
    queryKey: ["office-control", "experience", "profiles", "branch", selectedBranchId],
    queryFn: () =>
      getOfficeBranchExperienceProfiles(
        selectedBranchId ?? "",
        accessToken ?? "",
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });
  const companyProfilesQuery = useQuery({
    queryKey: ["office-control", "experience", "profiles", "company", companyId],
    queryFn: () =>
      getOfficeCompanyExperienceProfiles(companyId ?? "", accessToken ?? ""),
    enabled: Boolean(companyId && accessToken && canReadCompanyExperience),
    retry: false,
  });
  const contentQuery = useQuery({
    queryKey: ["office-control", "experience", "content", selectedBranchId],
    queryFn: () =>
      getOfficeBranchContentBlocks(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadContent),
    retry: false,
  });
  const templatesQuery = useQuery({
    queryKey: ["office-control", "experience", "templates", selectedBranchId],
    queryFn: () =>
      getOfficeBranchNotificationTemplates(
        selectedBranchId ?? "",
        accessToken ?? "",
      ),
    enabled: Boolean(selectedBranchId && accessToken && canReadContent),
    retry: false,
  });
  const mediaQuery = useQuery({
    queryKey: ["office-control", "experience", "media", companyId],
    queryFn: () => getOfficeMediaAssets(companyId ?? "", accessToken ?? ""),
    enabled: Boolean(companyId && accessToken && canReadCompanyMedia),
    retry: false,
  });
  const zonesQuery = useQuery({
    queryKey: ["office-control", "experience", "zones", selectedBranchId],
    queryFn: () =>
      getOfficeVenueZones(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadZones),
    retry: false,
  });
  const presenceQuery = useQuery({
    queryKey: ["office-control", "experience", "presence", selectedBranchId],
    queryFn: () =>
      getOfficePresenceEvents(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadPresence),
    retry: false,
  });
  const notificationsQuery = useQuery({
    queryKey: ["office-control", "experience", "notifications", selectedBranchId],
    queryFn: () =>
      getOfficeNotifications(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadNotifications),
    retry: false,
  });
  const operatingQuery = useQuery({
    queryKey: ["office-control", "experience", "operating", selectedBranchId],
    queryFn: () =>
      getOfficeOperatingSettings(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken && canReadSettings),
    retry: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["office-control", "experience"],
    });

  const profileMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "activate" | "archive" | "default";
    }) =>
      action === "activate"
        ? activateOfficeExperienceProfile(id, accessToken ?? "")
        : action === "archive"
          ? archiveOfficeExperienceProfile(id, accessToken ?? "")
          : setDefaultOfficeExperienceProfile(id, accessToken ?? ""),
    onSuccess: () => void invalidate(),
  });

  const contentMutation = useMutation({
    mutationFn: ({
      id,
      active,
    }: {
      id: string;
      active: boolean;
    }) =>
      active
        ? activateOfficeContentBlock(id, accessToken ?? "")
        : deactivateOfficeContentBlock(id, accessToken ?? ""),
    onSuccess: () => void invalidate(),
  });

  const templateMutation = useMutation({
    mutationFn: ({
      id,
      active,
    }: {
      id: string;
      active: boolean;
    }) =>
      active
        ? activateOfficeNotificationTemplate(id, accessToken ?? "")
        : deactivateOfficeNotificationTemplate(id, accessToken ?? ""),
    onSuccess: () => void invalidate(),
  });

  const mediaMutation = useMutation({
    mutationFn: ({
      id,
      restore,
    }: {
      id: string;
      restore: boolean;
    }) =>
      restore
        ? restoreOfficeMediaAsset(id, accessToken ?? "")
        : archiveOfficeMediaAsset(id, accessToken ?? ""),
    onSuccess: () => void invalidate(),
  });

  const packMutation = useMutation({
    mutationFn: () =>
      applyOfficeBalkonaPack(selectedBranchId ?? "", accessToken ?? ""),
    onSuccess: () => void invalidate(),
  });

  const aiWaiterMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateOfficeOperatingSettings(
        selectedBranchId ?? "",
        { aiWaiterEnabled: enabled },
        accessToken ?? "",
      ),
    onSuccess: () => void invalidate(),
  });

  const packPreviewQuery = useQuery({
    queryKey: ["office-control", "experience", "pack-preview", selectedBranchId],
    queryFn: () =>
      previewOfficeBalkonaPack(selectedBranchId ?? "", accessToken ?? ""),
    enabled: false,
    retry: false,
  });

  const pending =
    branchProfilesQuery.isLoading ||
    companyProfilesQuery.isLoading ||
    contentQuery.isLoading ||
    templatesQuery.isLoading ||
    mediaQuery.isLoading ||
    zonesQuery.isLoading ||
    presenceQuery.isLoading ||
    notificationsQuery.isLoading ||
    operatingQuery.isLoading;

  if (pending) {
    return <LoadingState label="Loading experience configuration…" />;
  }

  const firstError =
    branchProfilesQuery.error ??
    companyProfilesQuery.error ??
    contentQuery.error ??
    templatesQuery.error ??
    mediaQuery.error ??
    zonesQuery.error ??
    presenceQuery.error ??
    notificationsQuery.error ??
    operatingQuery.error;

  if (firstError) {
    return (
      <EmptyState
        title="Experience data could not be loaded"
        description={formatErrorMessage(firstError)}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void branchProfilesQuery.refetch();
              void companyProfilesQuery.refetch();
              void contentQuery.refetch();
              void templatesQuery.refetch();
              void mediaQuery.refetch();
              void zonesQuery.refetch();
              void presenceQuery.refetch();
              void notificationsQuery.refetch();
              void operatingQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const branchProfiles = recordsFrom(branchProfilesQuery.data, ["profiles"]);
  const companyProfiles = recordsFrom(companyProfilesQuery.data, ["profiles"]);
  const contentBlocks = recordsFrom(contentQuery.data, ["contentBlocks"]);
  const templates = recordsFrom(templatesQuery.data, ["notificationTemplates"]);
  const mediaAssets = recordsFrom(mediaQuery.data, ["mediaAssets"]);
  const zones = recordsFrom(zonesQuery.data, ["venueZones", "zones"]);
  const presence = recordsFrom(presenceQuery.data, ["events"]);
  const notifications = recordsFrom(notificationsQuery.data, ["notifications"]);
  const settings = asRecord(operatingQuery.data?.settings);
  const aiWaiterEnabled = settings.aiWaiterEnabled === true;
  const profiles = [
    ...branchProfiles.map((profile) => ({ ...profile, _scopeLabel: "Location" })),
    ...companyProfiles.map((profile) => ({ ...profile, _scopeLabel: "Company" })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StaffBranchSelector />
        <OfficeInlineNotice title="Experience scope">
          Location profiles override company defaults where the backend resolves
          them as effective. This surface keeps the two scopes explicit.
        </OfficeInlineNotice>
      </div>

      <OfficeControlSection
        title="Experience profiles"
        description="Theme, design tokens, motion, brand voice, layout, and AI waiter tone are stored on real ExperienceProfile records."
        action={<WandSparkles className="size-4 text-[#777770]" aria-hidden="true" />}
      >
        {profiles.length === 0 ? (
          <EmptyState
            title="No experience profiles"
            description="No company or location profile exists in this scope."
          />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {profiles.map((profile) => {
              const id = textValue(profile.id, "");
              const status = textValue(profile.status).toLowerCase();
              const isDefault = profile.isDefault === true;

              return (
                <div
                  key={`${textValue(profile._scopeLabel)}:${id}`}
                  className="rounded-md border border-[#E4E4DF] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {textValue(profile.name)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#74746E]">
                        {textValue(profile._scopeLabel)} ·{" "}
                        {textValue(profile.language, "default language")} · key{" "}
                        {textValue(profile.key)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isDefault ? <OfficeStatusBadge value="default" /> : null}
                      <OfficeStatusBadge value={profile.status} />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <OfficeFact
                      label="Brand voice"
                      value={
                        Object.keys(asRecord(profile.brandVoice)).length
                          ? "Configured"
                          : "Not configured"
                      }
                    />
                    <OfficeFact
                      label="AI waiter tone"
                      value={
                        Object.keys(asRecord(profile.aiWaiterTone)).length
                          ? "Configured"
                          : "Not configured"
                      }
                    />
                  </div>
                  {canExperienceManage && textValue(profile._scopeLabel) === "Location" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {status !== "active" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={profileMutation.isPending}
                          onClick={() =>
                            profileMutation.mutate({ id, action: "activate" })
                          }
                        >
                          Activate
                        </Button>
                      ) : null}
                      {!isDefault && status !== "archived" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={profileMutation.isPending}
                          onClick={() =>
                            profileMutation.mutate({ id, action: "default" })
                          }
                        >
                          Set default
                        </Button>
                      ) : null}
                      {status !== "archived" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={profileMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Archive this experience profile? Active delivery may fall back to another effective profile.",
                              )
                            ) {
                              profileMutation.mutate({ id, action: "archive" });
                            }
                          }}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {profileMutation.isError ? (
          <div className="mt-3">
            <OfficeInlineNotice title="Profile mutation failed">
              {formatErrorMessage(profileMutation.error)}
            </OfficeInlineNotice>
          </div>
        ) : null}
      </OfficeControlSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <OfficeControlSection
          title="Balkona experience pack"
          description="Preview is non-mutating. Apply uses the existing idempotent pack service to upsert profile, content, notifications, and zones."
          action={<Sparkles className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={packPreviewQuery.isFetching}
              onClick={() => void packPreviewQuery.refetch()}
            >
              Preview pack
            </Button>
            {canExperienceManage ? (
              <Button
                size="sm"
                disabled={packMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Apply the Balkona pack to this location? Existing pack-owned records may be updated.",
                    )
                  ) {
                    packMutation.mutate();
                  }
                }}
              >
                Apply pack
              </Button>
            ) : null}
          </div>
          {packPreviewQuery.data ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <OfficeFact
                label="Content blocks"
                value={recordsFrom(packPreviewQuery.data, ["contentBlocks"]).length}
              />
              <OfficeFact
                label="Notification templates"
                value={
                  recordsFrom(packPreviewQuery.data, ["notificationTemplates"]).length
                }
              />
              <OfficeFact
                label="Venue zones"
                value={recordsFrom(packPreviewQuery.data, ["venueZones"]).length}
              />
              <OfficeFact
                label="Mutates during preview"
                value={packPreviewQuery.data.mutates === true ? "Yes" : "No"}
              />
            </div>
          ) : null}
          {packPreviewQuery.isError || packMutation.isError ? (
            <div className="mt-3">
              <OfficeInlineNotice title="Pack operation failed">
                {formatErrorMessage(
                  packPreviewQuery.error ?? packMutation.error,
                )}
              </OfficeInlineNotice>
            </div>
          ) : null}
        </OfficeControlSection>

        <OfficeControlSection
          title="AI waiter configuration"
          description="The current supported configuration switch lives in branch operating settings; tone/personality remains part of the effective experience profile."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <OfficeFact
              label="Runtime switch"
              value={<OfficeStatusBadge value={aiWaiterEnabled ? "enabled" : "disabled"} />}
              hint="Branch-scoped."
            />
            <OfficeFact
              label="Operating mode"
              value={textValue(settings.operatingMode)}
              hint="AI runtime is still constrained by SaaS entitlements and server rules."
            />
          </div>
          {canSettingsManage ? (
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              disabled={aiWaiterMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `${aiWaiterEnabled ? "Disable" : "Enable"} AI waiter for this branch?`,
                  )
                ) {
                  aiWaiterMutation.mutate(!aiWaiterEnabled);
                }
              }}
            >
              {aiWaiterEnabled ? "Disable AI waiter" : "Enable AI waiter"}
            </Button>
          ) : (
            <div className="mt-3">
              <OfficeInlineNotice title="Read-only switch">
                settings.manage is required by the branch settings API.
              </OfficeInlineNotice>
            </div>
          )}
        </OfficeControlSection>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <OfficeControlSection
          title="Content blocks"
          description="Guest-facing content configuration attached to branch/company experience scope."
        >
          {contentBlocks.length === 0 ? (
            <EmptyState
              title="No content blocks"
              description="No content block is configured for this location."
            />
          ) : (
            <div className="space-y-2">
              {contentBlocks.slice(0, 30).map((block) => {
                const id = textValue(block.id, "");
                const active = textValue(block.status).toLowerCase() === "active";

                return (
                  <div
                    key={id}
                    className="grid gap-2 rounded-md border border-[#E4E4DF] p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {textValue(block.title, textValue(block.key))}
                      </p>
                      <p className="mt-1 text-[11px] text-[#73736D]">
                        {textValue(block.placement)} · {textValue(block.language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OfficeStatusBadge value={block.status} />
                      {canContentManage ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={contentMutation.isPending}
                          onClick={() =>
                            contentMutation.mutate({ id, active: !active })
                          }
                        >
                          {active ? "Deactivate" : "Activate"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </OfficeControlSection>

        <OfficeControlSection
          title="Notification templates"
          description="Template kind/channel/language and activation state are real content records; delivery history is separate below."
          action={<BellRing className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          {templates.length === 0 ? (
            <EmptyState
              title="No templates"
              description="No branch notification template is configured."
            />
          ) : (
            <div className="space-y-2">
              {templates.slice(0, 30).map((template) => {
                const id = textValue(template.id, "");
                const active = template.isActive === true;

                return (
                  <div
                    key={id}
                    className="grid gap-2 rounded-md border border-[#E4E4DF] p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {textValue(template.title)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#73736D]">
                        {textValue(template.kind)} · {textValue(template.channel)} ·{" "}
                        {textValue(template.language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OfficeStatusBadge value={active ? "active" : "disabled"} />
                      {canContentManage ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={templateMutation.isPending}
                          onClick={() =>
                            templateMutation.mutate({ id, active: !active })
                          }
                        >
                          {active ? "Deactivate" : "Activate"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </OfficeControlSection>
      </div>

      <OfficeControlSection
        title="Media assets"
        description="Company media library with explicit branch association, storage provider, archive/restore lifecycle, and no simulated uploads."
        action={<ImageIcon className="size-4 text-[#777770]" aria-hidden="true" />}
      >
        {mediaAssets.length === 0 ? (
          <EmptyState
            title="No media assets"
            description="The company media library returned no assets."
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {mediaAssets.slice(0, 36).map((asset) => {
              const id = textValue(asset.id, "");
              const status = textValue(asset.status).toLowerCase();
              const branchId = textValue(asset.branchId, "");

              return (
                <div
                  key={id}
                  className="rounded-md border border-[#E4E4DF] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {textValue(asset.title, textValue(asset.type))}
                      </p>
                      <p className="mt-1 text-[11px] text-[#73736D]">
                        {textValue(asset.provider)} ·{" "}
                        {branchId
                          ? branchId === selectedBranchId
                            ? "selected location"
                            : "another location"
                          : "company scope"}
                      </p>
                    </div>
                    <OfficeStatusBadge value={asset.status} />
                  </div>
                  <p className="mt-2 truncate text-[11px] text-[#85857E]">
                    {textValue(asset.publicUrl, textValue(asset.storageKey))}
                  </p>
                  {canMediaManage ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="secondary"
                      disabled={mediaMutation.isPending}
                      onClick={() => {
                        if (status === "archived") {
                          mediaMutation.mutate({ id, restore: true });
                        } else if (
                          window.confirm(
                            "Archive this media asset? Existing usage references remain visible to the backend lifecycle.",
                          )
                        ) {
                          mediaMutation.mutate({ id, restore: false });
                        }
                      }}
                    >
                      {status === "archived" ? "Restore" : "Archive"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </OfficeControlSection>

      <div className="grid gap-4 xl:grid-cols-3">
        <OfficeControlSection
          title="Zones"
          description="Venue zones support location-aware experience and presence behavior."
          action={<MapPinned className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="space-y-2">
            {zones.length === 0 ? (
              <p className="text-xs text-[#777770]">No zones configured.</p>
            ) : (
              zones.slice(0, 12).map((zone) => (
                <div key={textValue(zone.id)} className="rounded border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      {textValue(zone.name)}
                    </span>
                    <OfficeStatusBadge value={zone.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-[#777770]">
                    {textValue(zone.type)}
                  </p>
                </div>
              ))
            )}
          </div>
        </OfficeControlSection>

        <OfficeControlSection
          title="Presence triggers"
          description="Recent branch presence events; this is operational evidence, not a synthetic guest count."
        >
          <div className="space-y-2">
            {presence.length === 0 ? (
              <p className="text-xs text-[#777770]">No presence events returned.</p>
            ) : (
              presence.slice(0, 12).map((event) => (
                <div key={textValue(event.id)} className="rounded border p-2">
                  <p className="text-xs font-semibold">
                    {textValue(event.triggerType, textValue(event.type))}
                  </p>
                  <p className="mt-1 text-[11px] text-[#777770]">
                    {formatOfficeDate(event.occurredAt ?? event.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </OfficeControlSection>

        <OfficeControlSection
          title="Delivery activity"
          description="Recent branch notifications expose actual send/read/dismiss state."
        >
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-[#777770]">No notifications returned.</p>
            ) : (
              notifications.slice(0, 12).map((notification) => (
                <div key={textValue(notification.id)} className="rounded border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">
                      {textValue(notification.title)}
                    </p>
                    <OfficeStatusBadge value={notification.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-[#777770]">
                    {formatOfficeDate(notification.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </OfficeControlSection>
      </div>
    </div>
  );
}

export function OfficeExperiencePage() {
  return (
    <OfficeStaffShell
      activeDomain="experience"
      title="Experience"
      description="Profiles, packs, content, media, AI waiter configuration, notification templates, zones, and presence — exposed from the real experience backend."
    >
      <StaffAuthGate
        requiredPermissions={["experience.read"]}
        branchScoped
        deniedTitle="Experience access required"
        deniedDescription="This surface requires experience.read in the selected location."
      >
        <ExperienceContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
