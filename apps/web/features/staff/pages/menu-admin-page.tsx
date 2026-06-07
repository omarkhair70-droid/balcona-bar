"use client";

/* eslint-disable @next/next/no-img-element -- Cafe image URLs are user-provided and cannot be preconfigured in Next image remote patterns. */

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  BookOpenText,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageIcon,
  LayoutDashboard,
  LinkIcon,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Tags,
  Trash2
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState
} from "react";
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
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import {
  formatMenuMoney,
  getMenuAdminErrorMessage,
  humanizeMenuAdminValue,
  menuAdminTabs,
  menuCategoryStatuses,
  menuInputToInteger,
  menuInputToMinor,
  menuItemStatuses,
  menuPreparationStations,
  minorToMenuInput,
  modifierSelectionTypes,
  modifierStatuses,
  optionalMenuInputToMinor,
  slugifyMenuAdminValue,
  type MenuAdminTab
} from "@/features/staff/menu-admin-data";
import {
  activateMenuCategory,
  activateMenuItem,
  activateModifierGroup,
  activateModifierOption,
  archiveMenuItem,
  createMenuCategory,
  createMenuItem,
  createMenuItemModifierGroup,
  createModifierGroup,
  createModifierOption,
  deactivateMenuCategory,
  deactivateMenuItem,
  deactivateModifierGroup,
  deactivateModifierOption,
  deleteBranchMenuItemOverride,
  deleteMenuItemModifierGroup,
  getBranchMenuAdminOverview,
  updateMenuCategory,
  updateMenuItem,
  updateModifierGroup,
  updateModifierOption,
  upsertBranchMenuItemOverride
} from "@/lib/api/endpoints";
import { customerQueryKeys, staffQueryKeys } from "@/lib/api/query-keys";
import type {
  CreateMenuCategoryPayload,
  CreateMenuItemModifierGroupPayload,
  CreateMenuItemPayload,
  CreateModifierGroupPayload,
  CreateModifierOptionPayload,
  MenuAdminCategory,
  MenuAdminCategoryStatus,
  MenuAdminItem,
  MenuAdminItemStatus,
  MenuAdminModifierGroup,
  MenuAdminModifierOption,
  MenuAdminModifierStatus,
  MenuAdminOverviewResult,
  MenuAdminPreparationStation,
  MenuAdminSelectionType,
  UpdateMenuCategoryPayload,
  UpdateMenuItemPayload,
  UpdateModifierGroupPayload,
  UpdateModifierOptionPayload,
  UpsertBranchMenuItemOverridePayload
} from "@/lib/api/types";
import { getMenuAdminAccessMode } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

type CategoryFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  status: MenuAdminCategoryStatus;
};

type ItemFormState = {
  id: string | null;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  basePrice: string;
  currency: string;
  station: MenuAdminPreparationStation;
  status: MenuAdminItemStatus;
  isFeatured: boolean;
  sortOrder: string;
};

type ModifierGroupFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  selectionType: MenuAdminSelectionType;
  isRequired: boolean;
  minSelections: string;
  maxSelections: string;
  sortOrder: string;
  status: MenuAdminModifierStatus;
};

type ModifierOptionFormState = {
  id: string | null;
  name: string;
  slug: string;
  priceDelta: string;
  status: MenuAdminModifierStatus;
  sortOrder: string;
};

type AvailabilityDraft = {
  isVisible: boolean;
  isAvailable: boolean;
  priceOverride: string;
  sortOrder: string;
};

type LinkFormState = {
  itemId: string;
  modifierGroupId: string;
  sortOrder: string;
};

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35";

const textareaClassName =
  "min-h-24 w-full rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35";

const emptyCategoryForm: CategoryFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  status: "active"
};

const emptyItemForm: ItemFormState = {
  id: null,
  categoryId: "",
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  basePrice: "0.00",
  currency: "EGP",
  station: "barista",
  status: "active",
  isFeatured: false,
  sortOrder: "0"
};

const emptyModifierGroupForm: ModifierGroupFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  selectionType: "single",
  isRequired: false,
  minSelections: "0",
  maxSelections: "1",
  sortOrder: "0",
  status: "active"
};

const emptyModifierOptionForm: ModifierOptionFormState = {
  id: null,
  name: "",
  slug: "",
  priceDelta: "0.00",
  status: "active",
  sortOrder: "0"
};

const emptyLinkForm: LinkFormState = {
  itemId: "",
  modifierGroupId: "",
  sortOrder: "0"
};

function getVisibleMenuAdminTabs(canManageFullMenu: boolean) {
  return canManageFullMenu
    ? menuAdminTabs
    : menuAdminTabs.filter(
        (tab) =>
          tab.id === "overview" ||
          tab.id === "availability" ||
          tab.id === "preview"
      );
}

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
  isVisible?: boolean
): "success" | "danger" | "warning" {
  if (status === "active" || isVisible) {
    return "success";
  }

  if (status === "archived") {
    return "danger";
  }

  return "warning";
}

function buildCategoryPayload(
  form: CategoryFormState
): CreateMenuCategoryPayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    sortOrder: menuInputToInteger(form.sortOrder),
    status: form.status
  };
}

function buildItemPayload(form: ItemFormState): CreateMenuItemPayload {
  return {
    categoryId: form.categoryId,
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    basePriceMinor: menuInputToMinor(form.basePrice),
    currency: form.currency.trim().toUpperCase() || "EGP",
    station: form.station,
    status: form.status,
    isFeatured: form.isFeatured,
    sortOrder: menuInputToInteger(form.sortOrder)
  };
}

function buildModifierGroupPayload(
  form: ModifierGroupFormState
): CreateModifierGroupPayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    selectionType: form.selectionType,
    isRequired: form.isRequired,
    minSelections: menuInputToInteger(form.minSelections),
    maxSelections: menuInputToInteger(form.maxSelections, 1),
    sortOrder: menuInputToInteger(form.sortOrder),
    status: form.status
  };
}

function buildModifierOptionPayload(
  form: ModifierOptionFormState
): CreateModifierOptionPayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    priceDeltaMinor: menuInputToMinor(form.priceDelta),
    status: form.status,
    sortOrder: menuInputToInteger(form.sortOrder)
  };
}

function toCategoryForm(category: MenuAdminCategory): CategoryFormState {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    sortOrder: String(category.sortOrder),
    status: category.status as MenuAdminCategoryStatus
  };
}

function toItemForm(item: MenuAdminItem): ItemFormState {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    imageUrl: item.imageUrl ?? "",
    basePrice: minorToMenuInput(item.basePriceMinor),
    currency: item.currency,
    station: item.station,
    status: item.status,
    isFeatured: item.isFeatured,
    sortOrder: String(item.sortOrder)
  };
}

function toModifierGroupForm(
  group: MenuAdminModifierGroup
): ModifierGroupFormState {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    description: group.description ?? "",
    selectionType: group.selectionType,
    isRequired: group.isRequired,
    minSelections: String(group.minSelections),
    maxSelections: String(group.maxSelections),
    sortOrder: String(group.sortOrder),
    status: group.status
  };
}

function toModifierOptionForm(
  option: MenuAdminModifierOption
): ModifierOptionFormState {
  return {
    id: option.id,
    name: option.name,
    slug: option.slug,
    priceDelta: minorToMenuInput(option.priceDeltaMinor),
    status: option.status,
    sortOrder: String(option.sortOrder)
  };
}

function MenuAdminActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        Staff overview
      </Link>
    </div>
  );
}

function MenuAdminMetrics({ overview }: { overview: MenuAdminOverviewResult }) {
  return (
    <section className="grid gap-4 md:grid-cols-4">
      <MetricCard
        label="Customer visible"
        value={String(overview.stats.visibleItems)}
        description={`${overview.stats.items} configured items`}
        icon={<Eye className="size-4" aria-hidden="true" />}
        tone="success"
      />
      <MetricCard
        label="Unavailable"
        value={String(overview.stats.unavailableItems)}
        description="Items not orderable for this branch"
        icon={<EyeOff className="size-4" aria-hidden="true" />}
        tone={overview.stats.unavailableItems > 0 ? "warning" : "muted"}
      />
      <MetricCard
        label="Modifiers"
        value={String(overview.stats.modifierGroups)}
        description="Reusable option groups"
        icon={<Settings2 className="size-4" aria-hidden="true" />}
      />
      <MetricCard
        label="Setup issues"
        value={String(overview.stats.setupWarnings)}
        description="Warnings and blockers"
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        tone={overview.stats.setupWarnings > 0 ? "warning" : "success"}
      />
    </section>
  );
}

type MenuAdminDerivedStats = {
  activeCategories: number;
  inactiveCategories: number;
  activeItems: number;
  inactiveItems: number;
  archivedItems: number;
  featuredItems: number;
  missingImageItems: number;
  missingPriceItems: number;
  branchOverrides: number;
  activeModifierGroups: number;
  inactiveModifierGroups: number;
  modifierOptions: number;
  activeModifierOptions: number;
};

function getMenuAdminDerivedStats(
  overview: MenuAdminOverviewResult
): MenuAdminDerivedStats {
  const items = overview.categories.flatMap((category) => category.items);

  return {
    activeCategories: overview.categories.filter(
      (category) => category.status === "active"
    ).length,
    inactiveCategories: overview.categories.filter(
      (category) => category.status !== "active"
    ).length,
    activeItems: items.filter((item) => item.status === "active").length,
    inactiveItems: items.filter((item) => item.status === "inactive").length,
    archivedItems: items.filter((item) => item.status === "archived").length,
    featuredItems: items.filter((item) => item.isFeatured).length,
    missingImageItems: items.filter((item) => !item.imageUrl?.trim()).length,
    missingPriceItems: items.filter((item) => item.basePriceMinor <= 0).length,
    branchOverrides: items.filter((item) => item.hasBranchOverride).length,
    activeModifierGroups: overview.modifierGroups.filter(
      (group) => group.status === "active"
    ).length,
    inactiveModifierGroups: overview.modifierGroups.filter(
      (group) => group.status !== "active"
    ).length,
    modifierOptions: overview.modifierGroups.reduce(
      (count, group) => count + group.options.length,
      0
    ),
    activeModifierOptions: overview.modifierGroups.reduce(
      (count, group) =>
        count + group.options.filter((option) => option.status === "active").length,
      0
    )
  };
}

function OverviewMetric({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClassName =
    tone === "success"
      ? "border-success/40 bg-success/10"
      : tone === "warning"
        ? "border-warning/40 bg-warning/10"
        : "border-border bg-surface/70";

  return (
    <div className={`rounded-card border p-4 ${toneClassName}`}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function OverviewSection({ overview }: { overview: MenuAdminOverviewResult }) {
  const stats = getMenuAdminDerivedStats(overview);
  const issuePreview = overview.setupIssues.slice(0, 5);

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          label="Categories"
          value={`${stats.activeCategories}/${overview.categories.length}`}
          detail={`${stats.inactiveCategories} inactive categories`}
          tone={stats.activeCategories > 0 ? "success" : "warning"}
        />
        <OverviewMetric
          label="Items"
          value={`${stats.activeItems}/${overview.stats.items}`}
          detail={`${stats.inactiveItems} inactive, ${stats.archivedItems} archived`}
          tone={stats.activeItems > 0 ? "success" : "warning"}
        />
        <OverviewMetric
          label="Branch availability"
          value={String(overview.stats.visibleItems)}
          detail={`${overview.stats.hiddenItems} hidden, ${overview.stats.unavailableItems} unavailable`}
          tone={overview.stats.visibleItems > 0 ? "success" : "warning"}
        />
        <OverviewMetric
          label="Modifiers"
          value={`${stats.activeModifierGroups}/${overview.stats.modifierGroups}`}
          detail={`${stats.activeModifierOptions}/${stats.modifierOptions} active options`}
          tone={
            overview.stats.modifierGroups === 0 || stats.activeModifierGroups > 0
              ? "success"
              : "warning"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card variant="quiet">
          <CardHeader>
            <Badge variant="muted">Company menu setup</Badge>
            <CardTitle>Catalog readiness</CardTitle>
            <CardDescription>
              Company-level records define the base menu used by every branch.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3">
              <span>Featured items</span>
              <Badge variant={stats.featuredItems > 0 ? "success" : "muted"}>
                {stats.featuredItems}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3">
              <span>Items without image URL</span>
              <Badge variant={stats.missingImageItems > 0 ? "warning" : "success"}>
                {stats.missingImageItems}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3">
              <span>Items with zero base price</span>
              <Badge variant={stats.missingPriceItems > 0 ? "warning" : "success"}>
                {stats.missingPriceItems}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <Badge variant="muted">Branch readiness</Badge>
            <CardTitle>{overview.branch.name}</CardTitle>
            <CardDescription>
              Branch overrides control customer visibility, availability, and
              price adjustments without changing the base menu.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3">
              <span>Branch overrides</span>
              <Badge variant={stats.branchOverrides > 0 ? "warning" : "muted"}>
                {stats.branchOverrides}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3">
              <span>Customer visible items</span>
              <Badge
                variant={overview.stats.visibleItems > 0 ? "success" : "warning"}
              >
                {overview.stats.visibleItems}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3">
              <span>Setup warnings</span>
              <Badge
                variant={overview.setupIssues.length > 0 ? "warning" : "success"}
              >
                {overview.setupIssues.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant={overview.setupIssues.length > 0 ? "accent" : "quiet"}>
        <CardHeader>
          <Badge
            variant={overview.setupIssues.length > 0 ? "warning" : "success"}
          >
            Readiness check
          </Badge>
          <CardTitle>
            {overview.setupIssues.length > 0
              ? "Setup warnings need review"
              : "Menu is customer-ready"}
          </CardTitle>
          <CardDescription>
            Customer QR sessions use this branch menu data directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {issuePreview.map((issue) => (
            <div
              key={`${issue.code}-${issue.itemId ?? issue.categoryId ?? issue.modifierGroupId ?? issue.scope}`}
              className="rounded-card border bg-surface/70 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={issue.severity === "error" ? "danger" : "warning"}
                >
                  {issue.severity}
                </Badge>
                <Badge variant="muted">{humanizeMenuAdminValue(issue.scope)}</Badge>
              </div>
              <p className="mt-2 text-foreground">{issue.message}</p>
            </div>
          ))}
          {overview.setupIssues.length > issuePreview.length ? (
            <p className="text-sm text-muted-foreground">
              {overview.setupIssues.length - issuePreview.length} more warnings
              are listed in Preview Issues.
            </p>
          ) : null}
          {overview.setupIssues.length === 0 ? (
            <div className="flex items-start gap-3 rounded-card border border-success/40 bg-success/10 p-4">
              <CheckCircle2
                className="mt-0.5 size-4 text-success"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">No setup issues</p>
                <p className="text-sm text-muted-foreground">
                  Active customer QR sessions can use this menu.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
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
          {getMenuAdminErrorMessage(error)}
        </p>
      </div>
    </div>
  );
}

function SuccessMessage({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 rounded-card border border-success/40 bg-success/10 p-4 text-sm text-foreground">
      <CheckCircle2 className="mt-0.5 size-4 text-success" aria-hidden="true" />
      <div>
        <p className="font-semibold">Saved</p>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function MenuImagePreview({
  imageUrl,
  label,
  compact = false
}: {
  imageUrl?: string | null;
  label: string;
  compact?: boolean;
}) {
  const normalizedUrl = imageUrl?.trim();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasFailed = Boolean(normalizedUrl && failedUrl === normalizedUrl);
  const minHeightClassName = compact ? "min-h-24" : "min-h-44";
  const imageHeightClassName = compact ? "h-24" : "h-44";

  if (!normalizedUrl || hasFailed) {
    return (
      <div
        className={`grid ${minHeightClassName} place-items-center rounded-card border border-dashed bg-surface/60 p-4 text-center text-sm text-muted-foreground`}
      >
        <div className="grid justify-items-center gap-2">
          <ImageIcon className="size-5" aria-hidden="true" />
          <span>
            {normalizedUrl
              ? "Image preview could not load"
              : "No image URL yet"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-card border bg-surface ${minHeightClassName}`}
    >
      <img
        src={normalizedUrl}
        alt={`${label} menu image preview`}
        className={`${imageHeightClassName} w-full object-cover`}
        onError={() => setFailedUrl(normalizedUrl)}
      />
    </div>
  );
}

function CategorySection({
  categories,
  form,
  isSaving,
  onFormChange,
  onSubmit,
  onEdit,
  onReset,
  onToggleStatus
}: {
  categories: MenuAdminCategory[];
  form: CategoryFormState;
  isSaving: boolean;
  onFormChange: (form: CategoryFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (category: MenuAdminCategory) => void;
  onReset: () => void;
  onToggleStatus: (category: MenuAdminCategory) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Category setup</Badge>
          <CardTitle>{form.id ? "Edit category" : "Create category"}</CardTitle>
          <CardDescription>
            Customer menu sections use active categories ordered by sort order.
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
                    slug: form.slug || slugifyMenuAdminValue(event.target.value)
                  })
                }
                placeholder="Coffee"
                required
              />
            </FieldLabel>
            <FieldLabel label="Slug">
              <Input
                value={form.slug}
                onChange={(event) =>
                  onFormChange({ ...form, slug: event.target.value })
                }
                placeholder="coffee"
                required
              />
            </FieldLabel>
            <FieldLabel label="Description">
              <textarea
                value={form.description}
                onChange={(event) =>
                  onFormChange({ ...form, description: event.target.value })
                }
                className={textareaClassName}
                placeholder="Optional internal/customer context"
              />
            </FieldLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Sort order">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    onFormChange({ ...form, sortOrder: event.target.value })
                  }
                />
              </FieldLabel>
              <FieldLabel label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      status: event.target.value as MenuAdminCategoryStatus
                    })
                  }
                  className={selectClassName}
                >
                  {menuCategoryStatuses.map((status) => (
                    <option key={status} value={status}>
                      {humanizeMenuAdminValue(status)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {form.id ? "Save category" : "Create category"}
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
          <Badge variant="muted">Menu sections</Badge>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Inactive categories keep their data but disappear from the customer
            menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-card border bg-surface/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{category.name}</h3>
                    <Badge variant={statusVariant(category.status)}>
                      {category.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category.slug} / {category.itemCount} items /{" "}
                    {category.visibleItemCount} visible
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEdit(category)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      category.status === "active" ? "secondary" : "primary"
                    }
                    onClick={() => onToggleStatus(category)}
                  >
                    {category.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Create a category before adding items."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function ItemSection({
  categories,
  items,
  form,
  isSaving,
  onFormChange,
  onSubmit,
  onEdit,
  onReset,
  onActivate,
  onDeactivate,
  onArchive
}: {
  categories: MenuAdminCategory[];
  items: MenuAdminItem[];
  form: ItemFormState;
  isSaving: boolean;
  onFormChange: (form: ItemFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (item: MenuAdminItem) => void;
  onReset: () => void;
  onActivate: (item: MenuAdminItem) => void;
  onDeactivate: (item: MenuAdminItem) => void;
  onArchive: (item: MenuAdminItem) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const filteredItems = items.filter((item) => {
    const categoryMatches =
      categoryFilter === "all" || item.categoryId === categoryFilter;
    const statusMatches = statusFilter === "all" || item.status === statusFilter;
    const stationMatches =
      stationFilter === "all" || item.station === stationFilter;

    return categoryMatches && statusMatches && stationMatches;
  });

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Item setup</Badge>
          <CardTitle>{form.id ? "Edit item" : "Create item"}</CardTitle>
          <CardDescription>
            Items define base price, prep routing, and customer menu content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <FieldLabel label="Category">
              <select
                value={form.categoryId}
                onChange={(event) =>
                  onFormChange({ ...form, categoryId: event.target.value })
                }
                className={selectClassName}
                required
              >
                <option value="">Choose category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Name">
                <Input
                  value={form.name}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      name: event.target.value,
                      slug:
                        form.slug || slugifyMenuAdminValue(event.target.value)
                    })
                  }
                  placeholder="Spanish Latte"
                  required
                />
              </FieldLabel>
              <FieldLabel label="Slug">
                <Input
                  value={form.slug}
                  onChange={(event) =>
                    onFormChange({ ...form, slug: event.target.value })
                  }
                  placeholder="spanish-latte"
                  required
                />
              </FieldLabel>
            </div>
            <FieldLabel label="Description">
              <textarea
                value={form.description}
                onChange={(event) =>
                  onFormChange({ ...form, description: event.target.value })
                }
                className={textareaClassName}
                placeholder="Short menu description"
              />
            </FieldLabel>
            <FieldLabel label="Image URL">
              <Input
                value={form.imageUrl}
                onChange={(event) =>
                  onFormChange({ ...form, imageUrl: event.target.value })
                }
                placeholder="https://..."
              />
            </FieldLabel>
            <MenuImagePreview
              key={form.imageUrl.trim() || "empty-item-image-preview"}
              imageUrl={form.imageUrl}
              label={form.name || "Menu item"}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <FieldLabel label="Base price">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.basePrice}
                  onChange={(event) =>
                    onFormChange({ ...form, basePrice: event.target.value })
                  }
                  required
                />
              </FieldLabel>
              <FieldLabel label="Currency">
                <Input
                  value={form.currency}
                  onChange={(event) =>
                    onFormChange({ ...form, currency: event.target.value })
                  }
                  maxLength={3}
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
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Preparation station">
                <select
                  value={form.station}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      station: event.target.value as MenuAdminPreparationStation
                    })
                  }
                  className={selectClassName}
                >
                  {menuPreparationStations.map((station) => (
                    <option key={station} value={station}>
                      {humanizeMenuAdminValue(station)}
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
                      status: event.target.value as MenuAdminItemStatus
                    })
                  }
                  className={selectClassName}
                >
                  {menuItemStatuses.map((status) => (
                    <option key={status} value={status}>
                      {humanizeMenuAdminValue(status)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <label className="flex items-center gap-3 rounded-card border bg-surface/70 p-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) =>
                  onFormChange({ ...form, isFeatured: event.target.checked })
                }
                className="size-4 accent-primary"
              />
              Featured item
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {form.id ? "Save item" : "Create item"}
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
          <Badge variant="muted">Configured items</Badge>
          <CardTitle>Menu items</CardTitle>
          <CardDescription>
            Activate or archive item records without changing branch-specific
            availability.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 rounded-card border bg-surface/70 p-3 md:grid-cols-3">
            <FieldLabel label="Category filter">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={selectClassName}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Status filter">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={selectClassName}
              >
                <option value="all">All statuses</option>
                {menuItemStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanizeMenuAdminValue(status)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Station filter">
              <select
                value={stationFilter}
                onChange={(event) => setStationFilter(event.target.value)}
                className={selectClassName}
              >
                <option value="all">All stations</option>
                {menuPreparationStations.map((station) => (
                  <option key={station} value={station}>
                    {humanizeMenuAdminValue(station)}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          {filteredItems.map((item) => (
            <div key={item.id} className="rounded-card border bg-surface/70 p-4">
              <div className="grid gap-4 md:grid-cols-[7rem_minmax(0,1fr)]">
                <MenuImagePreview
                  key={`${item.id}-${item.imageUrl ?? "empty"}`}
                  imageUrl={item.imageUrl}
                  label={item.name}
                  compact
                />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge variant={statusVariant(item.status)}>
                        {item.status}
                      </Badge>
                      <Badge variant="muted">
                        {humanizeMenuAdminValue(item.station)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.category.name} /{" "}
                      {formatMenuMoney(item.basePriceMinor, item.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.modifierGroups.length} modifier groups /{" "}
                      {item.customerVisible
                        ? "visible to customer"
                        : "not visible to customer"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEdit(item)}
                    >
                      Edit
                    </Button>
                    {item.status === "active" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onDeactivate(item)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => onActivate(item)}>
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => onArchive(item)}
                    >
                      <Archive className="size-3.5" aria-hidden="true" />
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {items.length > 0 && filteredItems.length === 0 ? (
            <EmptyState
              title="No matching items"
              description="Adjust the filters to see more configured items."
            />
          ) : null}
          {items.length === 0 ? (
            <EmptyState
              title="No items yet"
              description="Create an item after adding at least one category."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function AvailabilitySection({
  items,
  drafts,
  isSaving,
  canManageOverrides,
  onDraftChange,
  onSave,
  onClear
}: {
  items: MenuAdminItem[];
  drafts: Record<string, AvailabilityDraft>;
  isSaving: boolean;
  canManageOverrides: boolean;
  onDraftChange: (itemId: string, draft: AvailabilityDraft) => void;
  onSave: (item: MenuAdminItem) => void;
  onClear: (item: MenuAdminItem) => void;
}) {
  return (
    <Card variant="glass">
      <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <Badge variant="muted">Branch overrides</Badge>
          <CardTitle>Availability management</CardTitle>
          <CardDescription>
            These controls decide what the selected branch can sell right now.
            {canManageOverrides
              ? " Changes are saved as branch overrides."
              : " This account can inspect availability but cannot save branch overrides."}
          </CardDescription>
        </div>
        <Badge variant={canManageOverrides ? "warning" : "muted"}>
          {canManageOverrides ? "Backend validated" : "Read only"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => {
          const draft = drafts[item.id] ?? {
            isVisible: item.isVisible,
            isAvailable: item.isAvailable,
            priceOverride: minorToMenuInput(item.branchOverride?.priceOverrideMinor),
            sortOrder: String(item.branchOverride?.sortOrder ?? item.sortOrder)
          };
          const hasOverride = item.hasBranchOverride;

          return (
            <div key={item.id} className="rounded-card border bg-surface/70 p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge variant={statusVariant(item.status)}>
                      {item.status}
                    </Badge>
                    <Badge
                      variant={item.customerVisible ? "success" : "warning"}
                    >
                      {item.customerVisible ? "Customer visible" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Base {formatMenuMoney(item.basePriceMinor, item.currency)} /
                    Effective{" "}
                    {formatMenuMoney(item.effectivePriceMinor, item.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasOverride
                      ? "Branch override exists"
                      : "No branch override yet"}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
                  <label className="flex min-h-11 items-center gap-3 rounded-button border bg-surface px-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.isVisible}
                      disabled={!canManageOverrides}
                      onChange={(event) =>
                        onDraftChange(item.id, {
                          ...draft,
                          isVisible: event.target.checked
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    Visible
                  </label>
                  <label className="flex min-h-11 items-center gap-3 rounded-button border bg-surface px-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.isAvailable}
                      disabled={!canManageOverrides}
                      onChange={(event) =>
                        onDraftChange(item.id, {
                          ...draft,
                          isAvailable: event.target.checked
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    Available
                  </label>
                  <FieldLabel label="Price override">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.priceOverride}
                      disabled={!canManageOverrides}
                      onChange={(event) =>
                        onDraftChange(item.id, {
                          ...draft,
                          priceOverride: event.target.value
                        })
                      }
                      placeholder="Use base"
                    />
                  </FieldLabel>
                  <FieldLabel label="Sort order">
                    <Input
                      type="number"
                      value={draft.sortOrder}
                      disabled={!canManageOverrides}
                      onChange={(event) =>
                        onDraftChange(item.id, {
                          ...draft,
                          sortOrder: event.target.value
                        })
                      }
                    />
                  </FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => onSave(item)}
                      disabled={isSaving || !canManageOverrides}
                    >
                      <Save className="size-3.5" aria-hidden="true" />
                      Save
                    </Button>
                    {hasOverride ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onClear(item)}
                        disabled={isSaving || !canManageOverrides}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 ? (
          <EmptyState
            title="No items to manage"
            description="Create menu items before managing branch availability."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ModifierSection({
  items,
  groups,
  selectedGroup,
  groupForm,
  optionForm,
  linkForm,
  isSaving,
  onSelectGroup,
  onGroupFormChange,
  onOptionFormChange,
  onLinkFormChange,
  onSubmitGroup,
  onResetGroup,
  onSubmitOption,
  onResetOption,
  onEditGroup,
  onEditOption,
  onToggleGroup,
  onToggleOption,
  onSubmitLink,
  onDetachLink
}: {
  items: MenuAdminItem[];
  groups: MenuAdminModifierGroup[];
  selectedGroup?: MenuAdminModifierGroup;
  groupForm: ModifierGroupFormState;
  optionForm: ModifierOptionFormState;
  linkForm: LinkFormState;
  isSaving: boolean;
  onSelectGroup: (groupId: string) => void;
  onGroupFormChange: (form: ModifierGroupFormState) => void;
  onOptionFormChange: (form: ModifierOptionFormState) => void;
  onLinkFormChange: (form: LinkFormState) => void;
  onSubmitGroup: (event: FormEvent<HTMLFormElement>) => void;
  onResetGroup: () => void;
  onSubmitOption: (event: FormEvent<HTMLFormElement>) => void;
  onResetOption: () => void;
  onEditGroup: (group: MenuAdminModifierGroup) => void;
  onEditOption: (option: MenuAdminModifierOption) => void;
  onToggleGroup: (group: MenuAdminModifierGroup) => void;
  onToggleOption: (option: MenuAdminModifierOption) => void;
  onSubmitLink: (event: FormEvent<HTMLFormElement>) => void;
  onDetachLink: (itemId: string, linkId: string) => void;
}) {
  const attachedLinks = items.flatMap((item) =>
    item.modifierGroups.map((link) => ({
      item,
      link
    }))
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Reusable groups</Badge>
          <CardTitle>
            {groupForm.id ? "Edit modifier group" : "Create modifier group"}
          </CardTitle>
          <CardDescription>
            Required groups and selection limits are enforced by backend cart
            validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmitGroup}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Name">
                <Input
                  value={groupForm.name}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      name: event.target.value,
                      slug:
                        groupForm.slug ||
                        slugifyMenuAdminValue(event.target.value)
                    })
                  }
                  required
                />
              </FieldLabel>
              <FieldLabel label="Slug">
                <Input
                  value={groupForm.slug}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      slug: event.target.value
                    })
                  }
                  required
                />
              </FieldLabel>
            </div>
            <FieldLabel label="Description">
              <textarea
                value={groupForm.description}
                onChange={(event) =>
                  onGroupFormChange({
                    ...groupForm,
                    description: event.target.value
                  })
                }
                className={textareaClassName}
              />
            </FieldLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Selection type">
                <select
                  value={groupForm.selectionType}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      selectionType: event.target.value as MenuAdminSelectionType
                    })
                  }
                  className={selectClassName}
                >
                  {modifierSelectionTypes.map((type) => (
                    <option key={type} value={type}>
                      {humanizeMenuAdminValue(type)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Status">
                <select
                  value={groupForm.status}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      status: event.target.value as MenuAdminModifierStatus
                    })
                  }
                  className={selectClassName}
                >
                  {modifierStatuses.map((status) => (
                    <option key={status} value={status}>
                      {humanizeMenuAdminValue(status)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FieldLabel label="Min">
                <Input
                  type="number"
                  min="0"
                  value={groupForm.minSelections}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      minSelections: event.target.value
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="Max">
                <Input
                  type="number"
                  min="0"
                  value={groupForm.maxSelections}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      maxSelections: event.target.value
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="Sort order">
                <Input
                  type="number"
                  value={groupForm.sortOrder}
                  onChange={(event) =>
                    onGroupFormChange({
                      ...groupForm,
                      sortOrder: event.target.value
                    })
                  }
                />
              </FieldLabel>
            </div>
            <label className="flex items-center gap-3 rounded-card border bg-surface/70 p-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={groupForm.isRequired}
                onChange={(event) =>
                  onGroupFormChange({
                    ...groupForm,
                    isRequired: event.target.checked
                  })
                }
                className="size-4 accent-primary"
              />
              Required group
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                <Save className="size-4" aria-hidden="true" />
                {groupForm.id ? "Save group" : "Create group"}
              </Button>
              {groupForm.id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onResetGroup}
                >
                  Reset
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card variant="glass">
          <CardHeader>
            <Badge variant="muted">Modifier library</Badge>
            <CardTitle>Groups and options</CardTitle>
            <CardDescription>
              Select a group to manage options and attach it to menu items.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-card border bg-surface/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{group.name}</h3>
                      <Badge variant={statusVariant(group.status)}>
                        {group.status}
                      </Badge>
                      {group.isRequired ? (
                        <Badge variant="warning">Required</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.selectionType} / {group.options.length} options /{" "}
                      {group.itemCount ?? 0} items
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEditGroup(group)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={group.status === "active" ? "secondary" : "primary"}
                      onClick={() => onToggleGroup(group)}
                    >
                      {group.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {groups.length === 0 ? (
              <EmptyState
                title="No modifier groups"
                description="Create reusable groups for sizes, milk, add-ons, or cooking preferences."
              />
            ) : null}
          </CardContent>
        </Card>

        <Card variant="quiet">
          <CardHeader>
            <Badge variant="muted">Options</Badge>
            <CardTitle>
              {selectedGroup ? selectedGroup.name : "Select a group"}
            </CardTitle>
            <CardDescription>
              Options add validated selections and price deltas to cart items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedGroup ? (
              <div className="grid gap-4">
                <form className="grid gap-4" onSubmit={onSubmitOption}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldLabel label="Option name">
                      <Input
                        value={optionForm.name}
                        onChange={(event) =>
                          onOptionFormChange({
                            ...optionForm,
                            name: event.target.value,
                            slug:
                              optionForm.slug ||
                              slugifyMenuAdminValue(event.target.value)
                          })
                        }
                        required
                      />
                    </FieldLabel>
                    <FieldLabel label="Option slug">
                      <Input
                        value={optionForm.slug}
                        onChange={(event) =>
                          onOptionFormChange({
                            ...optionForm,
                            slug: event.target.value
                          })
                        }
                        required
                      />
                    </FieldLabel>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldLabel label="Price delta">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={optionForm.priceDelta}
                        onChange={(event) =>
                          onOptionFormChange({
                            ...optionForm,
                            priceDelta: event.target.value
                          })
                        }
                      />
                    </FieldLabel>
                    <FieldLabel label="Sort order">
                      <Input
                        type="number"
                        value={optionForm.sortOrder}
                        onChange={(event) =>
                          onOptionFormChange({
                            ...optionForm,
                            sortOrder: event.target.value
                          })
                        }
                      />
                    </FieldLabel>
                    <FieldLabel label="Status">
                      <select
                        value={optionForm.status}
                        onChange={(event) =>
                          onOptionFormChange({
                            ...optionForm,
                            status:
                              event.target.value as MenuAdminModifierStatus
                          })
                        }
                        className={selectClassName}
                      >
                        {modifierStatuses.map((status) => (
                          <option key={status} value={status}>
                            {humanizeMenuAdminValue(status)}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={isSaving}>
                      <Save className="size-4" aria-hidden="true" />
                      {optionForm.id ? "Save option" : "Create option"}
                    </Button>
                    {optionForm.id ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onResetOption}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>
                </form>

                <div className="grid gap-2">
                  {selectedGroup.options.map((option) => (
                    <div
                      key={option.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{option.name}</p>
                          <Badge variant={statusVariant(option.status)}>
                            {option.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatMenuMoney(option.priceDeltaMinor)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onEditOption(option)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            option.status === "active"
                              ? "secondary"
                              : "primary"
                          }
                          onClick={() => onToggleOption(option)}
                        >
                          {option.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {selectedGroup.options.length === 0 ? (
                    <p className="rounded-card border bg-surface/70 p-3 text-sm text-muted-foreground">
                      This group has no options yet.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Select a modifier group"
                description="Create or select a group before managing its options."
              />
            )}
          </CardContent>
        </Card>

        <Card variant="accent">
          <CardHeader>
            <Badge variant="muted">Item links</Badge>
            <CardTitle>Attach modifiers to items</CardTitle>
            <CardDescription>
              Links decide which modifier groups the customer must review before
              checkout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_0.5fr_auto]" onSubmit={onSubmitLink}>
              <FieldLabel label="Item">
                <select
                  value={linkForm.itemId}
                  onChange={(event) =>
                    onLinkFormChange({ ...linkForm, itemId: event.target.value })
                  }
                  className={selectClassName}
                  required
                >
                  <option value="">Choose item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Group">
                <select
                  value={linkForm.modifierGroupId}
                  onChange={(event) =>
                    onLinkFormChange({
                      ...linkForm,
                      modifierGroupId: event.target.value
                    })
                  }
                  className={selectClassName}
                  required
                >
                  <option value="">Choose group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Sort">
                <Input
                  type="number"
                  value={linkForm.sortOrder}
                  onChange={(event) =>
                    onLinkFormChange({
                      ...linkForm,
                      sortOrder: event.target.value
                    })
                  }
                />
              </FieldLabel>
              <Button type="submit" className="self-end" disabled={isSaving}>
                <LinkIcon className="size-4" aria-hidden="true" />
                Attach
              </Button>
            </form>
          </CardContent>
          <CardFooter className="grid gap-2">
            {attachedLinks.map(({ item, link }) => (
              <div
                key={link.id}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3"
              >
                <p className="text-sm">
                  <span className="font-semibold">{item.name}</span>{" "}
                  <span className="text-muted-foreground">
                    uses {link.modifierGroup.name}
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onDetachLink(item.id, link.id)}
                  disabled={isSaving}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Detach
                </Button>
              </div>
            ))}
            {attachedLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No modifier groups are attached to items yet.
              </p>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

function PreviewIssuesSection({
  overview,
  visibleItems
}: {
  overview: MenuAdminOverviewResult;
  visibleItems: MenuAdminItem[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card variant="glass">
        <CardHeader>
          <Badge variant="muted">Customer menu preview</Badge>
          <CardTitle>Visible branch menu</CardTitle>
          <CardDescription>
            This mirrors the active, visible, available items the customer menu
            can use.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {overview.categories.map((category) => {
            const categoryVisibleItems = category.items.filter(
              (item) => item.customerVisible
            );

            if (categoryVisibleItems.length === 0) {
              return null;
            }

            return (
              <div key={category.id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{category.name}</h3>
                  <Badge variant="success">
                    {categoryVisibleItems.length} visible
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {categoryVisibleItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3"
                    >
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {humanizeMenuAdminValue(item.station)}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatMenuMoney(item.effectivePriceMinor, item.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {visibleItems.length === 0 ? (
            <EmptyState
              title="No visible items"
              description="Make at least one active item visible and available for this branch."
            />
          ) : null}
        </CardContent>
      </Card>

      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Validation</Badge>
          <CardTitle>Preview issues</CardTitle>
          <CardDescription>
            Warnings identify setup gaps before they affect customers, cart
            validation, kitchen routing, or AI suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.setupIssues.map((issue) => (
            <div
              key={`${issue.code}-${issue.itemId ?? issue.categoryId ?? issue.modifierGroupId ?? issue.scope}`}
              className="rounded-card border bg-surface/70 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={issue.severity === "error" ? "danger" : "warning"}
                >
                  {issue.severity}
                </Badge>
                <Badge variant="muted">{humanizeMenuAdminValue(issue.scope)}</Badge>
              </div>
              <p className="mt-2 text-sm text-foreground">{issue.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{issue.code}</p>
            </div>
          ))}
          {overview.setupIssues.length === 0 ? (
            <div className="flex items-start gap-3 rounded-card border border-success/40 bg-success/10 p-4">
              <CheckCircle2
                className="mt-0.5 size-4 text-success"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">No setup issues</p>
                <p className="text-sm text-muted-foreground">
                  The branch menu is ready for customer ordering.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function MenuAdminContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const [activeTab, setActiveTab] = useState<MenuAdminTab>("overview");
  const [categoryForm, setCategoryForm] =
    useState<CategoryFormState>(emptyCategoryForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [modifierGroupForm, setModifierGroupForm] =
    useState<ModifierGroupFormState>(emptyModifierGroupForm);
  const [modifierOptionForm, setModifierOptionForm] =
    useState<ModifierOptionFormState>(emptyModifierOptionForm);
  const [selectedModifierGroupId, setSelectedModifierGroupId] = useState("");
  const [availabilityDrafts, setAvailabilityDrafts] = useState<
    Record<string, AvailabilityDraft>
  >({});
  const [linkForm, setLinkForm] = useState<LinkFormState>(emptyLinkForm);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const selectedBranch = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  )?.branch;
  const overviewQuery = useQuery({
    queryKey: staffQueryKeys.staffMenuAdminOverview(selectedBranchId),
    queryFn: () => getBranchMenuAdminOverview(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const overview = overviewQuery.data;
  const allItems = useMemo(
    () => overview?.categories.flatMap((category) => category.items) ?? [],
    [overview]
  );
  const visibleItems = useMemo(
    () => allItems.filter((item) => item.customerVisible),
    [allItems]
  );
  const selectedModifierGroup = overview?.modifierGroups.find(
    (group) => group.id === selectedModifierGroupId
  ) ?? overview?.modifierGroups[0];
  const menuAccess = getMenuAdminAccessMode({
    access: effectiveAccess,
    companyId: overview?.company.id,
    branchId: selectedBranchId
  });
  const visibleTabs = useMemo(
    () => getVisibleMenuAdminTabs(menuAccess.canManageFullMenu),
    [menuAccess.canManageFullMenu]
  );
  const activeVisibleTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id ?? "overview";

  function refreshMenuAdmin(message?: string) {
    if (!selectedBranchId) {
      return;
    }

    if (message) {
      setSuccessMessage(message);
    }

    setAvailabilityDrafts({});
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffMenuAdminOverview(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerMenu(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: customerQueryKeys.menu(selectedBranchId)
    });
  }

  function requireMenuAdminScope() {
    if (!overview || !accessToken) {
      throw new Error("Menu admin context is not ready.");
    }

    if (!menuAccess.canManageFullMenu) {
      throw new Error(
        "Full menu management requires company-level menu permissions."
      );
    }

    return {
      companyId: overview.company.id,
      token: accessToken
    };
  }

  const createCategoryMutation = useMutation({
    mutationFn: (payload: CreateMenuCategoryPayload) => {
      const { companyId, token } = requireMenuAdminScope();

      return createMenuCategory(companyId, payload, token);
    },
    onSuccess: () => {
      setCategoryForm(emptyCategoryForm);
      refreshMenuAdmin("Category created.");
    }
  });
  const updateCategoryMutation = useMutation({
    mutationFn: ({
      categoryId,
      payload
    }: {
      categoryId: string;
      payload: UpdateMenuCategoryPayload;
    }) => updateMenuCategory(categoryId, payload, accessToken),
    onSuccess: () => {
      setCategoryForm(emptyCategoryForm);
      refreshMenuAdmin("Category saved.");
    }
  });
  const toggleCategoryMutation = useMutation({
    mutationFn: (category: MenuAdminCategory) =>
      category.status === "active"
        ? deactivateMenuCategory(category.id, accessToken)
        : activateMenuCategory(category.id, accessToken),
    onSuccess: (_result, category) =>
      refreshMenuAdmin(
        category.status === "active"
          ? "Category deactivated."
          : "Category activated."
      )
  });
  const createItemMutation = useMutation({
    mutationFn: (payload: CreateMenuItemPayload) => {
      const { companyId, token } = requireMenuAdminScope();

      return createMenuItem(companyId, payload, token);
    },
    onSuccess: () => {
      setItemForm({
        ...emptyItemForm,
        categoryId: overview?.categories[0]?.id ?? ""
      });
      refreshMenuAdmin("Item created.");
    }
  });
  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      payload
    }: {
      itemId: string;
      payload: UpdateMenuItemPayload;
    }) => updateMenuItem(itemId, payload, accessToken),
    onSuccess: () => {
      setItemForm({
        ...emptyItemForm,
        categoryId: overview?.categories[0]?.id ?? ""
      });
      refreshMenuAdmin("Item saved.");
    }
  });
  const activateItemMutation = useMutation({
    mutationFn: (item: MenuAdminItem) => activateMenuItem(item.id, accessToken),
    onSuccess: () => refreshMenuAdmin("Item activated.")
  });
  const deactivateItemMutation = useMutation({
    mutationFn: (item: MenuAdminItem) => deactivateMenuItem(item.id, accessToken),
    onSuccess: () => refreshMenuAdmin("Item deactivated.")
  });
  const archiveItemMutation = useMutation({
    mutationFn: (item: MenuAdminItem) => archiveMenuItem(item.id, accessToken),
    onSuccess: () => refreshMenuAdmin("Item archived.")
  });
  const upsertOverrideMutation = useMutation({
    mutationFn: ({
      itemId,
      payload
    }: {
      itemId: string;
      payload: UpsertBranchMenuItemOverridePayload;
    }) => {
      if (!selectedBranchId) {
        throw new Error("Select a branch before saving availability.");
      }

      return upsertBranchMenuItemOverride(
        selectedBranchId,
        itemId,
        payload,
        accessToken
      );
    },
    onSuccess: () => refreshMenuAdmin("Branch override saved.")
  });
  const deleteOverrideMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!selectedBranchId) {
        throw new Error("Select a branch before clearing availability.");
      }

      return deleteBranchMenuItemOverride(selectedBranchId, itemId, accessToken);
    },
    onSuccess: () => refreshMenuAdmin("Branch override cleared.")
  });
  const createModifierGroupMutation = useMutation({
    mutationFn: (payload: CreateModifierGroupPayload) => {
      const { companyId, token } = requireMenuAdminScope();

      return createModifierGroup(companyId, payload, token);
    },
    onSuccess: (result) => {
      setSelectedModifierGroupId(result.modifierGroup.id);
      setLinkForm((current) => ({
        ...current,
        modifierGroupId: result.modifierGroup.id
      }));
      setModifierGroupForm(emptyModifierGroupForm);
      refreshMenuAdmin("Modifier group created.");
    }
  });
  const updateModifierGroupMutation = useMutation({
    mutationFn: ({
      groupId,
      payload
    }: {
      groupId: string;
      payload: UpdateModifierGroupPayload;
    }) => updateModifierGroup(groupId, payload, accessToken),
    onSuccess: () => {
      setModifierGroupForm(emptyModifierGroupForm);
      refreshMenuAdmin("Modifier group saved.");
    }
  });
  const toggleModifierGroupMutation = useMutation({
    mutationFn: (group: MenuAdminModifierGroup) =>
      group.status === "active"
        ? deactivateModifierGroup(group.id, accessToken)
        : activateModifierGroup(group.id, accessToken),
    onSuccess: (_result, group) =>
      refreshMenuAdmin(
        group.status === "active"
          ? "Modifier group deactivated."
          : "Modifier group activated."
      )
  });
  const createModifierOptionMutation = useMutation({
    mutationFn: ({
      groupId,
      payload
    }: {
      groupId: string;
      payload: CreateModifierOptionPayload;
    }) => createModifierOption(groupId, payload, accessToken),
    onSuccess: () => {
      setModifierOptionForm(emptyModifierOptionForm);
      refreshMenuAdmin("Modifier option created.");
    }
  });
  const updateModifierOptionMutation = useMutation({
    mutationFn: ({
      optionId,
      payload
    }: {
      optionId: string;
      payload: UpdateModifierOptionPayload;
    }) => updateModifierOption(optionId, payload, accessToken),
    onSuccess: () => {
      setModifierOptionForm(emptyModifierOptionForm);
      refreshMenuAdmin("Modifier option saved.");
    }
  });
  const toggleModifierOptionMutation = useMutation({
    mutationFn: (option: MenuAdminModifierOption) =>
      option.status === "active"
        ? deactivateModifierOption(option.id, accessToken)
        : activateModifierOption(option.id, accessToken),
    onSuccess: (_result, option) =>
      refreshMenuAdmin(
        option.status === "active"
          ? "Modifier option deactivated."
          : "Modifier option activated."
      )
  });
  const createItemModifierGroupMutation = useMutation({
    mutationFn: ({
      itemId,
      payload
    }: {
      itemId: string;
      payload: CreateMenuItemModifierGroupPayload;
    }) => createMenuItemModifierGroup(itemId, payload, accessToken),
    onSuccess: () => {
      setLinkForm((current) => ({
        ...current,
        sortOrder: "0"
      }));
      refreshMenuAdmin("Modifier group attached to item.");
    }
  });
  const deleteItemModifierGroupMutation = useMutation({
    mutationFn: ({ itemId, linkId }: { itemId: string; linkId: string }) =>
      deleteMenuItemModifierGroup(itemId, linkId, accessToken),
    onSuccess: () => refreshMenuAdmin("Modifier group detached from item.")
  });

  const isMutating =
    createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    toggleCategoryMutation.isPending ||
    createItemMutation.isPending ||
    updateItemMutation.isPending ||
    activateItemMutation.isPending ||
    deactivateItemMutation.isPending ||
    archiveItemMutation.isPending ||
    upsertOverrideMutation.isPending ||
    deleteOverrideMutation.isPending ||
    createModifierGroupMutation.isPending ||
    updateModifierGroupMutation.isPending ||
    toggleModifierGroupMutation.isPending ||
    createModifierOptionMutation.isPending ||
    updateModifierOptionMutation.isPending ||
    toggleModifierOptionMutation.isPending ||
    createItemModifierGroupMutation.isPending ||
    deleteItemModifierGroupMutation.isPending;
  const mutationError =
    createCategoryMutation.error ??
    updateCategoryMutation.error ??
    toggleCategoryMutation.error ??
    createItemMutation.error ??
    updateItemMutation.error ??
    activateItemMutation.error ??
    deactivateItemMutation.error ??
    archiveItemMutation.error ??
    upsertOverrideMutation.error ??
    deleteOverrideMutation.error ??
    createModifierGroupMutation.error ??
    updateModifierGroupMutation.error ??
    toggleModifierGroupMutation.error ??
    createModifierOptionMutation.error ??
    updateModifierOptionMutation.error ??
    toggleModifierOptionMutation.error ??
    createItemModifierGroupMutation.error ??
    deleteItemModifierGroupMutation.error;

  function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildCategoryPayload(categoryForm);

    if (categoryForm.id) {
      updateCategoryMutation.mutate({
        categoryId: categoryForm.id,
        payload
      });
      return;
    }

    createCategoryMutation.mutate(payload);
  }

  function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildItemPayload(itemForm);

    if (itemForm.id) {
      updateItemMutation.mutate({
        itemId: itemForm.id,
        payload
      });
      return;
    }

    createItemMutation.mutate(payload);
  }

  function handleOverrideSave(item: MenuAdminItem) {
    if (!menuAccess.canManageBranchOverrides) {
      return;
    }

    const draft = availabilityDrafts[item.id];

    if (!draft) {
      return;
    }

    upsertOverrideMutation.mutate({
      itemId: item.id,
      payload: {
        isAvailable: draft.isAvailable,
        isVisible: draft.isVisible,
        priceOverrideMinor: optionalMenuInputToMinor(draft.priceOverride),
        sortOrder: menuInputToInteger(draft.sortOrder, item.sortOrder)
      }
    });
  }

  function handleModifierGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildModifierGroupPayload(modifierGroupForm);

    if (modifierGroupForm.id) {
      updateModifierGroupMutation.mutate({
        groupId: modifierGroupForm.id,
        payload
      });
      return;
    }

    createModifierGroupMutation.mutate(payload);
  }

  function handleModifierOptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const groupId = selectedModifierGroup?.id;

    if (!groupId) {
      return;
    }

    const payload = buildModifierOptionPayload(modifierOptionForm);

    if (modifierOptionForm.id) {
      updateModifierOptionMutation.mutate({
        optionId: modifierOptionForm.id,
        payload
      });
      return;
    }

    createModifierOptionMutation.mutate({
      groupId,
      payload
    });
  }

  function handleLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!linkForm.itemId || !linkForm.modifierGroupId) {
      return;
    }

    createItemModifierGroupMutation.mutate({
      itemId: linkForm.itemId,
      payload: {
        modifierGroupId: linkForm.modifierGroupId,
        sortOrder: menuInputToInteger(linkForm.sortOrder)
      }
    });
  }

  if (!accessToken) {
    return null;
  }

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="Select a branch"
        description="Menu Admin is branch-scoped so customer availability stays precise."
        action={
          <StaffBranchSelector
            access={effectiveAccess}
            selectedBranchId={selectedBranchId}
            onChange={setSelectedBranchId}
            className="min-w-64"
          />
        }
      />
    );
  }

  if (overviewQuery.isPending) {
    return <LoadingState label="Loading branch menu admin" />;
  }

  if (overviewQuery.isError) {
    return (
      <EmptyState
        title="Menu admin could not load"
        description={getMenuAdminErrorMessage(overviewQuery.error)}
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
        title="Menu admin is unavailable"
        description="The branch overview did not return data."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <Card variant="accent">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <Badge variant="muted">Branch menu control</Badge>
            <CardTitle>{overview.branch.name}</CardTitle>
            <CardDescription>
              {menuAccess.canManageFullMenu
                ? "Manage customer-visible menu data, availability, item routing, and modifier readiness for this branch."
                : "Manage branch availability from company-defined menu data for this branch."}
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

      {!menuAccess.canManageFullMenu ? (
        <Card variant="quiet">
          <CardHeader>
            <Badge variant="warning">Branch Availability mode</Badge>
            <CardTitle>
              Company menu setup is restricted to company-level staff
            </CardTitle>
            <CardDescription>
              This account can open the branch menu surface because it has
              branch menu access. Category, item, modifier, and modifier-link
              creation remain available only to company-level owner,
              branch_manager, or menu_admin memberships.{" "}
              {menuAccess.canManageBranchOverrides
                ? "You can still manage branch availability, visibility, and price overrides here."
                : "This branch view is read-only because menu branch override permission is not granted."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <MenuAdminMetrics overview={overview} />
      <MutationMessage error={mutationError} />
      {mutationError ? null : <SuccessMessage message={successMessage} />}

      <div className="flex flex-wrap gap-2 rounded-card border bg-surface/70 p-2">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeVisibleTab === tab.id ? "primary" : "ghost"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.id === "overview" ? (
              <LayoutDashboard className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "categories" ? (
              <Tags className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "items" ? (
              <BookOpenText className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "availability" ? (
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "modifiers" ? (
              <Settings2 className="size-4" aria-hidden="true" />
            ) : null}
            {tab.id === "preview" ? (
              <AlertTriangle className="size-4" aria-hidden="true" />
            ) : null}
            {tab.label}
          </Button>
        ))}
      </div>

      {activeVisibleTab === "overview" ? (
        <OverviewSection overview={overview} />
      ) : null}

      {activeVisibleTab === "categories" ? (
        <CategorySection
          categories={overview.categories}
          form={categoryForm}
          isSaving={isMutating}
          onFormChange={setCategoryForm}
          onSubmit={handleCategorySubmit}
          onEdit={setCategoryFormFromCategory}
          onReset={() => setCategoryForm(emptyCategoryForm)}
          onToggleStatus={(category) => toggleCategoryMutation.mutate(category)}
        />
      ) : null}

      {activeVisibleTab === "items" ? (
        <ItemSection
          categories={overview.categories}
          items={allItems}
          form={itemForm}
          isSaving={isMutating}
          onFormChange={setItemForm}
          onSubmit={handleItemSubmit}
          onEdit={setItemFormFromItem}
          onReset={() =>
            setItemForm({
              ...emptyItemForm,
              categoryId: overview.categories[0]?.id ?? ""
            })
          }
          onActivate={(item) => activateItemMutation.mutate(item)}
          onDeactivate={(item) => deactivateItemMutation.mutate(item)}
          onArchive={(item) => archiveItemMutation.mutate(item)}
        />
      ) : null}

      {activeVisibleTab === "availability" ? (
        <AvailabilitySection
          items={allItems}
          drafts={availabilityDrafts}
          isSaving={isMutating}
          canManageOverrides={menuAccess.canManageBranchOverrides}
          onDraftChange={(itemId, draft) =>
            setAvailabilityDrafts((current) => ({
              ...current,
              [itemId]: draft
            }))
          }
          onSave={handleOverrideSave}
          onClear={(item) => {
            if (menuAccess.canManageBranchOverrides) {
              deleteOverrideMutation.mutate(item.id);
            }
          }}
        />
      ) : null}

      {activeVisibleTab === "modifiers" ? (
        <ModifierSection
          items={allItems}
          groups={overview.modifierGroups}
          selectedGroup={selectedModifierGroup}
          groupForm={modifierGroupForm}
          optionForm={modifierOptionForm}
          linkForm={linkForm}
          isSaving={isMutating}
          onSelectGroup={(groupId) => {
            setSelectedModifierGroupId(groupId);
            setLinkForm((current) => ({
              ...current,
              modifierGroupId: groupId
            }));
            setModifierOptionForm(emptyModifierOptionForm);
          }}
          onGroupFormChange={setModifierGroupForm}
          onOptionFormChange={setModifierOptionForm}
          onLinkFormChange={setLinkForm}
          onSubmitGroup={handleModifierGroupSubmit}
          onResetGroup={() => setModifierGroupForm(emptyModifierGroupForm)}
          onSubmitOption={handleModifierOptionSubmit}
          onResetOption={() => setModifierOptionForm(emptyModifierOptionForm)}
          onEditGroup={(group) => {
            setSelectedModifierGroupId(group.id);
            setModifierGroupForm(toModifierGroupForm(group));
          }}
          onEditOption={(option) => setModifierOptionForm(toModifierOptionForm(option))}
          onToggleGroup={(group) => toggleModifierGroupMutation.mutate(group)}
          onToggleOption={(option) => toggleModifierOptionMutation.mutate(option)}
          onSubmitLink={handleLinkSubmit}
          onDetachLink={(itemId, linkId) =>
            deleteItemModifierGroupMutation.mutate({ itemId, linkId })
          }
        />
      ) : null}

      {activeVisibleTab === "preview" ? (
        <PreviewIssuesSection overview={overview} visibleItems={visibleItems} />
      ) : null}
    </div>
  );

  function setCategoryFormFromCategory(category: MenuAdminCategory) {
    setCategoryForm(toCategoryForm(category));
  }

  function setItemFormFromItem(item: MenuAdminItem) {
    setItemForm(toItemForm(item));
  }
}

export function MenuAdminPage() {
  return (
    <StaffPageShell
      title="Menu Admin Control Center"
      description="Branch-scoped menu management for categories, items, availability, modifiers, and customer readiness."
      actions={<MenuAdminActions />}
    >
      <StaffAuthGate requiredPermissions={["menu.read"]} branchScoped>
        <MenuAdminContent />
      </StaffAuthGate>
    </StaffPageShell>
  );
}
