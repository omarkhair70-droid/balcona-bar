"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  Layers3,
  LinkIcon,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Table2,
  UsersRound
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import {
  branchStatuses,
  branchTableAdminTabs,
  buildQrTokenFromParts,
  copyText,
  getBranchAdminErrorMessage,
  humanizeBranchAdminValue,
  slugifyBranchAdminValue,
  tableStatuses,
  type BranchTableAdminTab
} from "@/features/staff/branch-table-admin-data";
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
import {
  activateBranch,
  activateTable,
  createBranch,
  createFloor,
  createTable,
  deactivateBranch,
  deactivateTable,
  generateTableQrToken,
  getBranchPrinterStations,
  getBranchTableAdminOverview,
  regenerateTableQrToken,
  updateBranch,
  updateFloor,
  updateTable
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import type {
  BranchAdminBranch,
  BranchAdminBranchStatus,
  BranchAdminFloor,
  BranchAdminOverviewResult,
  BranchAdminTable,
  BranchAdminTableStatus,
  CreateBranchPayload,
  CreateFloorPayload,
  CreateTablePayload,
  QrTokenMutationResult,
  UpdateBranchPayload,
  UpdateFloorPayload,
  UpdateTablePayload
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

type BranchFormState = {
  id: string | null;
  name: string;
  slug: string;
  address: string;
  status: BranchAdminBranchStatus;
};

type FloorFormState = {
  id: string | null;
  name: string;
  sortOrder: string;
};

type TableFormState = {
  id: string | null;
  code: string;
  displayName: string;
  capacity: string;
  floorId: string;
  status: BranchAdminTableStatus;
  qrToken: string;
};

type QrActionResult = {
  action: "generated" | "regenerated";
  tableName: string;
  qrToken: string;
  customerPreviewPath: string;
};

const emptyBranchForm: BranchFormState = {
  id: null,
  name: "",
  slug: "",
  address: "",
  status: "active"
};

const emptyFloorForm: FloorFormState = {
  id: null,
  name: "",
  sortOrder: "0"
};

const emptyTableForm: TableFormState = {
  id: null,
  code: "",
  displayName: "",
  capacity: "",
  floorId: "",
  status: "active",
  qrToken: ""
};

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35";

const textareaClassName =
  "min-h-24 w-full rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35";

function FieldLabel({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function statusVariant(
  status: string,
  activeLike = status === "active"
): "success" | "warning" | "danger" | "muted" {
  if (activeLike) {
    return "success";
  }

  if (status === "maintenance") {
    return "warning";
  }

  if (status === "error" || status === "urgent") {
    return "danger";
  }

  return "muted";
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : null;
}

function parseIntWithFallback(value: string, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toBranchForm(branch: BranchAdminBranch): BranchFormState {
  return {
    id: branch.id,
    name: branch.name,
    slug: branch.slug,
    address: branch.address ?? "",
    status: branch.status
  };
}

function toFloorForm(floor: BranchAdminFloor): FloorFormState {
  return {
    id: floor.id,
    name: floor.name,
    sortOrder: String(floor.sortOrder)
  };
}

function toTableForm(table: BranchAdminTable): TableFormState {
  return {
    id: table.id,
    code: table.code,
    displayName: table.displayName,
    capacity: table.capacity ? String(table.capacity) : "",
    floorId: table.floorId ?? "",
    status: table.status,
    qrToken: table.qrToken
  };
}

function buildBranchPayload(form: BranchFormState): CreateBranchPayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    address: form.address.trim() || null,
    status: form.status
  };
}

function buildFloorPayload(form: FloorFormState): CreateFloorPayload {
  return {
    name: form.name.trim(),
    sortOrder: parseIntWithFallback(form.sortOrder)
  };
}

function buildTablePayload(form: TableFormState): CreateTablePayload {
  return {
    code: form.code.trim(),
    displayName: form.displayName.trim(),
    capacity: parseOptionalInt(form.capacity),
    floorId: form.floorId || null,
    qrToken: form.qrToken.trim() || undefined,
    status: form.status
  };
}

function customerPreviewHref(path?: string | null, qrToken?: string | null) {
  if (path) {
    return path;
  }

  if (qrToken) {
    return `/guest/table/${encodeURIComponent(qrToken)}`;
  }

  return null;
}

function absoluteCustomerUrl(path: string | null, origin: string | null) {
  if (!path || !origin) {
    return null;
  }

  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

function subscribeToOrigin() {
  return () => undefined;
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? null : window.location.origin;
}

function getServerOrigin() {
  return null;
}

function toQrActionResult(
  action: QrActionResult["action"],
  result: QrTokenMutationResult
): QrActionResult {
  return {
    action,
    tableName: result.table.displayName,
    qrToken: result.qrToken,
    customerPreviewPath:
      customerPreviewHref(result.table.customerPreviewPath, result.qrToken) ??
      ""
  };
}

function MutationMessage({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 p-4 text-sm text-foreground">
      <AlertTriangle className="mt-0.5 size-4 text-danger" aria-hidden="true" />
      <div>
        <p className="font-semibold">Update did not save</p>
        <p className="text-muted-foreground">
          {getBranchAdminErrorMessage(error)}
        </p>
      </div>
    </div>
  );
}

function QrActionMessage({ result }: { result: QrActionResult | null }) {
  if (!result) {
    return null;
  }

  const actionLabel =
    result.action === "regenerated" ? "QR token regenerated" : "QR token ready";

  return (
    <div className="grid gap-3 rounded-card border border-success/35 bg-success/10 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {actionLabel}
          </p>
          <p className="mt-1 text-muted-foreground">
            {result.tableName} now uses token {result.qrToken}.
          </p>
        </div>
        <Badge variant="success">
          {result.action === "regenerated" ? "Printed QR invalidated" : "Ready"}
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Input value={result.customerPreviewPath} readOnly />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyText(result.customerPreviewPath)}
        >
          <LinkIcon className="size-4" aria-hidden="true" />
          Copy URL
        </Button>
        <Link
          href={result.customerPreviewPath}
          className={buttonVariants({
            variant: "secondary",
            size: "md"
          })}
        >
          <Eye className="size-4" aria-hidden="true" />
          Open QR
        </Link>
      </div>
    </div>
  );
}

function BranchTableMetrics({
  overview
}: {
  overview: BranchAdminOverviewResult;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-5">
      <MetricCard
        label="Tables"
        value={String(overview.stats.totalTables)}
        description={`${overview.stats.activeTables} active`}
        icon={<Table2 className="size-4" aria-hidden="true" />}
      />
      <MetricCard
        label="Sessions"
        value={String(overview.stats.activeSessions)}
        description="Open QR sessions"
        icon={<UsersRound className="size-4" aria-hidden="true" />}
        tone={overview.stats.activeSessions > 0 ? "success" : "muted"}
      />
      <MetricCard
        label="Missing QR"
        value={String(overview.stats.tablesMissingQrToken)}
        description={`${overview.stats.tablesWithQrToken} ready links`}
        icon={<QrCode className="size-4" aria-hidden="true" />}
        tone={overview.stats.tablesMissingQrToken > 0 ? "warning" : "success"}
      />
      <MetricCard
        label="Attention"
        value={String(overview.stats.needsAttention)}
        description="Open table signals"
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        tone={overview.stats.needsAttention > 0 ? "warning" : "muted"}
      />
      <MetricCard
        label="Issues"
        value={String(overview.stats.setupWarnings)}
        description="Readiness warnings"
        icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
        tone={overview.stats.setupWarnings > 0 ? "warning" : "success"}
      />
    </section>
  );
}

function BranchesSection({
  overview,
  form,
  isSaving,
  selectedBranchId,
  onSelectBranch,
  onFormChange,
  onSubmit,
  onEdit,
  onReset,
  onToggle
}: {
  overview: BranchAdminOverviewResult;
  form: BranchFormState;
  isSaving: boolean;
  selectedBranchId?: string;
  onSelectBranch: (branchId: string) => void;
  onFormChange: (form: BranchFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (branch: BranchAdminBranch) => void;
  onReset: () => void;
  onToggle: (branch: BranchAdminBranch) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Branch setup</Badge>
          <CardTitle>{form.id ? "Edit branch" : "Create branch"}</CardTitle>
          <CardDescription>
            Branches define the operating locations staff and customer QR flows
            attach to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <FieldLabel label="Name">
              <Input
                value={form.name}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    name: event.target.value,
                    slug: form.slug || slugifyBranchAdminValue(event.target.value)
                  })
                }
                placeholder="Main Branch"
                required
              />
            </FieldLabel>
            <FieldLabel label="Slug">
              <Input
                value={form.slug}
                onChange={(event) =>
                  onFormChange({ ...form, slug: event.target.value })
                }
                placeholder="main-branch"
                required
              />
            </FieldLabel>
            <FieldLabel label="Address">
              <textarea
                value={form.address}
                onChange={(event) =>
                  onFormChange({ ...form, address: event.target.value })
                }
                className={textareaClassName}
                placeholder="Optional branch address"
              />
            </FieldLabel>
            <FieldLabel label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    status: event.target.value as BranchAdminBranchStatus
                  })
                }
                className={selectClassName}
              >
                {branchStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanizeBranchAdminValue(status)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {form.id ? "Save branch" : "Create branch"}
              </Button>
              {form.id ? (
                <Button type="button" variant="secondary" onClick={onReset}>
                  Reset
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <Badge variant="muted">Company branches</Badge>
          <CardTitle>{overview.company.name}</CardTitle>
          <CardDescription>
            Select a branch to manage its floors, tables, QR tokens, and active
            sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.branches.map((branch) => (
            <div key={branch.id} className="rounded-card border bg-surface/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{branch.name}</h3>
                    <Badge variant={statusVariant(branch.status)}>
                      {branch.status}
                    </Badge>
                    {selectedBranchId === branch.id ? (
                      <Badge variant="default">Selected</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {branch.slug} / {branch.tablesCount ?? 0} tables /{" "}
                    {branch.floorsCount ?? 0} floors
                  </p>
                  {branch.address ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {branch.address}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectBranch(branch.id)}
                  >
                    Select
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEdit(branch)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={branch.status === "active" ? "secondary" : "primary"}
                    onClick={() => onToggle(branch)}
                  >
                    {branch.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {overview.branches.length === 0 ? (
            <EmptyState
              title="No branches yet"
              description="Create a branch before adding floors and tables."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function FloorsSection({
  floors,
  form,
  isSaving,
  onFormChange,
  onSubmit,
  onEdit,
  onReset
}: {
  floors: BranchAdminFloor[];
  form: FloorFormState;
  isSaving: boolean;
  onFormChange: (form: FloorFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (floor: BranchAdminFloor) => void;
  onReset: () => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Floor grouping</Badge>
          <CardTitle>{form.id ? "Edit floor" : "Create floor"}</CardTitle>
          <CardDescription>
            This project supports floors as the operational grouping for tables.
            Floor status is not in the current schema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <FieldLabel label="Name">
              <Input
                value={form.name}
                onChange={(event) =>
                  onFormChange({ ...form, name: event.target.value })
                }
                placeholder="Ground Floor"
                required
              />
            </FieldLabel>
            <FieldLabel label="Sort order">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(event) =>
                  onFormChange({ ...form, sortOrder: event.target.value })
                }
              />
            </FieldLabel>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                <Save className="size-4" aria-hidden="true" />
                {form.id ? "Save floor" : "Create floor"}
              </Button>
              {form.id ? (
                <Button type="button" variant="secondary" onClick={onReset}>
                  Reset
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <Badge variant="muted">Floors</Badge>
          <CardTitle>Operational grouping</CardTitle>
          <CardDescription>
            Tables can also remain ungrouped when a cafe does not need floors.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {floors.map((floor) => (
            <div
              key={floor.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-4"
            >
              <div>
                <p className="font-semibold">{floor.name}</p>
                <p className="text-sm text-muted-foreground">
                  Sort {floor.sortOrder}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onEdit(floor)}
              >
                Edit
              </Button>
            </div>
          ))}
          {floors.length === 0 ? (
            <EmptyState
              title="Ungrouped tables"
              description="This branch can use ungrouped tables until floors are needed."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function TablesSection({
  overview,
  form,
  isSaving,
  onFormChange,
  onSubmit,
  onEdit,
  onReset,
  onActivate,
  onDeactivate
}: {
  overview: BranchAdminOverviewResult;
  form: TableFormState;
  isSaving: boolean;
  onFormChange: (form: TableFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (table: BranchAdminTable) => void;
  onReset: () => void;
  onActivate: (table: BranchAdminTable) => void;
  onDeactivate: (table: BranchAdminTable) => void;
}) {
  const tables = [
    ...overview.tablesByFloor.flatMap((group) => group.tables),
    ...overview.ungroupedTables
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Table setup</Badge>
          <CardTitle>{form.id ? "Edit table" : "Create table"}</CardTitle>
          <CardDescription>
            Table status and QR token determine whether customers can start a QR
            session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Code">
                <Input
                  value={form.code}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      code: event.target.value,
                      qrToken:
                        form.qrToken ||
                        buildQrTokenFromParts(
                          overview.selectedBranch?.slug ?? "branch",
                          event.target.value
                        )
                    })
                  }
                  placeholder="T01"
                  required
                />
              </FieldLabel>
              <FieldLabel label="Display name">
                <Input
                  value={form.displayName}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      displayName: event.target.value
                    })
                  }
                  placeholder="Table 1"
                  required
                />
              </FieldLabel>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldLabel label="Capacity">
                <Input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(event) =>
                    onFormChange({ ...form, capacity: event.target.value })
                  }
                  placeholder="4"
                />
              </FieldLabel>
              <FieldLabel label="Floor">
                <select
                  value={form.floorId}
                  onChange={(event) =>
                    onFormChange({ ...form, floorId: event.target.value })
                  }
                  className={selectClassName}
                >
                  <option value="">Ungrouped</option>
                  {overview.floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      status: event.target.value as BranchAdminTableStatus
                    })
                  }
                  className={selectClassName}
                >
                  {tableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {humanizeBranchAdminValue(status)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <FieldLabel label="QR token">
              <Input
                value={form.qrToken}
                onChange={(event) =>
                  onFormChange({ ...form, qrToken: event.target.value })
                }
                placeholder="Leave blank to generate"
              />
            </FieldLabel>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                <Save className="size-4" aria-hidden="true" />
                {form.id ? "Save table" : "Create table"}
              </Button>
              {form.id ? (
                <Button type="button" variant="secondary" onClick={onReset}>
                  Reset
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <Badge variant="muted">Tables</Badge>
          <CardTitle>Branch tables</CardTitle>
          <CardDescription>
            Tables are grouped by floor when assigned, with ungrouped tables
            listed separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {overview.tablesByFloor.map((group) =>
            group.tables.length > 0 ? (
              <div key={group.id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{group.name}</h3>
                  <Badge variant="muted">{group.tableCount} tables</Badge>
                </div>
                {group.tables.map((table) => (
                  <TableRow
                    key={table.id}
                    table={table}
                    onEdit={onEdit}
                    onActivate={onActivate}
                    onDeactivate={onDeactivate}
                  />
                ))}
              </div>
            ) : null
          )}
          {overview.ungroupedTables.length > 0 ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Ungrouped</h3>
                <Badge variant="muted">
                  {overview.ungroupedTables.length} tables
                </Badge>
              </div>
              {overview.ungroupedTables.map((table) => (
                <TableRow
                  key={table.id}
                  table={table}
                  onEdit={onEdit}
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                />
              ))}
            </div>
          ) : null}
          {tables.length === 0 ? (
            <EmptyState
              title="No tables yet"
              description="Create tables before printing or previewing QR links."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function TableRow({
  table,
  onEdit,
  onActivate,
  onDeactivate
}: {
  table: BranchAdminTable;
  onEdit: (table: BranchAdminTable) => void;
  onActivate: (table: BranchAdminTable) => void;
  onDeactivate: (table: BranchAdminTable) => void;
}) {
  return (
    <div className="rounded-card border bg-surface/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{table.displayName}</p>
            <Badge variant={statusVariant(table.status)}>{table.status}</Badge>
            {table.activeSession ? (
              <Badge variant="success">Open session</Badge>
            ) : null}
            {table.qrToken ? <Badge variant="muted">QR ready</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {table.code} / capacity {table.capacity ?? "not set"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {table.qrToken || "Missing QR token"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(table)}>
            Edit
          </Button>
          {table.status === "active" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDeactivate(table)}
            >
              Deactivate
            </Button>
          ) : (
            <Button size="sm" onClick={() => onActivate(table)}>
              Activate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QrLinksSection({
  tables,
  webOrigin,
  isSaving,
  onGenerate,
  onRegenerate
}: {
  tables: BranchAdminTable[];
  webOrigin: string | null;
  isSaving: boolean;
  onGenerate: (table: BranchAdminTable) => void;
  onRegenerate: (table: BranchAdminTable) => void;
}) {
  return (
    <Card variant="glass">
      <CardHeader>
        <Badge variant="muted">Customer QR links</Badge>
        <CardTitle>QR token readiness</CardTitle>
        <CardDescription>
          Copyable tokens and customer preview links. Regenerating a token
          invalidates printed QR codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tables.map((table) => {
          const href = customerPreviewHref(
            table.customerPreviewPath,
            table.qrToken
          );
          const floorName = table.floor?.name ?? "No floor";
          const capacityLabel = table.capacity
            ? `${table.capacity} seats`
            : "Capacity not set";
          const hasQrToken = Boolean(table.qrToken);
          const canOpenCustomerQr = Boolean(href);
          const qrValue = absoluteCustomerUrl(href, webOrigin);

          return (
            <div key={table.id} className="rounded-card border bg-surface/70 p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{table.displayName}</p>
                    <Badge variant={hasQrToken ? "success" : "warning"}>
                      {hasQrToken ? "Token ready" : "Missing token"}
                    </Badge>
                    <Badge variant="muted">
                      {humanizeBranchAdminValue(table.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {floorName} | {table.code} | {capacityLabel}
                  </p>
                  <p className="mt-3 break-all font-mono text-sm text-muted-foreground">
                    {table.qrToken || "No QR token"}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {href ?? "Generate QR token first"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasQrToken ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void copyText(table.qrToken)}
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                          Token
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (href) {
                              void copyText(href);
                            }
                          }}
                          disabled={!canOpenCustomerQr}
                        >
                          <LinkIcon className="size-3.5" aria-hidden="true" />
                          URL
                        </Button>
                        {href ? (
                          <Link
                            href={href}
                            className={buttonVariants({
                              variant: "secondary",
                              size: "sm"
                            })}
                          >
                            <Eye className="size-3.5" aria-hidden="true" />
                            Open
                          </Link>
                        ) : (
                          <Button size="sm" variant="secondary" disabled>
                            <Eye className="size-3.5" aria-hidden="true" />
                            Open
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onRegenerate(table)}
                          disabled={isSaving}
                        >
                          <RefreshCw className="size-3.5" aria-hidden="true" />
                          Regenerate
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onGenerate(table)}
                          disabled={isSaving}
                        >
                          <QrCode className="size-3.5" aria-hidden="true" />
                          Generate
                        </Button>
                        <Button size="sm" variant="secondary" disabled>
                          <LinkIcon className="size-3.5" aria-hidden="true" />
                          URL
                        </Button>
                        <Button size="sm" variant="secondary" disabled>
                          <Eye className="size-3.5" aria-hidden="true" />
                          Open
                        </Button>
                      </>
                    )}
                    {!canOpenCustomerQr ? (
                      <span className="self-center text-xs font-semibold uppercase text-muted-foreground">
                        Generate QR token first
                      </span>
                    ) : null}
                  </div>
                </div>
                {hasQrToken && canOpenCustomerQr ? (
                  <div className="rounded-button border border-dashed bg-background p-3 text-center">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Printable QR card
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {table.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {floorName} | {table.code}
                    </p>
                    <div className="mt-3 rounded-button border bg-white p-3 text-xs text-slate-950">
                      {qrValue ? (
                        <QRCodeSVG
                          value={qrValue}
                          size={168}
                          level="M"
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                          className="mx-auto"
                        />
                      ) : (
                        <div className="grid min-h-40 place-items-center rounded-button border border-dashed border-slate-300 p-3 text-slate-600">
                          Preparing QR image
                        </div>
                      )}
                    </div>
                    <p className="mt-2 break-all text-[11px] text-muted-foreground">
                      {table.qrToken}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-muted-foreground">
                      {qrValue ?? href}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => window.print()}
                      disabled={!canOpenCustomerQr}
                    >
                      <Printer className="size-3.5" aria-hidden="true" />
                      Print page
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-button border border-dashed bg-background p-3 text-sm text-muted-foreground">
                    Generate QR token first.
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {tables.length === 0 ? (
          <EmptyState
            title="No QR links yet"
            description="Create tables before managing customer QR links."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function readStationField(
  station: Record<string, unknown>,
  key: string,
  fallback = "Not set"
) {
  const value = station[key];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function DevicesStationsSection({
  stations,
  isLoading
}: {
  stations: Record<string, unknown>[];
  isLoading: boolean;
}) {
  return (
    <Card variant="glass">
      <CardHeader>
        <Badge variant="muted">Branch hardware routing</Badge>
        <CardTitle>Devices / Stations</CardTitle>
        <CardDescription>
          Printer stations configured for kitchen, barista, dessert, or cashier
          routing. Live ticket execution remains in Kitchen.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? <LoadingState label="Loading branch stations" /> : null}
        {stations.map((station, index) => {
          const id = readStationField(station, "id", `station-${index}`);
          const name = readStationField(station, "name", "Unnamed station");
          const route = readStationField(station, "station", "General");
          const adapter = readStationField(station, "adapterType", "Not set");
          const status = readStationField(station, "status", "unknown");
          const isDefault = station.isDefault === true;

          return (
            <div
              key={id}
              className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {readStationField(station, "slug", id)}
                </p>
              </div>
              <Badge variant="muted">
                {humanizeBranchAdminValue(route)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {humanizeBranchAdminValue(adapter)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status === "active" ? "success" : "warning"}>
                  {humanizeBranchAdminValue(status)}
                </Badge>
                {isDefault ? <Badge variant="muted">Default</Badge> : null}
              </div>
            </div>
          );
        })}
        {stations.length === 0 && !isLoading ? (
          <EmptyState
            title="No printer stations configured"
            description="Supported branch printer stations will appear here after configuration."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function BranchTableAdminContent() {
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
    effectiveAccess?.companies[0]?.company.id ??
    effectiveAccess?.branches[0]?.company.id;
  const [activeTab, setActiveTab] =
    useState<BranchTableAdminTab>("tables");
  const [branchForm, setBranchForm] =
    useState<BranchFormState>(emptyBranchForm);
  const [floorForm, setFloorForm] = useState<FloorFormState>(emptyFloorForm);
  const [tableForm, setTableForm] = useState<TableFormState>(emptyTableForm);
  const [lastQrAction, setLastQrAction] = useState<QrActionResult | null>(null);
  const webOrigin = useSyncExternalStore(
    subscribeToOrigin,
    getBrowserOrigin,
    getServerOrigin
  );
  const overviewQuery = useQuery({
    queryKey: staffQueryKeys.branchTableAdminOverview(
      selectedCompanyId,
      selectedBranchId
    ),
    queryFn: () =>
      getBranchTableAdminOverview(
        selectedCompanyId ?? "",
        selectedBranchId,
        accessToken
      ),
    enabled: Boolean(accessToken && selectedCompanyId),
    staleTime: 30_000
  });
  const printerStationsQuery = useQuery({
    queryKey: staffQueryKeys.printerStations(selectedBranchId),
    queryFn: () =>
      getBranchPrinterStations(
        selectedBranchId ?? "",
        accessToken ?? undefined
      ),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const overview = overviewQuery.data;
  const allTables = useMemo(
    () =>
      overview
        ? [
            ...overview.tablesByFloor.flatMap((group) => group.tables),
            ...overview.ungroupedTables
          ]
        : [],
    [overview]
  );

  function refreshBranchAdmin() {
    if (!selectedCompanyId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchTableAdminOverview(
        selectedCompanyId,
        selectedBranchId
      )
    });
    void queryClient.invalidateQueries({ queryKey: staffQueryKeys.me() });
    if (selectedBranchId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    }
  }

  function requireCompanyScope() {
    if (!selectedCompanyId || !accessToken) {
      throw new Error("Branch admin context is not ready.");
    }

    return {
      companyId: selectedCompanyId,
      token: accessToken
    };
  }

  function requireBranchScope() {
    const branchId = overview?.selectedBranch?.id ?? selectedBranchId;

    if (!branchId || !accessToken) {
      throw new Error("Select a branch before saving branch table setup.");
    }

    return {
      branchId,
      token: accessToken
    };
  }

  const createBranchMutation = useMutation({
    mutationFn: (payload: CreateBranchPayload) => {
      const { companyId, token } = requireCompanyScope();

      return createBranch(companyId, payload, token);
    },
    onSuccess: (result) => {
      setBranchForm(emptyBranchForm);
      setSelectedBranchId(result.branch.id);
      refreshBranchAdmin();
    }
  });
  const updateBranchMutation = useMutation({
    mutationFn: ({
      branchId,
      payload
    }: {
      branchId: string;
      payload: UpdateBranchPayload;
    }) => updateBranch(branchId, payload, accessToken),
    onSuccess: () => {
      setBranchForm(emptyBranchForm);
      refreshBranchAdmin();
    }
  });
  const toggleBranchMutation = useMutation({
    mutationFn: (branch: BranchAdminBranch) =>
      branch.status === "active"
        ? deactivateBranch(branch.id, accessToken)
        : activateBranch(branch.id, accessToken),
    onSuccess: refreshBranchAdmin
  });
  const createFloorMutation = useMutation({
    mutationFn: (payload: CreateFloorPayload) => {
      const { branchId, token } = requireBranchScope();

      return createFloor(branchId, payload, token);
    },
    onSuccess: () => {
      setFloorForm(emptyFloorForm);
      refreshBranchAdmin();
    }
  });
  const updateFloorMutation = useMutation({
    mutationFn: ({
      floorId,
      payload
    }: {
      floorId: string;
      payload: UpdateFloorPayload;
    }) => {
      const { branchId, token } = requireBranchScope();

      return updateFloor(branchId, floorId, payload, token);
    },
    onSuccess: () => {
      setFloorForm(emptyFloorForm);
      refreshBranchAdmin();
    }
  });
  const createTableMutation = useMutation({
    mutationFn: (payload: CreateTablePayload) => {
      const { branchId, token } = requireBranchScope();

      return createTable(branchId, payload, token);
    },
    onSuccess: () => {
      setTableForm(emptyTableForm);
      refreshBranchAdmin();
    }
  });
  const updateTableMutation = useMutation({
    mutationFn: ({
      tableId,
      payload
    }: {
      tableId: string;
      payload: UpdateTablePayload;
    }) => {
      const { branchId, token } = requireBranchScope();

      return updateTable(branchId, tableId, payload, token);
    },
    onSuccess: () => {
      setTableForm(emptyTableForm);
      refreshBranchAdmin();
    }
  });
  const activateTableMutation = useMutation({
    mutationFn: (table: BranchAdminTable) => {
      const { branchId, token } = requireBranchScope();

      return activateTable(branchId, table.id, token);
    },
    onSuccess: refreshBranchAdmin
  });
  const deactivateTableMutation = useMutation({
    mutationFn: (table: BranchAdminTable) => {
      const { branchId, token } = requireBranchScope();

      return deactivateTable(branchId, table.id, token);
    },
    onSuccess: refreshBranchAdmin
  });
  const generateQrMutation = useMutation({
    mutationFn: (table: BranchAdminTable) => {
      const { branchId, token } = requireBranchScope();

      return generateTableQrToken(branchId, table.id, token);
    },
    onMutate: () => setLastQrAction(null),
    onSuccess: (result) => {
      setLastQrAction(toQrActionResult("generated", result));
      refreshBranchAdmin();
    }
  });
  const regenerateQrMutation = useMutation({
    mutationFn: (table: BranchAdminTable) => {
      const { branchId, token } = requireBranchScope();

      return regenerateTableQrToken(branchId, table.id, token);
    },
    onMutate: () => setLastQrAction(null),
    onSuccess: (result) => {
      setLastQrAction(toQrActionResult("regenerated", result));
      refreshBranchAdmin();
    }
  });
  const isMutating =
    createBranchMutation.isPending ||
    updateBranchMutation.isPending ||
    toggleBranchMutation.isPending ||
    createFloorMutation.isPending ||
    updateFloorMutation.isPending ||
    createTableMutation.isPending ||
    updateTableMutation.isPending ||
    activateTableMutation.isPending ||
    deactivateTableMutation.isPending ||
    generateQrMutation.isPending ||
    regenerateQrMutation.isPending;
  const mutationError =
    createBranchMutation.error ??
    updateBranchMutation.error ??
    toggleBranchMutation.error ??
    createFloorMutation.error ??
    updateFloorMutation.error ??
    createTableMutation.error ??
    updateTableMutation.error ??
    activateTableMutation.error ??
    deactivateTableMutation.error ??
    generateQrMutation.error ??
    regenerateQrMutation.error;

  function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildBranchPayload(branchForm);

    if (branchForm.id) {
      updateBranchMutation.mutate({
        branchId: branchForm.id,
        payload
      });
      return;
    }

    createBranchMutation.mutate(payload);
  }

  function handleFloorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildFloorPayload(floorForm);

    if (floorForm.id) {
      updateFloorMutation.mutate({
        floorId: floorForm.id,
        payload
      });
      return;
    }

    createFloorMutation.mutate(payload);
  }

  function handleTableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildTablePayload(tableForm);

    if (tableForm.id) {
      updateTableMutation.mutate({
        tableId: tableForm.id,
        payload
      });
      return;
    }

    createTableMutation.mutate(payload);
  }

  if (!accessToken) {
    return null;
  }

  if (!selectedCompanyId) {
    return (
      <EmptyState
        title="No company access"
        description="Branch & Tables requires staff access to at least one company."
      />
    );
  }

  if (overviewQuery.isPending) {
    return <LoadingState label="Loading branch and table admin" />;
  }

  if (overviewQuery.isError) {
    return (
      <EmptyState
        title="Branch admin could not load"
        description={getBranchAdminErrorMessage(overviewQuery.error)}
        action={
          <Button onClick={() => void overviewQuery.refetch()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  if (!overview) {
    return (
      <EmptyState
        title="Branch admin is unavailable"
        description="The branch admin overview did not return data."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <Card variant="accent">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <Badge variant="muted">Branch and QR readiness</Badge>
            <CardTitle>
              {overview.selectedBranch?.name ?? overview.company.name}
            </CardTitle>
            <CardDescription>
              Manage branch profiles, floors, tables, and QR access from one
              configuration-scoped surface. Live sessions stay in Operations.
            </CardDescription>
          </div>
          <StaffBranchSelector
            access={effectiveAccess}
            selectedBranchId={selectedBranchId}
            onChange={setSelectedBranchId}
            className="min-w-64"
          />
        </CardHeader>
      </Card>

      <BranchTableMetrics overview={overview} />
      <MutationMessage error={mutationError} />
      <QrActionMessage result={lastQrAction} />

      <div className="flex flex-wrap gap-2 rounded-card border bg-surface/70 p-2">
        {branchTableAdminTabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? "primary" : "ghost"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.id === "branches" ? (
              <Building2 className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "floors" ? (
              <Layers3 className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "tables" ? (
              <Table2 className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "qr" ? (
              <QrCode className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "devices" ? (
              <Printer className="size-4" aria-hidden="true" />
            ) : null}
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "branches" ? (
        <BranchesSection
          overview={overview}
          form={branchForm}
          isSaving={isMutating}
          selectedBranchId={overview.selectedBranch?.id ?? selectedBranchId}
          onSelectBranch={(branchId) => {
            setSelectedBranchId(branchId);
            setBranchForm(emptyBranchForm);
            setFloorForm(emptyFloorForm);
            setTableForm(emptyTableForm);
            setLastQrAction(null);
          }}
          onFormChange={setBranchForm}
          onSubmit={handleBranchSubmit}
          onEdit={(branch) => setBranchForm(toBranchForm(branch))}
          onReset={() => setBranchForm(emptyBranchForm)}
          onToggle={(branch) => toggleBranchMutation.mutate(branch)}
        />
      ) : null}

      {activeTab === "floors" ? (
        <FloorsSection
          floors={overview.floors}
          form={floorForm}
          isSaving={isMutating}
          onFormChange={setFloorForm}
          onSubmit={handleFloorSubmit}
          onEdit={(floor) => setFloorForm(toFloorForm(floor))}
          onReset={() => setFloorForm(emptyFloorForm)}
        />
      ) : null}

      {activeTab === "tables" ? (
        <TablesSection
          overview={overview}
          form={tableForm}
          isSaving={isMutating}
          onFormChange={setTableForm}
          onSubmit={handleTableSubmit}
          onEdit={(table) => setTableForm(toTableForm(table))}
          onReset={() => setTableForm(emptyTableForm)}
          onActivate={(table) => activateTableMutation.mutate(table)}
          onDeactivate={(table) => deactivateTableMutation.mutate(table)}
        />
      ) : null}

      {activeTab === "qr" ? (
        <QrLinksSection
          tables={allTables}
          webOrigin={webOrigin}
          isSaving={isMutating}
          onGenerate={(table) => generateQrMutation.mutate(table)}
          onRegenerate={(table) => {
            if (
              window.confirm(
                "Regenerating a QR token invalidates printed QR codes. Continue?"
              )
            ) {
              regenerateQrMutation.mutate(table);
            }
          }}
        />
      ) : null}

      {activeTab === "devices" ? (
        <DevicesStationsSection
          stations={printerStationsQuery.data?.printerStations ?? []}
          isLoading={printerStationsQuery.isPending}
        />
      ) : null}

    </div>
  );
}

export function BranchTableAdminPage() {
  const t = useTranslations("staff");

  return (
    <OfficeStaffShell
      activeDomain="locations"
      title={t("office.locationsTitle")}
      description={t("office.locationsDescription")}
    >
      <StaffAuthGate requiredPermissions={["settings.manage"]} branchScoped>
        <BranchTableAdminContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
