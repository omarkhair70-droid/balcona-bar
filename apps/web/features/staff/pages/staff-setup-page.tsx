"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpenText,
  Building2,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  LinkIcon,
  Loader2,
  MapPinned,
  QrCode,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Table2,
  UsersRound
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { SetupReadinessFrame } from "@/features/staff/setup-readiness-frame";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  bulkCreateOnboardingTables,
  createOnboardingFloor,
  getBranchLaunchChecklist,
  getBranchOnboarding,
  getCompanyOnboarding,
  inviteOnboardingStaff,
  updateBranchOnboardingProfile,
  updateCompanyOnboardingProfile,
  updateOnboardingReadinessCheck
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  BulkCreateOnboardingTablesPayload,
  CreateOnboardingFloorPayload,
  InviteOnboardingStaffResult,
  InviteOnboardingStaffPayload,
  TenantOnboardingBranch,
  TenantOnboardingBranchStatus,
  TenantOnboardingChecklistItem,
  TenantOnboardingCompany,
  TenantOnboardingCompanyStatus,
  TenantOnboardingReadinessStatus,
  TenantOnboardingSection,
  TenantOnboardingStaffRole,
  UpdateBranchOnboardingProfilePayload,
  UpdateCompanyOnboardingProfilePayload
} from "@/lib/api/types";
import {
  hasCompanyStaffPermission,
  hasStaffPermission
} from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { cn } from "@/lib/utils/cn";
import {
  getLaunchStatusLabel,
  getReadinessBadgeVariant,
  getStaffRoleLabel
} from "../setup-data";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

type CompanyFormState = {
  name: string;
  slug: string;
  status: TenantOnboardingCompanyStatus;
};

type BranchFormState = {
  name: string;
  slug: string;
  address: string;
  status: TenantOnboardingBranchStatus;
};

type FloorFormState = {
  name: string;
  sortOrder: string;
};

type TableBulkFormState = {
  floorLabel: string;
  tablePrefix: string;
  startNumber: string;
  count: string;
  seats: string;
};

type CompanyDraftState = {
  companyId?: string;
  values: Partial<CompanyFormState>;
};

type BranchDraftState = {
  branchId?: string;
  values: Partial<BranchFormState>;
};

type StaffInviteResultState = {
  inviteUrl: string;
  email: string;
  name: string;
  role: TenantOnboardingStaffRole | string;
  branchName: string;
  expiresAt?: string | null;
};

const emptyCompanyForm: CompanyFormState = {
  name: "",
  slug: "",
  status: "active"
};

const emptyBranchForm: BranchFormState = {
  name: "",
  slug: "",
  address: "",
  status: "active"
};

const emptyFloorForm: FloorFormState = {
  name: "",
  sortOrder: "0"
};

const defaultTableForm: TableBulkFormState = {
  floorLabel: "Main Floor",
  tablePrefix: "T",
  startNumber: "1",
  count: "8",
  seats: "2"
};

const allStaffRoles: TenantOnboardingStaffRole[] = [
  "owner",
  "branch_manager",
  "cashier",
  "waiter",
  "kitchen",
  "barista",
  "menu_admin"
];

const branchStaffRoles: TenantOnboardingStaffRole[] = allStaffRoles.filter(
  (role) => role !== "owner"
);

function normalizeCompanyStatus(
  value?: string
): TenantOnboardingCompanyStatus {
  return value === "inactive" ? "inactive" : "active";
}

function normalizeBranchStatus(value?: string): TenantOnboardingBranchStatus {
  return value === "inactive" ? "inactive" : "active";
}

function toPositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildAppUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function buildInviteUrl(invitePath: string) {
  return buildAppUrl(invitePath);
}

function formatInviteExpiry(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getCompanyForm(company?: TenantOnboardingCompany): CompanyFormState {
  if (!company) {
    return emptyCompanyForm;
  }

  return {
    name: company.name,
    slug: company.slug,
    status: normalizeCompanyStatus(company.status)
  };
}

function getBranchForm(branch?: TenantOnboardingBranch): BranchFormState {
  if (!branch) {
    return emptyBranchForm;
  }

  return {
    name: branch.name,
    slug: branch.slug,
    address: branch.address ?? "",
    status: normalizeBranchStatus(branch.status)
  };
}

function SetupField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function StatusIcon({ status }: { status: TenantOnboardingReadinessStatus }) {
  if (status === "ready") {
    return <CheckCircle2 className="size-4 text-success" aria-hidden="true" />;
  }

  if (status === "blocked") {
    return <AlertTriangle className="size-4 text-danger" aria-hidden="true" />;
  }

  return <CircleDashed className="size-4 text-warning" aria-hidden="true" />;
}

function SectionProgressCard({ section }: { section: TenantOnboardingSection }) {
  return (
    <Card variant="quiet">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{section.label}</CardTitle>
            <CardDescription>
              {section.readyCount} of {section.totalCount} checks ready
            </CardDescription>
          </div>
          <Badge variant={getReadinessBadgeVariant(section.status)}>
            {section.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              section.status === "ready" ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${section.percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistPanel({
  items,
  onAcknowledge,
  pendingKey,
  canManage
}: {
  items: TenantOnboardingChecklistItem[];
  onAcknowledge: (item: TenantOnboardingChecklistItem) => void;
  pendingKey?: string;
  canManage: boolean;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="grid gap-3 rounded-button border bg-surface/70 p-4 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="flex gap-3">
            <StatusIcon status={item.status} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{item.label}</p>
                <Badge variant={getReadinessBadgeVariant(item.status)}>
                  {item.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {item.reason}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {item.actionHref ? (
              <Link
                href={item.actionHref}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Open
              </Link>
            ) : null}
            {item.status !== "ready" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={!canManage || pendingKey === item.key}
                onClick={() => onAcknowledge(item)}
              >
                {pendingKey === item.key ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                )}
                Acknowledge
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function StaffSetupContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const selectedAccessBranch = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedCompanyId =
    selectedAccessBranch?.company.id ??
    effectiveAccess?.branches[0]?.company.id ??
    effectiveAccess?.companies[0]?.company.id;
  const [companyDraft, setCompanyDraft] = useState<CompanyDraftState>({
    values: {}
  });
  const [branchDraft, setBranchDraft] = useState<BranchDraftState>({
    values: {}
  });
  const [floorForm, setFloorForm] = useState<FloorFormState>(emptyFloorForm);
  const [tableForm, setTableForm] =
    useState<TableBulkFormState>(defaultTableForm);
  const [staffForm, setStaffForm] = useState<InviteOnboardingStaffPayload>({
    email: "",
    name: "",
    role: "cashier"
  });
  const [lastStaffInvite, setLastStaffInvite] =
    useState<StaffInviteResultState | null>(null);
  const [staffInviteCopied, setStaffInviteCopied] = useState(false);
  const [copiedQrTableId, setCopiedQrTableId] = useState<string | null>(null);
  const [acknowledgementMessage, setAcknowledgementMessage] = useState<
    string | null
  >(null);
  const canReadCompanyOnboarding = hasCompanyStaffPermission(
    effectiveAccess,
    "tenant_onboarding.read",
    selectedCompanyId
  );
  const canManageCompanyOnboarding = hasCompanyStaffPermission(
    effectiveAccess,
    "tenant_onboarding.manage",
    selectedCompanyId
  );
  const canManageBranchOnboarding = hasStaffPermission(
    effectiveAccess,
    "tenant_onboarding.manage",
    selectedBranchId
  );
  const canInviteBranchStaff = hasStaffPermission(
    effectiveAccess,
    "staff.manage",
    selectedBranchId
  );
  const canInviteOwner = hasCompanyStaffPermission(
    effectiveAccess,
    "staff.manage",
    selectedCompanyId
  );
  const visibleStaffRoles = canInviteOwner ? allStaffRoles : branchStaffRoles;
  const branchQuery = useQuery({
    queryKey: staffQueryKeys.branchOnboarding(selectedBranchId),
    queryFn: () => getBranchOnboarding(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const companyQuery = useQuery({
    queryKey: staffQueryKeys.companyOnboarding(selectedCompanyId),
    queryFn: () => getCompanyOnboarding(selectedCompanyId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedCompanyId && canReadCompanyOnboarding),
    staleTime: 60_000
  });
  const launchChecklistQuery = useQuery({
    queryKey: staffQueryKeys.branchLaunchChecklist(selectedBranchId),
    queryFn: () => getBranchLaunchChecklist(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const onboarding = branchQuery.data;
  const displayCompany = companyQuery.data?.company ?? onboarding?.company;
  const companyBaseForm = useMemo(
    () => getCompanyForm(displayCompany),
    [displayCompany]
  );
  const branchBaseForm = useMemo(
    () => getBranchForm(onboarding?.branch),
    [onboarding?.branch]
  );
  const activeCompanyDraft =
    companyDraft.companyId === displayCompany?.id ? companyDraft.values : {};
  const activeBranchDraft =
    branchDraft.branchId === onboarding?.branch.id ? branchDraft.values : {};
  const companyForm = {
    ...companyBaseForm,
    ...activeCompanyDraft
  };
  const branchForm = {
    ...branchBaseForm,
    ...activeBranchDraft
  };
  const staffRoleValue = visibleStaffRoles.includes(staffForm.role)
    ? staffForm.role
    : visibleStaffRoles[0] ?? "cashier";
  const selectedStaffRoleLabel = getStaffRoleLabel(staffRoleValue);

  const checklistItems =
    launchChecklistQuery.data?.launchChecklist ?? onboarding?.launchChecklist ?? [];
  const criticalBlockedItems =
    launchChecklistQuery.data?.launchSummary.blockedReasons ??
    onboarding?.launchSummary.blockedReasons ??
    [];
  const launchSummary =
    launchChecklistQuery.data?.launchSummary ?? onboarding?.launchSummary;
  const tableCompletion = onboarding
    ? `${onboarding.tables.qrReadyTableCount}/${onboarding.tables.activeTableCount}`
    : "0/0";
  const saasStatus = onboarding?.saas;
  const saasNotices = [
    ...(saasStatus?.blockers ?? []),
    ...(saasStatus?.warnings ?? [])
  ];

  function toStaffInviteResultState(
    result: InviteOnboardingStaffResult
  ): StaffInviteResultState {
    return {
      inviteUrl: buildInviteUrl(result.invitePath),
      email: result.invite.email,
      name: result.invite.name ?? result.staffUser.name,
      role: result.invite.role,
      branchName:
        result.invite.branch?.name ?? onboarding?.branch.name ?? "Selected branch",
      expiresAt: result.invite.expiresAt ?? null
    };
  }

  function refreshOnboarding() {
    if (selectedBranchId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOnboarding(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchLaunchChecklist(selectedBranchId)
      });
    }

    if (selectedCompanyId && canReadCompanyOnboarding) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.companyOnboarding(selectedCompanyId)
      });
    }

    void queryClient.invalidateQueries({ queryKey: staffQueryKeys.me() });
  }

  function requireBranchScope() {
    if (!selectedBranchId || !accessToken) {
      throw new Error("Select a branch before updating setup.");
    }

    return { branchId: selectedBranchId, token: accessToken };
  }

  function requireCompanyScope() {
    if (!selectedCompanyId || !accessToken) {
      throw new Error("Company setup context is not ready.");
    }

    return { companyId: selectedCompanyId, token: accessToken };
  }

  function updateCompanyDraft(patch: Partial<CompanyFormState>) {
    setCompanyDraft((current) => ({
      companyId: displayCompany?.id,
      values: {
        ...(current.companyId === displayCompany?.id ? current.values : {}),
        ...patch
      }
    }));
  }

  function updateBranchDraft(patch: Partial<BranchFormState>) {
    setBranchDraft((current) => ({
      branchId: onboarding?.branch.id,
      values: {
        ...(current.branchId === onboarding?.branch.id ? current.values : {}),
        ...patch
      }
    }));
  }

  const updateCompanyMutation = useMutation({
    mutationFn: (payload: UpdateCompanyOnboardingProfilePayload) => {
      const { companyId, token } = requireCompanyScope();

      return updateCompanyOnboardingProfile(companyId, payload, token);
    },
    onSuccess: (result) => {
      setCompanyDraft({
        companyId: result.company.id,
        values: getCompanyForm(result.company)
      });
      refreshOnboarding();
    }
  });
  const updateBranchMutation = useMutation({
    mutationFn: (payload: UpdateBranchOnboardingProfilePayload) => {
      const { branchId, token } = requireBranchScope();

      return updateBranchOnboardingProfile(branchId, payload, token);
    },
    onSuccess: (result) => {
      setBranchDraft({
        branchId: result.branch.id,
        values: getBranchForm(result.branch)
      });
      refreshOnboarding();
    }
  });
  const createFloorMutation = useMutation({
    mutationFn: (payload: CreateOnboardingFloorPayload) => {
      const { branchId, token } = requireBranchScope();

      return createOnboardingFloor(branchId, payload, token);
    },
    onSuccess: () => {
      setFloorForm(emptyFloorForm);
      refreshOnboarding();
    }
  });
  const bulkCreateTablesMutation = useMutation({
    mutationFn: (payload: BulkCreateOnboardingTablesPayload) => {
      const { branchId, token } = requireBranchScope();

      return bulkCreateOnboardingTables(branchId, payload, token);
    },
    onSuccess: refreshOnboarding
  });
  const inviteStaffMutation = useMutation({
    mutationFn: (payload: InviteOnboardingStaffPayload) => {
      const { branchId, token } = requireBranchScope();

      return inviteOnboardingStaff(branchId, payload, token);
    },
    onSuccess: (result) => {
      setLastStaffInvite(toStaffInviteResultState(result));
      setStaffInviteCopied(false);
      setStaffForm({ email: "", name: "", role: "cashier" });
      refreshOnboarding();
    }
  });
  const readinessMutation = useMutation({
    mutationFn: (item: TenantOnboardingChecklistItem) => {
      const { branchId, token } = requireBranchScope();

      return updateOnboardingReadinessCheck(
        branchId,
        {
          key: item.key,
          status: item.status === "blocked" ? "blocked" : "pending",
          note: item.reason
        },
        token
      );
    },
    onSuccess: (result) => {
      setAcknowledgementMessage(result.message);
      refreshOnboarding();
    }
  });
  const mutationError =
    updateCompanyMutation.error ??
    updateBranchMutation.error ??
    createFloorMutation.error ??
    bulkCreateTablesMutation.error ??
    readinessMutation.error;

  function handleCompanySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    updateCompanyMutation.mutate({
      name: companyForm.name,
      slug: companyForm.slug,
      status: companyForm.status
    });
  }

  function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    updateBranchMutation.mutate({
      name: branchForm.name,
      slug: branchForm.slug,
      address: branchForm.address || null,
      status: branchForm.status
    });
  }

  function handleFloorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    createFloorMutation.mutate({
      name: floorForm.name,
      sortOrder: toNonNegativeInteger(floorForm.sortOrder, 0)
    });
  }

  function handleTablesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    bulkCreateTablesMutation.mutate({
      floorLabel: tableForm.floorLabel,
      tablePrefix: tableForm.tablePrefix,
      startNumber: toPositiveInteger(tableForm.startNumber, 1),
      count: toPositiveInteger(tableForm.count, 1),
      seats: toPositiveInteger(tableForm.seats, 2)
    });
  }

  function handleStaffSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    inviteStaffMutation.mutate({
      ...staffForm,
      role: staffRoleValue
    });
  }

  async function copyStaffInviteUrl() {
    if (!lastStaffInvite) {
      return;
    }

    await navigator.clipboard.writeText(lastStaffInvite.inviteUrl);
    setStaffInviteCopied(true);
  }

  async function copyQrPreviewUrl(tableId: string, customerPreviewPath: string) {
    await navigator.clipboard.writeText(buildAppUrl(customerPreviewPath));
    setCopiedQrTableId(tableId);
  }

  const roleCounts = useMemo(() => onboarding?.staff.roleCounts ?? {}, [onboarding]);

  if (effectiveAccess?.branches.length === 0) {
    return (
      <EmptyState
        title="No branch access"
        description="Tenant setup is branch-scoped. Add branch access to this staff account before opening setup."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <Card variant="accent">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <Badge variant="muted" className="mb-3">
              Tenant setup
            </Badge>
            <CardTitle>
              {displayCompany?.name ?? "Company"} launch foundation
            </CardTitle>
            <CardDescription>
              Set up the company, branch, tables, QR readiness, staff roles,
              menu readiness, and operational launch checks without changing the
              demo seed or customer flows.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StaffBranchSelector
              access={effectiveAccess}
              selectedBranchId={selectedBranchId}
              onChange={setSelectedBranchId}
              className="min-w-64"
            />
            <Button
              variant="secondary"
              onClick={refreshOnboarding}
              disabled={branchQuery.isFetching || companyQuery.isFetching}
            >
              <RefreshCw
                className={cn(
                  "size-4",
                  branchQuery.isFetching || companyQuery.isFetching
                    ? "animate-spin"
                    : ""
                )}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {branchQuery.isPending ? (
        <LoadingState label="Loading tenant setup" />
      ) : null}

      {branchQuery.isError ? (
        <EmptyState
          title="Tenant setup could not load"
          description={formatErrorMessage(branchQuery.error)}
        />
      ) : null}

      {mutationError ? (
        <div className="rounded-button border border-danger/40 bg-danger/10 p-4 text-sm text-foreground">
          {formatErrorMessage(mutationError)}
        </div>
      ) : null}

      {acknowledgementMessage ? (
        <div className="rounded-button border border-primary/35 bg-primary/10 p-4 text-sm text-muted-foreground">
          {acknowledgementMessage}
        </div>
      ) : null}

      {onboarding ? (
        <SetupReadinessFrame onboarding={onboarding} launchSummary={launchSummary}>
          {saasStatus ? (
            <Card
              variant={saasStatus.blockers.length > 0 ? "quiet" : "accent"}
            >
              <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
                <div>
                  <Badge
                    variant={
                      saasStatus.blockers.length > 0
                        ? "danger"
                        : saasStatus.warnings.length > 0
                          ? "warning"
                          : "success"
                    }
                    className="mb-3"
                  >
                    Plan signals
                  </Badge>
                  <CardTitle>
                    {saasStatus.plan?.name ?? "Plan not configured"}
                  </CardTitle>
                  <CardDescription>
                    Setup writes and tenant limits are checked by the backend
                    SaaS status service.
                  </CardDescription>
                </div>
                <Link
                  href="/staff/billing"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <CreditCard className="size-4" aria-hidden="true" />
                  Billing
                </Link>
              </CardHeader>
              <CardContent className="grid gap-3">
                {saasNotices.length === 0 ? (
                  <div className="rounded-button border border-success/40 bg-success/10 p-4 text-sm text-muted-foreground">
                    Subscription status, feature entitlements, and current
                    usage are ready for this setup flow.
                  </div>
                ) : null}
                {saasNotices.map((notice) => (
                  <div
                    key={`${notice.code}-${notice.metricKey ?? "subscription"}`}
                    className="rounded-button border bg-surface/70 p-4"
                  >
                    <p className="font-semibold text-foreground">
                      {notice.message}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Launch"
              value={
                launchSummary
                  ? getLaunchStatusLabel(launchSummary.status)
                  : "Checking"
              }
              description={
                launchSummary
                  ? `${launchSummary.totalCriticalCount - launchSummary.missingCriticalCount}/${launchSummary.totalCriticalCount} critical checks ready`
                  : "Computed from backend setup records"
              }
              icon={<Rocket className="size-4" aria-hidden="true" />}
              tone={launchSummary?.readyForPilot ? "success" : "warning"}
            />
            <MetricCard
              label="Tables and QR"
              value={tableCompletion}
              description={`${onboarding.tables.activeTableCount} active tables, ${onboarding.tables.missingQrTableCount} missing QR tokens`}
              icon={<QrCode className="size-4" aria-hidden="true" />}
              tone={
                onboarding.tables.missingQrTableCount === 0 ? "success" : "primary"
              }
            />
            <MetricCard
              label="Staff"
              value={String(onboarding.staff.total)}
              description="Active branch and company assignments for this branch"
              icon={<UsersRound className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Menu"
              value={String(onboarding.menu.availableItemCount)}
              description={`${onboarding.menu.activeItemCount} active items, ${onboarding.menu.activeModifierGroupCount} modifier groups`}
              icon={<BookOpenText className="size-4" aria-hidden="true" />}
              tone={
                onboarding.menu.aiWaiterMenuGroundingReady
                  ? "success"
                  : "warning"
              }
            />
          </section>

          <section id="setup-foundation" className="scroll-mt-6 grid gap-4 xl:grid-cols-2">
            <Card variant="quiet">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="muted" className="mb-3">
                      Company
                    </Badge>
                    <CardTitle>{displayCompany?.name ?? "Company profile"}</CardTitle>
                    <CardDescription>
                      Company-level identity remains owner controlled. Branch
                      managers can still complete branch launch setup below.
                    </CardDescription>
                  </div>
                  <Building2 className="size-5 text-primary" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleCompanySubmit}>
                  <SetupField label="Name">
                    <Input
                      value={companyForm.name}
                      disabled={!canManageCompanyOnboarding}
                      onChange={(event) =>
                        updateCompanyDraft({ name: event.target.value })
                      }
                    />
                  </SetupField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SetupField label="Slug">
                      <Input
                        value={companyForm.slug}
                        disabled={!canManageCompanyOnboarding}
                        onChange={(event) =>
                          updateCompanyDraft({ slug: event.target.value })
                        }
                      />
                    </SetupField>
                    <SetupField label="Status">
                      <select
                        value={companyForm.status}
                        disabled={!canManageCompanyOnboarding}
                        onChange={(event) =>
                          updateCompanyDraft({
                            status: normalizeCompanyStatus(event.target.value)
                          })
                        }
                        className="min-h-11 rounded-button border bg-surface px-3 text-sm font-medium normal-case text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </SetupField>
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !canManageCompanyOnboarding ||
                      updateCompanyMutation.isPending
                    }
                  >
                    {updateCompanyMutation.isPending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save company
                  </Button>
                </form>
                {!canManageCompanyOnboarding ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Company profile changes require owner-level tenant setup
                    access.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card variant="quiet">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="muted" className="mb-3">
                      Branch
                    </Badge>
                    <CardTitle>{onboarding.branch.name}</CardTitle>
                    <CardDescription>
                      Customer QR sessions and staff surfaces run against this
                      selected branch.
                    </CardDescription>
                  </div>
                  <MapPinned className="size-5 text-primary" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleBranchSubmit}>
                  <SetupField label="Name">
                    <Input
                      value={branchForm.name}
                      disabled={!canManageBranchOnboarding}
                      onChange={(event) =>
                        updateBranchDraft({ name: event.target.value })
                      }
                    />
                  </SetupField>
                  <SetupField label="Address">
                    <Input
                      value={branchForm.address}
                      disabled={!canManageBranchOnboarding}
                      onChange={(event) =>
                        updateBranchDraft({ address: event.target.value })
                      }
                    />
                  </SetupField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SetupField label="Slug">
                      <Input
                        value={branchForm.slug}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          updateBranchDraft({ slug: event.target.value })
                        }
                      />
                    </SetupField>
                    <SetupField label="Status">
                      <select
                        value={branchForm.status}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          updateBranchDraft({
                            status: normalizeBranchStatus(event.target.value)
                          })
                        }
                        className="min-h-11 rounded-button border bg-surface px-3 text-sm font-medium normal-case text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </SetupField>
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !canManageBranchOnboarding ||
                      updateBranchMutation.isPending
                    }
                  >
                    {updateBranchMutation.isPending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save branch
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <section id="setup-tables" className="scroll-mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card variant="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="muted" className="mb-3">
                      Tables and QR
                    </Badge>
                    <CardTitle>Branch service map</CardTitle>
                    <CardDescription>
                      Create floor labels and deterministic table codes with QR
                      tokens, then manage live QR links from the branch control
                      surface.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/staff/branches"
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm"
                      })}
                    >
                      <Table2 className="size-4" aria-hidden="true" />
                      Manage tables & QR
                    </Link>
                    <QrCode className="size-5 text-primary" aria-hidden="true" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <form
                  className="grid gap-3 md:grid-cols-[1fr_10rem_auto] md:items-end"
                  onSubmit={handleFloorSubmit}
                >
                  <SetupField label="Floor or area">
                    <Input
                      value={floorForm.name}
                      placeholder="Main Floor"
                      disabled={!canManageBranchOnboarding}
                      onChange={(event) =>
                        setFloorForm((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                    />
                  </SetupField>
                  <SetupField label="Sort order">
                    <Input
                      type="number"
                      min="0"
                      value={floorForm.sortOrder}
                      disabled={!canManageBranchOnboarding}
                      onChange={(event) =>
                        setFloorForm((current) => ({
                          ...current,
                          sortOrder: event.target.value
                        }))
                      }
                    />
                  </SetupField>
                  <Button
                    type="submit"
                    disabled={
                      !canManageBranchOnboarding ||
                      createFloorMutation.isPending ||
                      floorForm.name.trim().length === 0
                    }
                  >
                    Add floor
                  </Button>
                </form>

                <form className="grid gap-3" onSubmit={handleTablesSubmit}>
                  <div className="grid gap-3 md:grid-cols-5">
                    <SetupField label="Floor">
                      <Input
                        value={tableForm.floorLabel}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          setTableForm((current) => ({
                            ...current,
                            floorLabel: event.target.value
                          }))
                        }
                      />
                    </SetupField>
                    <SetupField label="Prefix">
                      <Input
                        value={tableForm.tablePrefix}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          setTableForm((current) => ({
                            ...current,
                            tablePrefix: event.target.value
                          }))
                        }
                      />
                    </SetupField>
                    <SetupField label="Start">
                      <Input
                        type="number"
                        min="1"
                        value={tableForm.startNumber}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          setTableForm((current) => ({
                            ...current,
                            startNumber: event.target.value
                          }))
                        }
                      />
                    </SetupField>
                    <SetupField label="Count">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={tableForm.count}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          setTableForm((current) => ({
                            ...current,
                            count: event.target.value
                          }))
                        }
                      />
                    </SetupField>
                    <SetupField label="Seats">
                      <Input
                        type="number"
                        min="1"
                        value={tableForm.seats}
                        disabled={!canManageBranchOnboarding}
                        onChange={(event) =>
                          setTableForm((current) => ({
                            ...current,
                            seats: event.target.value
                          }))
                        }
                      />
                    </SetupField>
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !canManageBranchOnboarding ||
                      bulkCreateTablesMutation.isPending ||
                      tableForm.floorLabel.trim().length === 0 ||
                      tableForm.tablePrefix.trim().length === 0
                    }
                  >
                    {bulkCreateTablesMutation.isPending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <QrCode className="size-4" aria-hidden="true" />
                    )}
                    Bulk create tables
                  </Button>
                </form>

                {bulkCreateTablesMutation.data ? (
                  <div className="rounded-button border bg-surface/70 p-4 text-sm text-muted-foreground">
                    Created {bulkCreateTablesMutation.data.createdCount} table
                    {bulkCreateTablesMutation.data.createdCount === 1 ? "" : "s"}
                    , skipped {bulkCreateTablesMutation.data.skippedCount}.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card variant="quiet">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Recent QR preview</CardTitle>
                    <CardDescription>
                      These links remain backed by real table QR tokens.
                    </CardDescription>
                  </div>
                  <Link
                    href="/staff/branches"
                    className={buttonVariants({
                      variant: "secondary",
                      size: "sm"
                    })}
                  >
                    <QrCode className="size-4" aria-hidden="true" />
                    QR manager
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {onboarding.tables.recentTables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tables have been created for this branch yet.
                    </p>
                  ) : null}
                  {onboarding.tables.recentTables.map((table) => (
                    <div
                      key={table.id}
                      className="grid gap-3 rounded-button border bg-surface/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {table.displayName}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">
                          {table.qrToken ?? "QR token pending"}
                        </p>
                      </div>
                      {table.customerPreviewPath ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void copyQrPreviewUrl(
                                table.id,
                                table.customerPreviewPath ?? ""
                              )
                            }
                          >
                            <LinkIcon className="size-4" aria-hidden="true" />
                            {copiedQrTableId === table.id
                              ? "Copied"
                              : "Copy URL"}
                          </Button>
                          <Link
                            href={table.customerPreviewPath}
                            className={buttonVariants({
                              variant: "secondary",
                              size: "sm"
                            })}
                          >
                            <ExternalLink
                              className="size-4"
                              aria-hidden="true"
                            />
                            Open QR
                          </Link>
                        </div>
                      ) : (
                        <Badge variant="warning">Missing QR</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="setup-team" className="scroll-mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card variant="quiet">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="muted" className="mb-3">
                      Staff setup
                    </Badge>
                    <CardTitle>Invite branch operators</CardTitle>
                    <CardDescription>
                      Create staff users, active memberships, and
                      first-password invite links for day-to-day branch
                      operations. Platform handles company and owner setup
                      repairs.
                    </CardDescription>
                  </div>
                  <UsersRound className="size-5 text-primary" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleStaffSubmit}>
                  <SetupField label="Name">
                    <Input
                      value={staffForm.name}
                      disabled={!canInviteBranchStaff}
                      onChange={(event) =>
                        setStaffForm((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                    />
                  </SetupField>
                  <SetupField label="Email">
                    <Input
                      type="email"
                      value={staffForm.email}
                      disabled={!canInviteBranchStaff}
                      onChange={(event) =>
                        setStaffForm((current) => ({
                          ...current,
                          email: event.target.value
                        }))
                      }
                    />
                  </SetupField>
                  <SetupField label="Role">
                    <select
                      value={staffRoleValue}
                      disabled={!canInviteBranchStaff}
                      onChange={(event) =>
                        setStaffForm((current) => ({
                          ...current,
                          role: event.target.value as TenantOnboardingStaffRole
                        }))
                      }
                      className="min-h-11 rounded-button border bg-surface px-3 text-sm font-medium normal-case text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {visibleStaffRoles.map((role) => (
                        <option key={role} value={role}>
                          {getStaffRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </SetupField>
                  <Button
                    type="submit"
                    disabled={
                      !canInviteBranchStaff ||
                      inviteStaffMutation.isPending ||
                      staffForm.name.trim().length === 0 ||
                      staffForm.email.trim().length === 0
                    }
                  >
                    {inviteStaffMutation.isPending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <KeyRound className="size-4" aria-hidden="true" />
                    )}
                    Create invite
                  </Button>
                </form>
                {inviteStaffMutation.isError ? (
                  <div className="mt-4 rounded-button border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
                    {formatErrorMessage(inviteStaffMutation.error)}
                  </div>
                ) : null}
                {lastStaffInvite ? (
                  <div className="mt-4 grid gap-4 rounded-button border border-success/35 bg-success/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Invite created
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Send this link to {lastStaffInvite.name} so they can
                          set their first staff password.
                        </p>
                      </div>
                      <Badge variant="success">
                        {getStaffRoleLabel(lastStaffInvite.role)}
                      </Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Input value={lastStaffInvite.inviteUrl} readOnly />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={copyStaffInviteUrl}
                      >
                        <Copy className="size-4" aria-hidden="true" />
                        {staffInviteCopied ? "Copied" : "Copy link"}
                      </Button>
                      <a
                        href={lastStaffInvite.inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({
                          variant: "secondary",
                          size: "md"
                        })}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Open invite
                      </a>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-foreground">
                          Email:
                        </span>{" "}
                        {lastStaffInvite.email}
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          Branch:
                        </span>{" "}
                        {lastStaffInvite.branchName}
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          Role:
                        </span>{" "}
                        {getStaffRoleLabel(lastStaffInvite.role)}
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          Expires:
                        </span>{" "}
                        {formatInviteExpiry(lastStaffInvite.expiresAt)}
                      </p>
                    </div>
                  </div>
                ) : null}
                {staffRoleValue === "owner" && !canInviteOwner ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Owner membership creation requires company-level staff
                    management. Branch managers can create branch roles.
                  </p>
                ) : null}
                {staffRoleValue === "owner" && canInviteOwner ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Owner invites create company-level staff access for this
                    cafe.
                  </p>
                ) : null}
                {staffRoleValue !== "owner" ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    This invite creates a {selectedStaffRoleLabel} membership
                    for {onboarding.branch.name}.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardHeader>
                <CardTitle>Role coverage</CardTitle>
                <CardDescription>
                  Launch checks are computed from active memberships.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allStaffRoles.map((role) => (
                    <div
                      key={role}
                      className="rounded-button border bg-surface/70 p-4"
                    >
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {getStaffRoleLabel(role)}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {roleCounts[role] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {onboarding.sections.map((section) => (
              <SectionProgressCard key={section.key} section={section} />
            ))}
          </section>

          <section id="setup-final" className="scroll-mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card variant="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="muted" className="mb-3">
                      Launch checklist
                    </Badge>
                    <CardTitle>Computed readiness</CardTitle>
                    <CardDescription>
                      The backend remains source of truth; Phase 4T.0
                      acknowledges manual notes without persisting fake status.
                    </CardDescription>
                  </div>
                  <ClipboardCheck
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ChecklistPanel
                  items={checklistItems}
                  canManage={canManageBranchOnboarding}
                  pendingKey={
                    readinessMutation.isPending
                      ? readinessMutation.variables?.key
                      : undefined
                  }
                  onAcknowledge={(item) => readinessMutation.mutate(item)}
                />
              </CardContent>
            </Card>

            <Card variant="quiet">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge
                      variant={
                        launchSummary?.readyForPilot
                          ? "success"
                          : launchSummary?.readyForDemo
                            ? "warning"
                            : "danger"
                      }
                      className="mb-3"
                    >
                      {launchSummary
                        ? getLaunchStatusLabel(launchSummary.status)
                        : "Checking"}
                    </Badge>
                    <CardTitle>What remains</CardTitle>
                    <CardDescription>
                      Critical blockers must be fixed before pilot launch.
                    </CardDescription>
                  </div>
                  <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {criticalBlockedItems.length === 0 ? (
                    <div className="rounded-button border border-success/40 bg-success/10 p-4 text-sm text-muted-foreground">
                      Demo-critical launch checks are ready for the selected
                      branch.
                    </div>
                  ) : null}
                  {criticalBlockedItems.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-button border bg-surface/70 p-4"
                    >
                      <p className="font-semibold text-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/staff/menu" className={buttonVariants({ variant: "secondary" })}>
                  <BookOpenText className="size-4" aria-hidden="true" />
                  Menu readiness
                </Link>
                <Link href="/staff/cashier" className={buttonVariants({ variant: "secondary" })}>
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  Cashier flow
                </Link>
              </CardFooter>
            </Card>
          </section>
        </SetupReadinessFrame>
      ) : null}
    </div>
  );
}

export function StaffSetupPage() {
  return (
    <div className="min-h-screen bg-[#F4F0EA] text-[#2B2520]">
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
        <StaffAuthGate
          requiredPermissions={["tenant_onboarding.read"]}
          branchScoped
          deniedTitle="Tenant setup access required"
          deniedDescription="This staff account can open its operational surfaces, but tenant launch setup requires owner or branch manager access."
        >
          <StaffSetupContent />
        </StaffAuthGate>
      </div>
    </div>
  );
}
