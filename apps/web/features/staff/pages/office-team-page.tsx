"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  KeyRound,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
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
  getOfficeStaff,
  getOfficeStaffAccess,
  type OfficeStaffPerson,
} from "@/features/staff/office-control-data";
import {
  inviteOnboardingStaff,
  staffLogout,
} from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import type { InviteOnboardingStaffPayload } from "@/lib/api/types";
import { canAccessStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

const inviteRoles: Array<{
  value: InviteOnboardingStaffPayload["role"];
  label: string;
}> = [
  { value: "branch_manager", label: "Branch manager" },
  { value: "cashier", label: "Cashier" },
  { value: "waiter", label: "Waiter / server" },
  { value: "kitchen", label: "Kitchen" },
  { value: "barista", label: "Barista" },
  { value: "menu_admin", label: "Menu admin" },
];

function membershipsForBranch(person: OfficeStaffPerson, branchId?: string) {
  return person.memberships.filter(
    (membership) =>
      membership.branch?.id === branchId ||
      (membership.branch === null && membership.status === "active"),
  );
}

function TeamContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId,
  );
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const staffSession = useStaffAuthStore((state) => state.staffSession);
  const clearSession = useStaffAuthStore((state) => state.clearSession);
  const [selectedPersonId, setSelectedPersonId] = useState<string>();
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<InviteOnboardingStaffPayload["role"]>("cashier");
  const [copyNotice, setCopyNotice] = useState("");

  const canManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["staff.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });

  const peopleQuery = useQuery({
    queryKey: ["office-control", "team", "people"],
    queryFn: () => getOfficeStaff(accessToken ?? ""),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const selectedPerson = peopleQuery.data?.find(
    (person) => person.id === selectedPersonId,
  );

  const accessQuery = useQuery({
    queryKey: ["office-control", "team", "access", selectedPersonId],
    queryFn: () =>
      getOfficeStaffAccess(selectedPersonId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedPersonId && accessToken),
    retry: false,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteOnboardingStaff(
        selectedBranchId ?? "",
        {
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        },
        accessToken,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["office-control", "team"],
      });
      setInviteName("");
      setInviteEmail("");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => staffLogout(accessToken ?? ""),
    onSuccess: () => clearSession(),
  });

  const visiblePeople = useMemo(
    () =>
      (peopleQuery.data ?? []).filter(
        (person) =>
          !selectedBranchId ||
          membershipsForBranch(person, selectedBranchId).length > 0,
      ),
    [peopleQuery.data, selectedBranchId],
  );

  if (peopleQuery.isPending) {
    return <LoadingState label="Loading people and access scopes…" />;
  }

  if (peopleQuery.isError) {
    return (
      <EmptyState
        title="Team could not be loaded"
        description={formatErrorMessage(peopleQuery.error)}
        action={
          <Button variant="secondary" onClick={() => void peopleQuery.refetch()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const accessRecord = asRecord(accessQuery.data);
  const memberships = recordsFrom(accessRecord, ["memberships"]);
  const effective = asRecord(
    accessRecord.effectiveAccess ?? accessRecord.staffAccess,
  );
  const permissions = Array.isArray(effective.permissions)
    ? effective.permissions.filter(
        (permission): permission is string => typeof permission === "string",
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StaffBranchSelector
          access={effectiveAccess}
          selectedBranchId={selectedBranchId}
          onChange={setSelectedBranchId}
        />
        <span className="text-xs text-[#777770]">
          People are filtered by the selected location. Company-level membership
          remains visible because it inherits access to its allowed branches.
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
        <OfficeControlSection
          title="People"
          description="Real StaffUser and StaffMembership records visible through the current staff access scope."
          action={
            <span className="text-xs font-semibold text-[#66665F]">
              {visiblePeople.length} visible
            </span>
          }
        >
          {visiblePeople.length === 0 ? (
            <EmptyState
              title="No people in this scope"
              description="No staff membership is visible for the selected location."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-start text-xs">
                <thead className="text-[#777770]">
                  <tr className="border-b border-[#E4E4DF]">
                    <th className="px-2 py-2 text-start font-medium">Person</th>
                    <th className="px-2 py-2 text-start font-medium">Role</th>
                    <th className="px-2 py-2 text-start font-medium">Scope</th>
                    <th className="px-2 py-2 text-start font-medium">Status</th>
                    <th className="px-2 py-2 text-end font-medium">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePeople.map((person) => {
                    const scopedMemberships = membershipsForBranch(
                      person,
                      selectedBranchId,
                    );
                    const primary = scopedMemberships[0];

                    return (
                      <tr
                        key={person.id}
                        className="border-b border-[#EFEFEA] last:border-0"
                      >
                        <td className="px-2 py-3">
                          <p className="font-semibold text-[#2F2F2A]">
                            {person.name}
                          </p>
                          <p className="mt-0.5 text-[#7C7C75]">{person.email}</p>
                        </td>
                        <td className="px-2 py-3">
                          {scopedMemberships
                            .map((membership) =>
                              membership.role.replaceAll("_", " "),
                            )
                            .join(", ")}
                        </td>
                        <td className="px-2 py-3 text-[#66665F]">
                          {primary?.branch
                            ? primary.branch.name
                            : primary?.company.name ?? "Company"}
                        </td>
                        <td className="px-2 py-3">
                          <OfficeStatusBadge value={person.status} />
                        </td>
                        <td className="px-2 py-3 text-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedPersonId(person.id)}
                          >
                            <ShieldCheck className="size-3.5" aria-hidden="true" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </OfficeControlSection>

        <OfficeControlSection
          title="Roles & access"
          description="Effective access comes from memberships. Roles do not define Office navigation."
        >
          {!selectedPerson ? (
            <OfficeInlineNotice title="Select a person">
              Use Inspect to see their real memberships and effective permission
              surface.
            </OfficeInlineNotice>
          ) : accessQuery.isPending ? (
            <LoadingState label="Resolving effective access…" />
          ) : accessQuery.isError ? (
            <EmptyState
              title="Access could not be resolved"
              description={formatErrorMessage(accessQuery.error)}
            />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <OfficeFact label="Person" value={selectedPerson.name} />
                <OfficeFact
                  label="Effective permissions"
                  value={permissions.length}
                  hint="Union after company/branch scope resolution."
                />
              </div>
              <div className="space-y-2">
                {memberships.map((membership) => {
                  const branch = asRecord(membership.branch);
                  const company = asRecord(membership.company);

                  return (
                    <div
                      key={textValue(membership.id)}
                      className="rounded-md border border-[#E4E4DF] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {textValue(membership.role).replaceAll("_", " ")}
                        </p>
                        <OfficeStatusBadge value={membership.status} />
                      </div>
                      <p className="mt-1 text-xs text-[#73736D]">
                        {branch.id
                          ? `Location · ${textValue(branch.name)}`
                          : `Company · ${textValue(company.name)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
              <details className="rounded-md border border-[#E4E4DF] p-3">
                <summary className="cursor-pointer text-xs font-semibold">
                  Permission set ({permissions.length})
                </summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded border border-[#DFDFDA] bg-[#F8F8F5] px-2 py-1 text-[10px] text-[#66665F]"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </details>
              <OfficeInlineNotice title="Role editing state">
                Existing staff APIs expose effective roles and location access,
                while ongoing role reassignment is not implemented as a staff
                mutation. This screen does not simulate a successful role edit.
              </OfficeInlineNotice>
            </div>
          )}
        </OfficeControlSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OfficeControlSection
          title="Invites"
          description="Creates a real staff membership through the existing onboarding invite service. Balcona returns an invite link; this flow does not pretend an email was delivered."
          action={<UserPlus className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          {!canManage ? (
            <OfficeInlineNotice title="Read-only access">
              staff.manage is required for invitations in this location.
            </OfficeInlineNotice>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();

                if (
                  selectedBranchId &&
                  inviteName.trim() &&
                  inviteEmail.trim() &&
                  !inviteMutation.isPending
                ) {
                  inviteMutation.mutate();
                }
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium">
                  Name
                  <Input
                    className="mt-1.5"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    required
                  />
                </label>
                <label className="text-xs font-medium">
                  Email
                  <Input
                    className="mt-1.5"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="block text-xs font-medium">
                Role
                <select
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value as InviteOnboardingStaffPayload["role"],
                    )
                  }
                >
                  {inviteRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              {inviteMutation.isError ? (
                <div role="alert">
                  <OfficeInlineNotice title="Invite failed">
                    {formatErrorMessage(inviteMutation.error)}
                  </OfficeInlineNotice>
                </div>
              ) : null}
              {inviteMutation.data ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-md border border-[#D9E3D7] bg-[#F7FAF6] p-3"
                >
                  <p className="text-xs font-semibold">Invite created</p>
                  <p className="mt-1 break-all text-xs text-[#62625C]">
                    {inviteMutation.data.invitePath}
                  </p>
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const full =
                        typeof window === "undefined"
                          ? inviteMutation.data?.invitePath
                          : `${window.location.origin}${inviteMutation.data?.invitePath}`;
                      if (full) {
                        setCopyNotice("");
                        void navigator.clipboard.writeText(full).then(
                          () => setCopyNotice("Invite link copied."),
                          () =>
                            setCopyNotice(
                              "Copy failed. Select the invite link above and copy it manually.",
                            ),
                        );
                      }
                    }}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    Copy invite link
                  </Button>
                  {copyNotice ? (
                    <p className="mt-2 text-xs text-[#62625C]">{copyNotice}</p>
                  ) : null}
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={
                  !selectedBranchId ||
                  !inviteName.trim() ||
                  !inviteEmail.trim() ||
                  inviteMutation.isPending
                }
                aria-busy={inviteMutation.isPending}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                {inviteMutation.isPending ? "Creating…" : "Create invite"}
              </Button>
            </form>
          )}
        </OfficeControlSection>

        <OfficeControlSection
          title="Sessions & security"
          description="The current backend supports session creation, expiry, and revoking the current token. It does not expose an all-device session manager."
          action={<KeyRound className="size-4 text-[#777770]" aria-hidden="true" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <OfficeFact label="Signed in as" value={staffUser?.email ?? "—"} />
            <OfficeFact
              label="Session status"
              value={<OfficeStatusBadge value={staffSession?.status} />}
            />
            <OfficeFact
              label="Location scope"
              value={
                effectiveAccess?.branches.find(
                  (entry) => entry.branch.id === selectedBranchId,
                )?.branch.name ?? "Company / no branch"
              }
              hint="Session access is revalidated server-side."
            />
            <OfficeFact
              label="Expires"
              value={formatOfficeDate(staffSession?.expiresAt)}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              disabled={logoutMutation.isPending}
              aria-busy={logoutMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Sign out this staff session? This revokes the current token.",
                  )
                ) {
                  logoutMutation.mutate();
                }
              }}
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {logoutMutation.isPending
                ? "Revoking session…"
                : "Revoke current session"}
            </Button>
            <span className="inline-flex items-center gap-1 text-xs text-[#777770]">
              <MapPin className="size-3.5" aria-hidden="true" />
              Location access is membership-scoped, not role-navigation scoped.
            </span>
          </div>
          {logoutMutation.isError ? (
            <div className="mt-3">
              <OfficeInlineNotice title="Sign-out failed">
                {formatErrorMessage(logoutMutation.error)}
              </OfficeInlineNotice>
            </div>
          ) : null}
        </OfficeControlSection>
      </div>
    </div>
  );
}

export function OfficeTeamPage() {
  return (
    <OfficeStaffShell
      activeDomain="team"
      title="Team"
      description="People, roles, invitations, location access, and supported session security — derived from real staff memberships and permissions."
      actions={
        <div className="flex items-center gap-2 text-xs font-medium text-[#6F6F68]">
          <Users className="size-4" aria-hidden="true" />
          Access-controlled
        </div>
      }
    >
      <StaffAuthGate
        requiredPermissions={["staff.read"]}
        branchScoped
        deniedTitle="Team access required"
        deniedDescription="This surface requires staff.read in the selected scope."
      >
        <TeamContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
