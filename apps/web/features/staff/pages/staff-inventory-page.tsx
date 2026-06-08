"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Gauge,
  History,
  Loader2,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Utensils
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import {
  getInventoryErrorMessage,
  humanizeInventoryValue,
  inventoryInputToQuantity,
  inventoryItemStatuses,
  inventoryStatusBadgeVariant,
  inventoryUnits,
  manualInventoryMovementTypes,
  optionalInventoryInputToQuantity,
  quantityToInput
} from "@/features/staff/inventory-data";
import {
  adjustBranchInventoryLevel,
  createInventoryItem,
  getBranchInventoryAlerts,
  getBranchInventoryLevels,
  getBranchInventoryMenuAvailability,
  getBranchMenuAdminOverview,
  getInventoryItems,
  getMenuItemInventoryRequirements,
  updateInventoryItem,
  updateMenuItemInventoryRequirements
} from "@/lib/api/endpoints";
import { customerQueryKeys, staffQueryKeys } from "@/lib/api/query-keys";
import type {
  AdjustInventoryLevelPayload,
  CreateInventoryItemPayload,
  InventoryItem,
  InventoryItemStatus,
  InventoryLevel,
  InventoryMenuAvailabilityItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryStockStatus,
  InventoryUnit,
  MenuAdminItem,
  MenuItemInventoryRequirement,
  ReplaceMenuItemInventoryRequirementsPayload,
  UpdateInventoryItemPayload
} from "@/lib/api/types";
import { getInventoryAccessMode } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

type ItemFormState = {
  id: string | null;
  name: string;
  sku: string;
  unit: InventoryUnit;
  status: InventoryItemStatus;
  lowStockThresholdQuantity: string;
  parLevelQuantity: string;
};

type AdjustmentFormState = {
  inventoryItemId: string;
  type: Extract<
    InventoryMovementType,
    "opening_balance" | "stock_in" | "stock_out" | "correction" | "waste"
  >;
  quantity: string;
  finalQuantity: string;
  note: string;
};

type RequirementFormState = {
  inventoryItemId: string;
  quantityRequired: string;
  isRequired: boolean;
};

type InventoryTab =
  | "overview"
  | "items"
  | "levels"
  | "alerts"
  | "adjustments"
  | "requirements"
  | "availability"
  | "movements";

const inventoryTabs: Array<{ id: InventoryTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "items", label: "Items" },
  { id: "levels", label: "Stock levels" },
  { id: "alerts", label: "Alerts" },
  { id: "adjustments", label: "Adjustments" },
  { id: "requirements", label: "Requirements" },
  { id: "availability", label: "Menu availability" },
  { id: "movements", label: "Recent movements" }
];

const riskyAdjustmentTypes = new Set<AdjustmentFormState["type"]>([
  "stock_out",
  "waste",
  "correction"
]);

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35";

const textareaClassName =
  "min-h-24 w-full rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35";

const emptyItemForm: ItemFormState = {
  id: null,
  name: "",
  sku: "",
  unit: "milliliter",
  status: "active",
  lowStockThresholdQuantity: "",
  parLevelQuantity: ""
};

const emptyAdjustmentForm: AdjustmentFormState = {
  inventoryItemId: "",
  type: "opening_balance",
  quantity: "",
  finalQuantity: "",
  note: ""
};

const emptyRequirementForm: RequirementFormState = {
  inventoryItemId: "",
  quantityRequired: "",
  isRequired: true
};

const emptyInventoryItems: InventoryItem[] = [];
const emptyInventoryLevels: InventoryLevel[] = [];
const emptyInventoryMovements: InventoryMovement[] = [];
const emptyMenuAvailabilityItems: InventoryMenuAvailabilityItem[] = [];

function getAllMenuItems(items: MenuAdminItem[] = []) {
  return items
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
}

function toCreatePayload(form: ItemFormState): CreateInventoryItemPayload {
  return {
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    unit: form.unit,
    lowStockThresholdQuantity: optionalInventoryInputToQuantity(
      form.lowStockThresholdQuantity,
      "Low stock threshold"
    ),
    parLevelQuantity: optionalInventoryInputToQuantity(
      form.parLevelQuantity,
      "Par level"
    )
  };
}

function toUpdatePayload(form: ItemFormState): UpdateInventoryItemPayload {
  return {
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    status: form.status,
    lowStockThresholdQuantity: optionalInventoryInputToQuantity(
      form.lowStockThresholdQuantity,
      "Low stock threshold"
    ),
    parLevelQuantity: optionalInventoryInputToQuantity(
      form.parLevelQuantity,
      "Par level"
    )
  };
}

function toItemForm(item: InventoryItem): ItemFormState {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku ?? "",
    unit: item.unit,
    status: item.status,
    lowStockThresholdQuantity: quantityToInput(item.lowStockThresholdQuantity),
    parLevelQuantity: quantityToInput(item.parLevelQuantity)
  };
}

function toAdjustmentPayload(
  form: AdjustmentFormState
): AdjustInventoryLevelPayload {
  if (form.type === "correction") {
    return {
      type: form.type,
      finalQuantity: inventoryInputToQuantity(
        form.finalQuantity,
        "Final quantity"
      ),
      note: form.note.trim() || null
    };
  }

  return {
    type: form.type,
    quantity: inventoryInputToQuantity(form.quantity, "Quantity"),
    note: form.note.trim() || null
  };
}

function getThreshold(level: InventoryLevel) {
  return (
    level.lowStockThresholdQuantity ?? level.item.lowStockThresholdQuantity ?? null
  );
}

function getParLevel(level: InventoryLevel) {
  return level.item.parLevelQuantity ?? null;
}

function itemUnitLabel(item?: InventoryItem) {
  return item ? humanizeInventoryValue(item.unit) : "Unit";
}

function quantityWithUnit(quantity: number | null | undefined, unit: InventoryUnit) {
  return `${quantity ?? 0} ${humanizeInventoryValue(unit)}`;
}

function stockStatusRank(status: InventoryStockStatus) {
  if (status === "out_of_stock") {
    return 0;
  }

  if (status === "low_stock") {
    return 1;
  }

  return 2;
}

function restockSuggestion(level: InventoryLevel) {
  const parLevel = getParLevel(level);

  if (parLevel === null || parLevel === undefined) {
    return null;
  }

  const quantityNeeded = parLevel - level.quantityOnHand;

  return quantityNeeded > 0 ? quantityNeeded : null;
}

function movementDeltaLabel(movement: InventoryMovement) {
  return `${movement.quantityDelta > 0 ? "+" : ""}${movement.quantityDelta}`;
}

function movementVariant(
  type: InventoryMovementType
): "success" | "warning" | "danger" | "muted" {
  if (type === "stock_in" || type === "opening_balance") {
    return "success";
  }

  if (type === "stock_out" || type === "waste" || type === "correction") {
    return "warning";
  }

  if (type === "sale_consumption") {
    return "muted";
  }

  return "danger";
}

function stockFilterMatches(
  stockFilter: string,
  level: InventoryLevel | undefined
) {
  if (stockFilter === "all") {
    return true;
  }

  if (stockFilter === "missing_thresholds") {
    return (
      level?.item.lowStockThresholdQuantity === null ||
      level?.item.lowStockThresholdQuantity === undefined ||
      level?.item.parLevelQuantity === null ||
      level?.item.parLevelQuantity === undefined
    );
  }

  return level?.stockStatus === stockFilter;
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

function FeedbackMessage({
  type,
  message
}: {
  type: "success" | "error";
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  const Icon = type === "success" ? CheckCircle2 : AlertTriangle;
  const className =
    type === "success"
      ? "border-success/40 bg-success/10 text-foreground"
      : "border-danger/40 bg-danger/10 text-foreground";

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-card border p-4 text-sm ${className}`}
    >
      <Icon
        className={`mt-0.5 size-4 ${
          type === "success" ? "text-success" : "text-danger"
        }`}
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold">
          {type === "success" ? "Saved" : "Inventory action failed"}
        </p>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function TabIcon({ tabId }: { tabId: InventoryTab }) {
  if (tabId === "overview") {
    return <Gauge className="size-4" aria-hidden="true" />;
  }

  if (tabId === "items") {
    return <Boxes className="size-4" aria-hidden="true" />;
  }

  if (tabId === "levels") {
    return <PackageCheck className="size-4" aria-hidden="true" />;
  }

  if (tabId === "alerts") {
    return <AlertTriangle className="size-4" aria-hidden="true" />;
  }

  if (tabId === "adjustments") {
    return <SlidersHorizontal className="size-4" aria-hidden="true" />;
  }

  if (tabId === "requirements") {
    return <ClipboardList className="size-4" aria-hidden="true" />;
  }

  if (tabId === "availability") {
    return <Utensils className="size-4" aria-hidden="true" />;
  }

  return <History className="size-4" aria-hidden="true" />;
}

function StaffInventoryContent() {
  const queryClient = useQueryClient();
  const token = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const companyId = selectedBranchAccess?.company.id ?? selectedBranch?.companyId;
  const inventoryAccess = getInventoryAccessMode({
    access: effectiveAccess,
    companyId,
    branchId: selectedBranchId
  });
  const {
    canReadCompanyInventory,
    canManageBranchStock,
    canManageCompanyInventory
  } = inventoryAccess;
  const [activeTab, setActiveTab] = useState<InventoryTab>("overview");
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [itemSearch, setItemSearch] = useState("");
  const [itemStatusFilter, setItemStatusFilter] = useState("all");
  const [itemUnitFilter, setItemUnitFilter] = useState("all");
  const [itemStockFilter, setItemStockFilter] = useState("all");
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormState>(
    emptyAdjustmentForm
  );
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [requirementForm, setRequirementForm] =
    useState<RequirementFormState>(emptyRequirementForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const inventoryItemsQuery = useQuery({
    queryKey: staffQueryKeys.inventoryItems(companyId),
    queryFn: () => getInventoryItems(companyId ?? "", token ?? undefined),
    enabled: Boolean(companyId && token && canReadCompanyInventory),
    staleTime: 30_000
  });
  const levelsQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryLevels(selectedBranchId),
    queryFn: () =>
      getBranchInventoryLevels(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token),
    staleTime: 30_000
  });
  const alertsQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryAlerts(selectedBranchId),
    queryFn: () =>
      getBranchInventoryAlerts(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token),
    staleTime: 30_000
  });
  const menuAvailabilityQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryMenuAvailability(selectedBranchId),
    queryFn: () =>
      getBranchInventoryMenuAvailability(
        selectedBranchId ?? "",
        token ?? undefined
      ),
    enabled: Boolean(selectedBranchId && token),
    staleTime: 30_000
  });
  const menuOverviewQuery = useQuery({
    queryKey: staffQueryKeys.staffMenuAdminOverview(selectedBranchId),
    queryFn: () =>
      getBranchMenuAdminOverview(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token && canReadCompanyInventory),
    staleTime: 30_000
  });
  const menuItems = useMemo(
    () =>
      getAllMenuItems(
        menuOverviewQuery.data?.categories.flatMap((category) => category.items)
      ),
    [menuOverviewQuery.data?.categories]
  );
  const activeMenuItemId = selectedMenuItemId || menuItems[0]?.id || "";
  const selectedMenuItem = menuItems.find((item) => item.id === activeMenuItemId);
  const requirementsQuery = useQuery({
    queryKey: staffQueryKeys.menuItemInventoryRequirements(activeMenuItemId),
    queryFn: () =>
      getMenuItemInventoryRequirements(activeMenuItemId, token ?? undefined),
    enabled: Boolean(activeMenuItemId && token && canReadCompanyInventory),
    staleTime: 30_000
  });
  const companyInventoryItems =
    inventoryItemsQuery.data?.items ?? emptyInventoryItems;
  const levels = levelsQuery.data?.levels ?? emptyInventoryLevels;
  const lowStockLevels =
    alertsQuery.data?.lowStockLevels ?? emptyInventoryLevels;
  const outOfStockLevels =
    alertsQuery.data?.outOfStockLevels ?? emptyInventoryLevels;
  const blockedMenuItems =
    alertsQuery.data?.stockBlockedMenuItems ?? emptyMenuAvailabilityItems;
  const recentMovements =
    alertsQuery.data?.recentMovements ?? emptyInventoryMovements;
  const branchInventoryItems = levels.map((level) => level.item);
  const visibleInventoryItems = canReadCompanyInventory
    ? companyInventoryItems
    : branchInventoryItems;
  const branchStockItems =
    branchInventoryItems.length > 0
      ? branchInventoryItems
      : companyInventoryItems;
  const levelByItemId = useMemo(
    () => new Map(levels.map((level) => [level.inventoryItemId, level])),
    [levels]
  );
  const branchStockItemById = useMemo(
    () => new Map(branchStockItems.map((item) => [item.id, item])),
    [branchStockItems]
  );
  const latestMovementByItemId = useMemo(() => {
    const movementByItemId = new Map<string, InventoryMovement>();

    for (const movement of recentMovements) {
      if (!movementByItemId.has(movement.inventoryItemId)) {
        movementByItemId.set(movement.inventoryItemId, movement);
      }
    }

    return movementByItemId;
  }, [recentMovements]);
  const sortedLevels = useMemo(
    () =>
      levels
        .slice()
        .sort(
          (left, right) =>
            stockStatusRank(left.stockStatus) -
              stockStatusRank(right.stockStatus) ||
            left.item.name.localeCompare(right.item.name)
        ),
    [levels]
  );
  const filteredInventoryItems = useMemo(() => {
    const search = itemSearch.trim().toLowerCase();

    return visibleInventoryItems.filter((item) => {
      const level = levelByItemId.get(item.id);
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        (item.sku ?? "").toLowerCase().includes(search);
      const matchesStatus =
        itemStatusFilter === "all" || item.status === itemStatusFilter;
      const matchesUnit = itemUnitFilter === "all" || item.unit === itemUnitFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesUnit &&
        stockFilterMatches(itemStockFilter, level)
      );
    });
  }, [
    itemSearch,
    itemStatusFilter,
    itemStockFilter,
    itemUnitFilter,
    levelByItemId,
    visibleInventoryItems
  ]);
  const itemsMissingThresholds = visibleInventoryItems.filter(
    (item) =>
      item.lowStockThresholdQuantity === null ||
      item.lowStockThresholdQuantity === undefined ||
      item.parLevelQuantity === null ||
      item.parLevelQuantity === undefined
  ).length;
  const selectedAdjustmentItem = branchStockItemById.get(
    adjustmentForm.inventoryItemId
  );
  const currentRequirements = requirementsQuery.data?.requirements ?? [];
  const selectedRequirementItem = visibleInventoryItems.find(
    (item) => item.id === requirementForm.inventoryItemId
  );
  const queryError =
    inventoryItemsQuery.error ??
    levelsQuery.error ??
    alertsQuery.error ??
    menuAvailabilityQuery.error ??
    menuOverviewQuery.error ??
    requirementsQuery.error;
  const isLoading =
    (canReadCompanyInventory && inventoryItemsQuery.isPending) ||
    levelsQuery.isPending ||
    alertsQuery.isPending ||
    menuAvailabilityQuery.isPending;

  const invalidateInventory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.inventoryItems(companyId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchInventoryLevels(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchInventoryAlerts(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchInventoryMenuAvailability(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.staffMenuAdminOverview(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.staffOwnerMenu(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.menu(selectedBranchId)
      })
    ]);
  };

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateInventoryItemPayload) =>
      createInventoryItem(companyId ?? "", payload, token ?? undefined),
    onSuccess: async (result) => {
      setItemForm(emptyItemForm);
      setFormError(null);
      setSuccessMessage(`${result.item.name} was added to the stock catalog.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const updateItemMutation = useMutation({
    mutationFn: (input: {
      inventoryItemId: string;
      payload: UpdateInventoryItemPayload;
    }) =>
      updateInventoryItem(
        input.inventoryItemId,
        input.payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setItemForm(emptyItemForm);
      setFormError(null);
      setSuccessMessage(`${result.item.name} was saved.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const adjustmentMutation = useMutation({
    mutationFn: (input: {
      inventoryItemId: string;
      payload: AdjustInventoryLevelPayload;
    }) =>
      adjustBranchInventoryLevel(
        selectedBranchId ?? "",
        input.inventoryItemId,
        input.payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setAdjustmentForm(emptyAdjustmentForm);
      setFormError(null);
      setSuccessMessage(
        `${humanizeInventoryValue(result.movement.type)} recorded for ${
          result.level.item.name
        }. Stock is now ${quantityWithUnit(
          result.level.quantityOnHand,
          result.level.item.unit
        )}.`
      );
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const requirementsMutation = useMutation({
    mutationFn: (payload: ReplaceMenuItemInventoryRequirementsPayload) =>
      updateMenuItemInventoryRequirements(
        activeMenuItemId,
        payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setRequirementForm(emptyRequirementForm);
      setFormError(null);
      setSuccessMessage(
        `${result.item.name} now has ${result.requirements.length} stock requirement${
          result.requirements.length === 1 ? "" : "s"
        }.`
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: staffQueryKeys.menuItemInventoryRequirements(activeMenuItemId)
        }),
        invalidateInventory()
      ]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });

  function handleSaveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageCompanyInventory) {
      setFormError("Catalog items require company-level inventory access.");
      return;
    }

    try {
      if (itemForm.id) {
        updateItemMutation.mutate({
          inventoryItemId: itemForm.id,
          payload: toUpdatePayload(itemForm)
        });
        return;
      }

      createItemMutation.mutate(toCreatePayload(itemForm));
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  function handleAdjustLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Branch stock adjustments require branch-level inventory access.");
      return;
    }

    if (riskyAdjustmentTypes.has(adjustmentForm.type) && !adjustmentForm.note.trim()) {
      setFormError(
        `${humanizeInventoryValue(adjustmentForm.type)} requires a note before saving.`
      );
      return;
    }

    if (
      riskyAdjustmentTypes.has(adjustmentForm.type) &&
      !window.confirm(
        `Record ${humanizeInventoryValue(adjustmentForm.type)} for ${
          selectedAdjustmentItem?.name ?? "this stock item"
        }?`
      )
    ) {
      return;
    }

    try {
      adjustmentMutation.mutate({
        inventoryItemId: adjustmentForm.inventoryItemId,
        payload: toAdjustmentPayload(adjustmentForm)
      });
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  function replaceRequirements(
    requirements: ReplaceMenuItemInventoryRequirementsPayload["requirements"]
  ) {
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageCompanyInventory) {
      setFormError("Menu requirements require company-level inventory access.");
      return;
    }

    requirementsMutation.mutate({ requirements });
  }

  function handleAddRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageCompanyInventory) {
      setFormError("Menu requirements require company-level inventory access.");
      return;
    }

    try {
      const quantityRequired = inventoryInputToQuantity(
        requirementForm.quantityRequired,
        "Required quantity"
      );
      const nextRequirements = [
        ...currentRequirements
          .filter(
            (entry) => entry.inventoryItemId !== requirementForm.inventoryItemId
          )
          .map((entry) => ({
            inventoryItemId: entry.inventoryItemId,
            quantityRequired: entry.quantityRequired,
            isRequired: entry.isRequired
          })),
        {
          inventoryItemId: requirementForm.inventoryItemId,
          quantityRequired,
          isRequired: requirementForm.isRequired
        }
      ];

      replaceRequirements(nextRequirements);
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="Select a branch"
        description="Inventory levels and stock availability are branch-specific."
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

  return (
    <StaffAuthGate requiredPermissions={["inventory.read"]} branchScoped>
      <div className="grid gap-5">
        <Card variant="quiet">
          <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <Badge variant="muted" className="mb-3">
                Branch stock
              </Badge>
              <CardTitle>{selectedBranch.name}</CardTitle>
              <CardDescription>
                Track stock levels, manual adjustments, recipe requirements,
                movement history, and inventory-driven menu availability.
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

        <div className="grid gap-3">
          <FeedbackMessage
            type="error"
            message={
              formError ?? (queryError ? getInventoryErrorMessage(queryError) : null)
            }
          />
          <FeedbackMessage type="success" message={successMessage} />
        </div>

        {canManageBranchStock && !canManageCompanyInventory ? (
          <div className="rounded-card border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            This role can adjust branch stock levels. Catalog items and menu
            requirements require company-level inventory access.
          </div>
        ) : null}

        {isLoading ? <LoadingState label="Loading inventory" /> : null}

        <InventoryMetrics
          totalInventoryItems={
            levelsQuery.data?.summary.totalInventoryItemCount ??
            visibleInventoryItems.length
          }
          trackedLevelCount={levelsQuery.data?.summary.trackedLevelCount ?? 0}
          lowStockCount={alertsQuery.data?.summary.lowStockCount ?? 0}
          outOfStockCount={alertsQuery.data?.summary.outOfStockCount ?? 0}
          blockedMenuItemCount={
            menuAvailabilityQuery.data?.summary.stockBlockedCount ??
            alertsQuery.data?.summary.stockBlockedMenuItemCount ??
            0
          }
          recentMovementCount={recentMovements.length}
          itemsMissingThresholds={itemsMissingThresholds}
        />

        <div className="flex flex-wrap gap-2 rounded-card border bg-surface/70 p-2">
          {inventoryTabs.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={activeTab === tab.id ? "primary" : "ghost"}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon tabId={tab.id} />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <InventoryOverview
            levels={sortedLevels}
            lowStockLevels={lowStockLevels}
            outOfStockLevels={outOfStockLevels}
            blockedMenuItems={blockedMenuItems}
            recentMovements={recentMovements}
            itemsMissingThresholds={itemsMissingThresholds}
            onOpenTab={setActiveTab}
          />
        ) : null}

        {activeTab === "items" ? (
          <InventoryItemsSection
            canManageCompanyInventory={canManageCompanyInventory}
            itemForm={itemForm}
            isSaving={
              createItemMutation.isPending || updateItemMutation.isPending
            }
            visibleInventoryItems={visibleInventoryItems}
            filteredInventoryItems={filteredInventoryItems}
            itemSearch={itemSearch}
            itemStatusFilter={itemStatusFilter}
            itemUnitFilter={itemUnitFilter}
            itemStockFilter={itemStockFilter}
            levelByItemId={levelByItemId}
            onFormChange={setItemForm}
            onSubmit={handleSaveItem}
            onEdit={setItemForm}
            onReset={() => setItemForm(emptyItemForm)}
            onSearchChange={setItemSearch}
            onStatusFilterChange={setItemStatusFilter}
            onUnitFilterChange={setItemUnitFilter}
            onStockFilterChange={setItemStockFilter}
          />
        ) : null}

        {activeTab === "levels" ? (
          <StockLevelsSection
            levels={sortedLevels}
            latestMovementByItemId={latestMovementByItemId}
          />
        ) : null}

        {activeTab === "alerts" ? (
          <InventoryAlertsSection
            lowStockLevels={lowStockLevels}
            outOfStockLevels={outOfStockLevels}
            blockedMenuItems={blockedMenuItems}
          />
        ) : null}

        {activeTab === "adjustments" ? (
          <AdjustmentSection
            canManageBranchStock={canManageBranchStock}
            adjustmentForm={adjustmentForm}
            branchStockItems={branchStockItems}
            selectedAdjustmentItem={selectedAdjustmentItem}
            isSaving={adjustmentMutation.isPending}
            onFormChange={setAdjustmentForm}
            onSubmit={handleAdjustLevel}
          />
        ) : null}

        {activeTab === "requirements" ? (
          <RequirementsSection
            canManageCompanyInventory={canManageCompanyInventory}
            menuItems={menuItems}
            activeMenuItemId={activeMenuItemId}
            selectedMenuItem={selectedMenuItem}
            currentRequirements={currentRequirements}
            requirementForm={requirementForm}
            inventoryItems={companyInventoryItems}
            selectedRequirementItem={selectedRequirementItem}
            isLoading={requirementsQuery.isPending || menuOverviewQuery.isPending}
            isSaving={requirementsMutation.isPending}
            onMenuItemChange={(menuItemId) => {
              setSelectedMenuItemId(menuItemId);
              setRequirementForm(emptyRequirementForm);
            }}
            onRequirementFormChange={setRequirementForm}
            onSubmitRequirement={handleAddRequirement}
            onRemoveRequirement={(requirement) =>
              replaceRequirements(
                currentRequirements
                  .filter((entry) => entry.id !== requirement.id)
                  .map((entry) => ({
                    inventoryItemId: entry.inventoryItemId,
                    quantityRequired: entry.quantityRequired,
                    isRequired: entry.isRequired
                  }))
              )
            }
          />
        ) : null}

        {activeTab === "availability" ? (
          <MenuAvailabilitySection
            items={
              menuAvailabilityQuery.data?.items ?? emptyMenuAvailabilityItems
            }
            isLoading={menuAvailabilityQuery.isPending}
          />
        ) : null}

        {activeTab === "movements" ? (
          <RecentMovementsSection movements={recentMovements} />
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void invalidateInventory()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh inventory
          </Button>
        </div>
      </div>
    </StaffAuthGate>
  );
}

function InventoryMetrics({
  totalInventoryItems,
  trackedLevelCount,
  lowStockCount,
  outOfStockCount,
  blockedMenuItemCount,
  recentMovementCount,
  itemsMissingThresholds
}: {
  totalInventoryItems: number;
  trackedLevelCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  blockedMenuItemCount: number;
  recentMovementCount: number;
  itemsMissingThresholds: number;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Inventory items"
        value={String(totalInventoryItems)}
        description={`${trackedLevelCount} tracked at branch`}
        icon={<Boxes className="size-4" aria-hidden="true" />}
      />
      <MetricCard
        label="Low / out"
        value={`${lowStockCount}/${outOfStockCount}`}
        description="Items needing attention now"
        tone={lowStockCount + outOfStockCount > 0 ? "warning" : "success"}
        icon={<Gauge className="size-4" aria-hidden="true" />}
      />
      <MetricCard
        label="Menu blocked"
        value={String(blockedMenuItemCount)}
        description="Computed from recipe requirements"
        tone={blockedMenuItemCount > 0 ? "warning" : "success"}
        icon={<ClipboardList className="size-4" aria-hidden="true" />}
      />
      <MetricCard
        label="Movements"
        value={String(recentMovementCount)}
        description={`${itemsMissingThresholds} items missing threshold or par`}
        tone={itemsMissingThresholds > 0 ? "warning" : "success"}
        icon={<History className="size-4" aria-hidden="true" />}
      />
    </section>
  );
}

function InventoryOverview({
  levels,
  lowStockLevels,
  outOfStockLevels,
  blockedMenuItems,
  recentMovements,
  itemsMissingThresholds,
  onOpenTab
}: {
  levels: InventoryLevel[];
  lowStockLevels: InventoryLevel[];
  outOfStockLevels: InventoryLevel[];
  blockedMenuItems: InventoryMenuAvailabilityItem[];
  recentMovements: InventoryMovement[];
  itemsMissingThresholds: number;
  onOpenTab: (tab: InventoryTab) => void;
}) {
  const urgentLevels = levels.filter((level) => level.stockStatus !== "in_stock");

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card variant="glass">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <Badge variant="muted">Control center</Badge>
            <CardTitle>Operational stock snapshot</CardTitle>
            <CardDescription>
              Urgent stock, menu blockers, and catalog setup gaps for the
              selected branch.
            </CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onOpenTab("levels")}>
            Stock levels
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SummaryRow
            label="Out-of-stock items"
            value={String(outOfStockLevels.length)}
            tone={outOfStockLevels.length > 0 ? "danger" : "success"}
          />
          <SummaryRow
            label="Low-stock items"
            value={String(lowStockLevels.length)}
            tone={lowStockLevels.length > 0 ? "warning" : "success"}
          />
          <SummaryRow
            label="Stock-blocked menu items"
            value={String(blockedMenuItems.length)}
            tone={blockedMenuItems.length > 0 ? "warning" : "success"}
          />
          <SummaryRow
            label="Missing thresholds/par levels"
            value={String(itemsMissingThresholds)}
            tone={itemsMissingThresholds > 0 ? "warning" : "success"}
          />
        </CardContent>
      </Card>

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <Badge variant="muted">Today-ready</Badge>
            <CardTitle>Next actions</CardTitle>
            <CardDescription>
              Stock changes here can change customer menu availability.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onOpenTab("adjustments")}
          >
            Adjust stock
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {urgentLevels.slice(0, 4).map((level) => (
            <div
              key={level.inventoryItemId}
              className="rounded-card border bg-surface/70 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{level.item.name}</p>
                <Badge variant={inventoryStatusBadgeVariant(level.stockStatus)}>
                  {humanizeInventoryValue(level.stockStatus)}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                {quantityWithUnit(level.quantityOnHand, level.item.unit)}
                {restockSuggestion(level) !== null
                  ? ` · Restock suggestion ${quantityWithUnit(
                      restockSuggestion(level),
                      level.item.unit
                    )}`
                  : ""}
              </p>
            </div>
          ))}
          {urgentLevels.length === 0 ? (
            <div className="flex items-start gap-3 rounded-card border border-success/40 bg-success/10 p-4">
              <CheckCircle2
                className="mt-0.5 size-4 text-success"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">No urgent stock alerts</p>
                <p className="text-sm text-muted-foreground">
                  Branch stock is currently above alert thresholds.
                </p>
              </div>
            </div>
          ) : null}
          {recentMovements[0] ? (
            <p className="text-sm text-muted-foreground">
              Latest movement: {humanizeInventoryValue(recentMovements[0].type)}{" "}
              for {recentMovements[0].inventoryItem?.name ?? "stock item"} at{" "}
              {new Date(recentMovements[0].createdAt).toLocaleString()}.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/70 p-3 text-sm">
      <span>{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}

function InventoryItemsSection({
  canManageCompanyInventory,
  itemForm,
  isSaving,
  visibleInventoryItems,
  filteredInventoryItems,
  itemSearch,
  itemStatusFilter,
  itemUnitFilter,
  itemStockFilter,
  levelByItemId,
  onFormChange,
  onSubmit,
  onEdit,
  onReset,
  onSearchChange,
  onStatusFilterChange,
  onUnitFilterChange,
  onStockFilterChange
}: {
  canManageCompanyInventory: boolean;
  itemForm: ItemFormState;
  isSaving: boolean;
  visibleInventoryItems: InventoryItem[];
  filteredInventoryItems: InventoryItem[];
  itemSearch: string;
  itemStatusFilter: string;
  itemUnitFilter: string;
  itemStockFilter: string;
  levelByItemId: Map<string, InventoryLevel>;
  onFormChange: (form: ItemFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (form: ItemFormState) => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onUnitFilterChange: (value: string) => void;
  onStockFilterChange: (value: string) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Catalog item</Badge>
          <CardTitle>
            {itemForm.id ? "Edit inventory item" : "Create inventory item"}
          </CardTitle>
          <CardDescription>
            Units are fixed after creation. Name, SKU, status, low threshold,
            and par level can be edited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManageCompanyInventory ? (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Name">
                  <Input
                    value={itemForm.name}
                    onChange={(event) =>
                      onFormChange({ ...itemForm, name: event.target.value })
                    }
                    placeholder="Milk"
                    required
                  />
                </FieldLabel>
                <FieldLabel label="SKU">
                  <Input
                    value={itemForm.sku}
                    onChange={(event) =>
                      onFormChange({ ...itemForm, sku: event.target.value })
                    }
                    placeholder="MILK-1L"
                  />
                </FieldLabel>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Unit">
                  <select
                    value={itemForm.unit}
                    onChange={(event) =>
                      onFormChange({
                        ...itemForm,
                        unit: event.target.value as InventoryUnit
                      })
                    }
                    className={selectClassName}
                    disabled={Boolean(itemForm.id)}
                  >
                    {inventoryUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {humanizeInventoryValue(unit)}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Status">
                  <select
                    value={itemForm.status}
                    onChange={(event) =>
                      onFormChange({
                        ...itemForm,
                        status: event.target.value as InventoryItemStatus
                      })
                    }
                    className={selectClassName}
                    disabled={!itemForm.id}
                  >
                    {inventoryItemStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeInventoryValue(status)}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Low stock threshold">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={itemForm.lowStockThresholdQuantity}
                    onChange={(event) =>
                      onFormChange({
                        ...itemForm,
                        lowStockThresholdQuantity: event.target.value
                      })
                    }
                    placeholder="10"
                  />
                </FieldLabel>
                <FieldLabel label="Par level">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={itemForm.parLevelQuantity}
                    onChange={(event) =>
                      onFormChange({
                        ...itemForm,
                        parLevelQuantity: event.target.value
                      })
                    }
                    placeholder="50"
                  />
                </FieldLabel>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : itemForm.id ? (
                    <Save className="size-4" aria-hidden="true" />
                  ) : (
                    <PackagePlus className="size-4" aria-hidden="true" />
                  )}
                  {itemForm.id ? "Save item" : "Create item"}
                </Button>
                {itemForm.id ? (
                  <Button type="button" variant="secondary" onClick={onReset}>
                    Reset
                  </Button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
              Catalog item edits require company-level inventory management.
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <Badge variant="muted">Company catalog</Badge>
          <CardTitle>Inventory items</CardTitle>
          <CardDescription>
            Search by name or SKU, then filter by status, unit, or branch stock
            condition.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 rounded-card border bg-surface/70 p-3 md:grid-cols-[1fr_0.7fr_0.7fr_0.8fr]">
            <FieldLabel label="Search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={itemSearch}
                  onChange={(event) => onSearchChange(event.target.value)}
                  className="pl-9"
                  placeholder="Name or SKU"
                />
              </div>
            </FieldLabel>
            <FieldLabel label="Status">
              <select
                value={itemStatusFilter}
                onChange={(event) => onStatusFilterChange(event.target.value)}
                className={selectClassName}
              >
                <option value="all">All statuses</option>
                {inventoryItemStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanizeInventoryValue(status)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Unit">
              <select
                value={itemUnitFilter}
                onChange={(event) => onUnitFilterChange(event.target.value)}
                className={selectClassName}
              >
                <option value="all">All units</option>
                {inventoryUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {humanizeInventoryValue(unit)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Stock">
              <select
                value={itemStockFilter}
                onChange={(event) => onStockFilterChange(event.target.value)}
                className={selectClassName}
              >
                <option value="all">All stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="low_stock">Low stock</option>
                <option value="in_stock">OK</option>
                <option value="missing_thresholds">Missing threshold/par</option>
              </select>
            </FieldLabel>
          </div>

          {filteredInventoryItems.map((item) => {
            const level = levelByItemId.get(item.id);

            return (
              <div
                key={item.id}
                className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <Badge
                      variant={item.status === "active" ? "success" : "muted"}
                    >
                      {humanizeInventoryValue(item.status)}
                    </Badge>
                    {level ? (
                      <Badge
                        variant={inventoryStatusBadgeVariant(level.stockStatus)}
                      >
                        {level.stockStatus === "in_stock"
                          ? "OK"
                          : humanizeInventoryValue(level.stockStatus)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.sku ? `${item.sku} / ` : "No SKU / "}
                    {humanizeInventoryValue(item.unit)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Low threshold{" "}
                    {item.lowStockThresholdQuantity ?? "not set"} / Par level{" "}
                    {item.parLevelQuantity ?? "not set"}
                  </p>
                </div>
                {canManageCompanyInventory ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onEdit(toItemForm(item))}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
            );
          })}
          {visibleInventoryItems.length > 0 && filteredInventoryItems.length === 0 ? (
            <EmptyState
              title="No matching inventory items"
              description="Adjust search or filters to see more items."
            />
          ) : null}
          {visibleInventoryItems.length === 0 ? (
            <EmptyState
              title="No inventory items yet"
              description="Create catalog items before branch stock can be tracked."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function StockLevelsSection({
  levels,
  latestMovementByItemId
}: {
  levels: InventoryLevel[];
  latestMovementByItemId: Map<string, InventoryMovement>;
}) {
  return (
    <Card variant="glass">
      <CardHeader>
        <Badge variant="muted">Branch levels</Badge>
        <CardTitle>Stock levels</CardTitle>
        <CardDescription>
          Urgent items are grouped first: out, low, then OK.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {levels.map((level) => {
          const lastMovement = latestMovementByItemId.get(level.inventoryItemId);
          const threshold = getThreshold(level);
          const parLevel = getParLevel(level);

          return (
            <div
              key={level.inventoryItemId}
              className="grid gap-4 rounded-card border bg-surface/70 p-4 xl:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{level.item.name}</p>
                  <Badge variant={inventoryStatusBadgeVariant(level.stockStatus)}>
                    {level.stockStatus === "in_stock"
                      ? "OK"
                      : humanizeInventoryValue(level.stockStatus)}
                  </Badge>
                  <Badge variant="muted">
                    {humanizeInventoryValue(level.item.unit)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {level.item.sku ? `${level.item.sku} / ` : "No SKU / "}
                  Threshold {threshold ?? "not set"} / Par{" "}
                  {parLevel ?? "not set"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last movement{" "}
                  {lastMovement
                    ? `${humanizeInventoryValue(
                        lastMovement.type
                      )} ${movementDeltaLabel(lastMovement)} at ${new Date(
                        lastMovement.createdAt
                      ).toLocaleString()}`
                    : "not recorded yet"}
                </p>
              </div>
              <div className="grid gap-2 text-sm md:min-w-64">
                <SummaryRow
                  label="On hand"
                  value={quantityWithUnit(level.quantityOnHand, level.item.unit)}
                  tone={level.stockStatus === "in_stock" ? "success" : "warning"}
                />
                <SummaryRow
                  label="Reserved"
                  value={quantityWithUnit(level.reservedQuantity, level.item.unit)}
                  tone="success"
                />
                <SummaryRow
                  label="Restock suggestion"
                  value={
                    restockSuggestion(level) === null
                      ? "None"
                      : quantityWithUnit(restockSuggestion(level), level.item.unit)
                  }
                  tone={restockSuggestion(level) === null ? "success" : "warning"}
                />
              </div>
            </div>
          );
        })}
        {levels.length === 0 ? (
          <EmptyState
            title="No branch stock levels"
            description="Create inventory items and record opening balances to track stock."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AdjustmentSection({
  canManageBranchStock,
  adjustmentForm,
  branchStockItems,
  selectedAdjustmentItem,
  isSaving,
  onFormChange,
  onSubmit
}: {
  canManageBranchStock: boolean;
  adjustmentForm: AdjustmentFormState;
  branchStockItems: InventoryItem[];
  selectedAdjustmentItem?: InventoryItem;
  isSaving: boolean;
  onFormChange: (form: AdjustmentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card variant="glass">
      <CardHeader>
        <Badge variant="muted">Manual movement</Badge>
        <CardTitle>Record stock adjustment</CardTitle>
        <CardDescription>
          Corrections set a final quantity. Other movements use a non-negative
          quantity delta and backend validation prevents negative stock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canManageBranchStock ? (
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FieldLabel label="Stock item">
                <select
                  value={adjustmentForm.inventoryItemId}
                  onChange={(event) =>
                    onFormChange({
                      ...adjustmentForm,
                      inventoryItemId: event.target.value
                    })
                  }
                  className={selectClassName}
                  required
                >
                  <option value="">Choose stock item</option>
                  {branchStockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({humanizeInventoryValue(item.unit)})
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Movement type">
                <select
                  value={adjustmentForm.type}
                  onChange={(event) =>
                    onFormChange({
                      ...adjustmentForm,
                      type: event.target.value as AdjustmentFormState["type"]
                    })
                  }
                  className={selectClassName}
                >
                  {manualInventoryMovementTypes.map((type) => (
                    <option key={type} value={type}>
                      {humanizeInventoryValue(type)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              {adjustmentForm.type === "correction" ? (
                <FieldLabel label="Final quantity">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustmentForm.finalQuantity}
                    onChange={(event) =>
                      onFormChange({
                        ...adjustmentForm,
                        finalQuantity: event.target.value
                      })
                    }
                    required
                  />
                </FieldLabel>
              ) : (
                <FieldLabel label="Quantity delta">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustmentForm.quantity}
                    onChange={(event) =>
                      onFormChange({
                        ...adjustmentForm,
                        quantity: event.target.value
                      })
                    }
                    required
                  />
                </FieldLabel>
              )}
              <FieldLabel label="Unit">
                <Input
                  value={itemUnitLabel(selectedAdjustmentItem)}
                  readOnly
                  aria-label="Adjustment unit"
                />
              </FieldLabel>
            </div>
            <FieldLabel
              label={
                riskyAdjustmentTypes.has(adjustmentForm.type)
                  ? "Note required"
                  : "Note"
              }
            >
              <textarea
                value={adjustmentForm.note}
                onChange={(event) =>
                  onFormChange({
                    ...adjustmentForm,
                    note: event.target.value
                  })
                }
                className={textareaClassName}
                placeholder="Opening balance, delivery reference, waste reason"
                required={riskyAdjustmentTypes.has(adjustmentForm.type)}
              />
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : adjustmentForm.type === "stock_in" ||
                  adjustmentForm.type === "opening_balance" ? (
                  <ArrowUpCircle className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowDownCircle className="size-4" aria-hidden="true" />
                )}
                Record adjustment
              </Button>
              {riskyAdjustmentTypes.has(adjustmentForm.type) ? (
                <Badge variant="warning">Confirmation required</Badge>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
            Stock adjustment requires branch-level inventory management access.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryAlertsSection({
  lowStockLevels,
  outOfStockLevels,
  blockedMenuItems
}: {
  lowStockLevels: InventoryLevel[];
  outOfStockLevels: InventoryLevel[];
  blockedMenuItems: InventoryMenuAvailabilityItem[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card variant="glass">
        <CardHeader>
          <Badge variant="warning">Stock alerts</Badge>
          <CardTitle>Low and out-of-stock items</CardTitle>
          <CardDescription>
            Restock suggestions use par level minus quantity on hand.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {[...outOfStockLevels, ...lowStockLevels].map((level) => (
            <div
              key={level.inventoryItemId}
              className="rounded-card border bg-surface/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{level.item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current {quantityWithUnit(level.quantityOnHand, level.item.unit)} /
                    Threshold {getThreshold(level) ?? "not set"} / Par{" "}
                    {getParLevel(level) ?? "not set"}
                  </p>
                </div>
                <Badge variant={inventoryStatusBadgeVariant(level.stockStatus)}>
                  {humanizeInventoryValue(level.stockStatus)}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Restock suggestion:{" "}
                {restockSuggestion(level) === null
                  ? "No par-based restock needed"
                  : quantityWithUnit(restockSuggestion(level), level.item.unit)}
              </p>
            </div>
          ))}
          {outOfStockLevels.length + lowStockLevels.length === 0 ? (
            <EmptyState
              title="No stock alerts"
              description="No low or out-of-stock items for this branch."
            />
          ) : null}
        </CardContent>
      </Card>

      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Menu blockers</Badge>
          <CardTitle>Blocked by stock</CardTitle>
          <CardDescription>
            These menu items cannot be ordered because required stock is
            missing or insufficient.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {blockedMenuItems.map((item) => (
            <MenuAvailabilityRow key={item.menuItemId} item={item} />
          ))}
          {blockedMenuItems.length === 0 ? (
            <EmptyState
              title="No stock-blocked menu items"
              description="Inventory requirements are not blocking customer ordering."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function RequirementsSection({
  canManageCompanyInventory,
  menuItems,
  activeMenuItemId,
  selectedMenuItem,
  currentRequirements,
  requirementForm,
  inventoryItems,
  selectedRequirementItem,
  isLoading,
  isSaving,
  onMenuItemChange,
  onRequirementFormChange,
  onSubmitRequirement,
  onRemoveRequirement
}: {
  canManageCompanyInventory: boolean;
  menuItems: MenuAdminItem[];
  activeMenuItemId: string;
  selectedMenuItem?: MenuAdminItem;
  currentRequirements: MenuItemInventoryRequirement[];
  requirementForm: RequirementFormState;
  inventoryItems: InventoryItem[];
  selectedRequirementItem?: InventoryItem;
  isLoading: boolean;
  isSaving: boolean;
  onMenuItemChange: (menuItemId: string) => void;
  onRequirementFormChange: (form: RequirementFormState) => void;
  onSubmitRequirement: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveRequirement: (requirement: MenuItemInventoryRequirement) => void;
}) {
  return (
    <Card variant="glass">
      <CardHeader>
        <Badge variant="muted">Recipe mapping</Badge>
        <CardTitle>Menu item requirements</CardTitle>
        <CardDescription>
          Required requirements consume stock on order accept and can block
          customer ordering when stock is insufficient.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? <LoadingState label="Loading requirements" /> : null}
        {menuItems.length > 0 ? (
          <FieldLabel label="Menu item">
            <select
              value={activeMenuItemId}
              onChange={(event) => onMenuItemChange(event.target.value)}
              className={selectClassName}
            >
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FieldLabel>
        ) : (
          <EmptyState
            title="No menu items available"
            description="Create active menu items before mapping stock requirements."
          />
        )}

        {selectedMenuItem ? (
          <p className="rounded-card border bg-surface/70 p-3 text-sm text-muted-foreground">
            Requirements for{" "}
            <span className="font-semibold text-foreground">
              {selectedMenuItem.name}
            </span>
            .
          </p>
        ) : null}

        {canManageCompanyInventory && activeMenuItemId ? (
          <form onSubmit={onSubmitRequirement} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1fr_10rem_auto]">
              <FieldLabel label="Stock item">
                <select
                  value={requirementForm.inventoryItemId}
                  onChange={(event) =>
                    onRequirementFormChange({
                      ...requirementForm,
                      inventoryItemId: event.target.value
                    })
                  }
                  className={selectClassName}
                  required
                >
                  <option value="">Choose stock item</option>
                  {inventoryItems
                    .filter((item) => item.status !== "archived")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({humanizeInventoryValue(item.unit)})
                      </option>
                    ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Quantity">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={requirementForm.quantityRequired}
                  onChange={(event) =>
                    onRequirementFormChange({
                      ...requirementForm,
                      quantityRequired: event.target.value
                    })
                  }
                  required
                />
              </FieldLabel>
              <label className="flex min-h-11 items-center gap-2 rounded-button border bg-surface px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={requirementForm.isRequired}
                  onChange={(event) =>
                    onRequirementFormChange({
                      ...requirementForm,
                      isRequired: event.target.checked
                    })
                  }
                  className="size-4 accent-primary"
                />
                Required
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Expected stock impact:{" "}
              {selectedMenuItem &&
              selectedRequirementItem &&
              requirementForm.quantityRequired
                ? `1 ${selectedMenuItem.name} consumes ${
                    requirementForm.quantityRequired
                  } ${humanizeInventoryValue(selectedRequirementItem.unit)} ${
                    selectedRequirementItem.name
                  }`
                : "Select a stock item and quantity to preview consumption."}
            </p>
            <Button type="submit" disabled={isSaving} className="w-fit">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save requirement
            </Button>
          </form>
        ) : (
          <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
            Catalog items and menu requirements require company-level inventory
            access.
          </div>
        )}

        <div className="grid gap-3">
          {currentRequirements.map((requirement) => (
            <div
              key={requirement.id}
              className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">
                    {requirement.inventoryItem.name}
                  </p>
                  <Badge variant={requirement.isRequired ? "warning" : "muted"}>
                    {requirement.isRequired ? "Required" : "Optional"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  1 {selectedMenuItem?.name ?? "menu item"} consumes{" "}
                  {quantityWithUnit(
                    requirement.quantityRequired,
                    requirement.unit
                  )}
                  .
                </p>
              </div>
              {canManageCompanyInventory ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => onRemoveRequirement(requirement)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {currentRequirements.length === 0 && selectedMenuItem ? (
            <EmptyState
              title="No stock requirements"
              description="This menu item is not stock-gated or stock-consuming yet."
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MenuAvailabilitySection({
  items,
  isLoading
}: {
  items: InventoryMenuAvailabilityItem[];
  isLoading: boolean;
}) {
  return (
    <Card variant="glass">
      <CardHeader>
        <Badge variant="muted">Computed only</Badge>
        <CardTitle>Menu availability by stock</CardTitle>
        <CardDescription>
          Inventory availability is separate from manual menu visibility and
          branch availability overrides.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? <LoadingState label="Loading stock availability" /> : null}
        {items.map((item) => (
          <MenuAvailabilityRow key={item.menuItemId} item={item} />
        ))}
        {items.length === 0 && !isLoading ? (
          <EmptyState
            title="No menu availability rows"
            description="Create menu items and requirements to compute inventory availability."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function MenuAvailabilityRow({ item }: { item: InventoryMenuAvailabilityItem }) {
  return (
    <div className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{item.name}</p>
          <Badge variant={item.canOrder ? "success" : "danger"}>
            {item.canOrder ? "Can order" : "Blocked"}
          </Badge>
          <Badge variant={inventoryStatusBadgeVariant(item.stockStatus)}>
            {item.stockStatus === "in_stock"
              ? "OK"
              : humanizeInventoryValue(item.stockStatus)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual menu state: {item.branchVisible ? "visible" : "hidden"} /{" "}
          {item.branchAvailable ? "available" : "unavailable"}
          {item.reasons.length > 0
            ? ` / ${item.reasons.map(humanizeInventoryValue).join(", ")}`
            : ""}
        </p>
        {item.missingRequirements.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {item.missingRequirements.map((requirement) => (
              <p
                key={requirement.inventoryItemId}
                className="rounded-button border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-foreground"
              >
                Missing {requirement.name}: needs{" "}
                {quantityWithUnit(
                  requirement.quantityRequired,
                  requirement.unit
                )}
                , has{" "}
                {quantityWithUnit(requirement.quantityOnHand, requirement.unit)}
                , shortage{" "}
                {quantityWithUnit(
                  requirement.shortageQuantity,
                  requirement.unit
                )}
                .
              </p>
            ))}
          </div>
        ) : null}
        {item.lowStockRequirements.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {item.lowStockRequirements.map((requirement) => (
              <p
                key={requirement.inventoryItemId}
                className="rounded-button border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
              >
                Low after order: {requirement.name} goes to{" "}
                {quantityWithUnit(requirement.quantityAfter, requirement.unit)}
                ; threshold{" "}
                {quantityWithUnit(requirement.threshold, requirement.unit)}.
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecentMovementsSection({
  movements
}: {
  movements: InventoryMovement[];
}) {
  return (
    <Card variant="quiet">
      <CardHeader>
        <Badge variant="muted">Audit trail</Badge>
        <CardTitle>Recent movements</CardTitle>
        <CardDescription>
          Manual adjustments and sale consumption records for the selected
          branch.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {movements.map((movement) => (
          <div
            key={movement.id}
            className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">
                  {movement.inventoryItem?.name ?? movement.inventoryItemId}
                </p>
                <Badge variant={movementVariant(movement.type)}>
                  {humanizeInventoryValue(movement.type)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Delta {movementDeltaLabel(movement)}{" "}
                {humanizeInventoryValue(movement.unit)} / after{" "}
                {movement.quantityAfter}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Staff {movement.staffUserId ?? "not recorded"} / Source{" "}
                {movement.sourceType ?? "manual"}{" "}
                {movement.sourceId ? `(${movement.sourceId})` : ""}
              </p>
              {movement.note ? (
                <p className="mt-2 rounded-button border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {movement.note}
                </p>
              ) : null}
            </div>
            <span className="text-sm text-muted-foreground">
              {new Date(movement.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {movements.length === 0 ? (
          <EmptyState
            title="No movement history"
            description="Adjust stock or accept an inventory-linked order to create movements."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StaffInventoryPage() {
  return (
    <StaffPageShell
      title="Inventory"
      description="Branch stock levels, movement history, menu requirements, and computed stock availability for real cafe operations."
    >
      <StaffInventoryContent />
    </StaffPageShell>
  );
}
