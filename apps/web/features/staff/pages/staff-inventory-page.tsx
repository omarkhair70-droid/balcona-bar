"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Gauge,
  Loader2,
  PackagePlus,
  RefreshCw,
  Save,
  SlidersHorizontal
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
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
  optionalInventoryInputToQuantity
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
  InventoryMovementType,
  InventoryUnit,
  MenuAdminItem,
  ReplaceMenuItemInventoryRequirementsPayload
} from "@/lib/api/types";
import { hasStaffPermission } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

type ItemFormState = {
  name: string;
  sku: string;
  unit: InventoryUnit;
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

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35";

const textareaClassName =
  "min-h-24 w-full rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35";

const emptyItemForm: ItemFormState = {
  name: "",
  sku: "",
  unit: "milliliter",
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

function itemUnitLabel(item?: InventoryItem) {
  return item ? humanizeInventoryValue(item.unit) : "Unit";
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
  const canManageInventory = hasStaffPermission(
    effectiveAccess,
    "inventory.manage",
    selectedBranchId
  );
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, InventoryItemStatus>
  >({});
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormState>(
    emptyAdjustmentForm
  );
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [requirementForm, setRequirementForm] =
    useState<RequirementFormState>(emptyRequirementForm);
  const [formError, setFormError] = useState<string | null>(null);

  const inventoryItemsQuery = useQuery({
    queryKey: staffQueryKeys.inventoryItems(companyId),
    queryFn: () => getInventoryItems(companyId ?? "", token ?? undefined),
    enabled: Boolean(companyId && token)
  });
  const levelsQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryLevels(selectedBranchId),
    queryFn: () =>
      getBranchInventoryLevels(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token)
  });
  const alertsQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryAlerts(selectedBranchId),
    queryFn: () =>
      getBranchInventoryAlerts(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token)
  });
  const menuAvailabilityQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryMenuAvailability(selectedBranchId),
    queryFn: () =>
      getBranchInventoryMenuAvailability(
        selectedBranchId ?? "",
        token ?? undefined
      ),
    enabled: Boolean(selectedBranchId && token)
  });
  const menuOverviewQuery = useQuery({
    queryKey: staffQueryKeys.staffMenuAdminOverview(selectedBranchId),
    queryFn: () =>
      getBranchMenuAdminOverview(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token)
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
    enabled: Boolean(activeMenuItemId && token)
  });
  const inventoryItems = inventoryItemsQuery.data?.items ?? [];
  const inventoryItemById = new Map(
    inventoryItems.map((item) => [item.id, item])
  );

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
        queryKey: customerQueryKeys.menu(selectedBranchId)
      })
    ]);
  };

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateInventoryItemPayload) =>
      createInventoryItem(companyId ?? "", payload, token ?? undefined),
    onSuccess: async () => {
      setItemForm(emptyItemForm);
      setFormError(null);
      await invalidateInventory();
    },
    onError: (error) => setFormError(getInventoryErrorMessage(error))
  });
  const updateItemMutation = useMutation({
    mutationFn: (input: {
      inventoryItemId: string;
      status: InventoryItemStatus;
    }) =>
      updateInventoryItem(
        input.inventoryItemId,
        { status: input.status },
        token ?? undefined
      ),
    onSuccess: invalidateInventory,
    onError: (error) => setFormError(getInventoryErrorMessage(error))
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
    onSuccess: async () => {
      setAdjustmentForm(emptyAdjustmentForm);
      setFormError(null);
      await invalidateInventory();
    },
    onError: (error) => setFormError(getInventoryErrorMessage(error))
  });
  const requirementsMutation = useMutation({
    mutationFn: (payload: ReplaceMenuItemInventoryRequirementsPayload) =>
      updateMenuItemInventoryRequirements(
        activeMenuItemId,
        payload,
        token ?? undefined
      ),
    onSuccess: async () => {
      setRequirementForm(emptyRequirementForm);
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: staffQueryKeys.menuItemInventoryRequirements(activeMenuItemId)
        }),
        invalidateInventory()
      ]);
    },
    onError: (error) => setFormError(getInventoryErrorMessage(error))
  });

  function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      void createItemMutation.mutateAsync(toCreatePayload(itemForm));
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  function handleAdjustLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      void adjustmentMutation.mutateAsync({
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
    void requirementsMutation.mutateAsync({ requirements });
  }

  function handleAddRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      const existing = requirementsQuery.data?.requirements ?? [];
      const quantityRequired = inventoryInputToQuantity(
        requirementForm.quantityRequired,
        "Required quantity"
      );
      const nextRequirements = [
        ...existing
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

  const isLoading =
    inventoryItemsQuery.isPending ||
    levelsQuery.isPending ||
    alertsQuery.isPending ||
    menuAvailabilityQuery.isPending;

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
                Track branch stock levels, manual movements, and menu items
                blocked by stock. Catalog and requirement changes remain scoped
                to the company menu.
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

        {formError ? (
          <div
            role="alert"
            className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
          >
            {formError}
          </div>
        ) : null}

        {isLoading ? <LoadingState label="Loading inventory" /> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Inventory items"
            value={String(levelsQuery.data?.summary.totalInventoryItemCount ?? 0)}
            description={`${levelsQuery.data?.summary.trackedLevelCount ?? 0} tracked at branch`}
            icon={<Boxes className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Low stock"
            value={String(alertsQuery.data?.summary.lowStockCount ?? 0)}
            description="At or below threshold"
            tone={
              (alertsQuery.data?.summary.lowStockCount ?? 0) > 0
                ? "warning"
                : "success"
            }
            icon={<Gauge className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Out of stock"
            value={String(alertsQuery.data?.summary.outOfStockCount ?? 0)}
            description="Quantity is zero"
            tone={
              (alertsQuery.data?.summary.outOfStockCount ?? 0) > 0
                ? "warning"
                : "success"
            }
            icon={<AlertTriangle className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Menu blocked"
            value={String(
              alertsQuery.data?.summary.stockBlockedMenuItemCount ?? 0
            )}
            description="Computed from requirements"
            tone={
              (alertsQuery.data?.summary.stockBlockedMenuItemCount ?? 0) > 0
                ? "warning"
                : "success"
            }
            icon={<ClipboardList className="size-4" aria-hidden="true" />}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Inventory items</CardTitle>
              <CardDescription>
                Company stock catalog. Units are fixed when the item is
                created.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {canManageInventory ? (
                <form onSubmit={handleCreateItem} className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={itemForm.name}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                      placeholder="Milk"
                      required
                    />
                    <Input
                      value={itemForm.sku}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          sku: event.target.value
                        }))
                      }
                      placeholder="SKU optional"
                    />
                    <select
                      value={itemForm.unit}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          unit: event.target.value as InventoryUnit
                        }))
                      }
                      className={selectClassName}
                    >
                      {inventoryUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {humanizeInventoryValue(unit)}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={itemForm.lowStockThresholdQuantity}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          lowStockThresholdQuantity: event.target.value
                        }))
                      }
                      placeholder="Low stock threshold"
                      inputMode="numeric"
                    />
                    <Input
                      value={itemForm.parLevelQuantity}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          parLevelQuantity: event.target.value
                        }))
                      }
                      placeholder="Par level"
                      inputMode="numeric"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={createItemMutation.isPending}
                    className="w-fit"
                  >
                    {createItemMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <PackagePlus className="size-4" aria-hidden="true" />
                    )}
                    Create item
                  </Button>
                </form>
              ) : (
                <div className="rounded-card border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Read-only stock visibility is available for this role.
                </div>
              )}

              <div className="grid gap-3">
                {inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-card border border-border bg-surface/70 p-3 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.sku ? `${item.sku} · ` : ""}
                        {humanizeInventoryValue(item.unit)}
                        {item.lowStockThresholdQuantity !== null &&
                        item.lowStockThresholdQuantity !== undefined
                          ? ` · low at ${item.lowStockThresholdQuantity}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={item.status === "active" ? "success" : "muted"}
                      >
                        {humanizeInventoryValue(item.status)}
                      </Badge>
                      {canManageInventory ? (
                        <>
                          <select
                            value={statusDrafts[item.id] ?? item.status}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [item.id]: event.target
                                  .value as InventoryItemStatus
                              }))
                            }
                            className="min-h-10 rounded-button border bg-surface px-2 text-sm"
                          >
                            {inventoryItemStatuses.map((status) => (
                              <option key={status} value={status}>
                                {humanizeInventoryValue(status)}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={updateItemMutation.isPending}
                            onClick={() =>
                              updateItemMutation.mutate({
                                inventoryItemId: item.id,
                                status: statusDrafts[item.id] ?? item.status
                              })
                            }
                          >
                            <Save className="size-4" aria-hidden="true" />
                            Save
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
                {inventoryItems.length === 0 ? (
                  <EmptyState
                    title="No inventory items yet"
                    description="Create catalog items before branch stock can be tracked."
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle>Branch stock levels</CardTitle>
              <CardDescription>
                Opening balances and manual adjustments create movement history.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {canManageInventory ? (
                <form onSubmit={handleAdjustLevel} className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={adjustmentForm.inventoryItemId}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({
                          ...current,
                          inventoryItemId: event.target.value
                        }))
                      }
                      className={selectClassName}
                      required
                    >
                      <option value="">Choose stock item</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({humanizeInventoryValue(item.unit)})
                        </option>
                      ))}
                    </select>
                    <select
                      value={adjustmentForm.type}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({
                          ...current,
                          type: event.target.value as AdjustmentFormState["type"]
                        }))
                      }
                      className={selectClassName}
                    >
                      {manualInventoryMovementTypes.map((type) => (
                        <option key={type} value={type}>
                          {humanizeInventoryValue(type)}
                        </option>
                      ))}
                    </select>
                    {adjustmentForm.type === "correction" ? (
                      <Input
                        value={adjustmentForm.finalQuantity}
                        onChange={(event) =>
                          setAdjustmentForm((current) => ({
                            ...current,
                            finalQuantity: event.target.value
                          }))
                        }
                        placeholder="Final quantity"
                        inputMode="numeric"
                        required
                      />
                    ) : (
                      <Input
                        value={adjustmentForm.quantity}
                        onChange={(event) =>
                          setAdjustmentForm((current) => ({
                            ...current,
                            quantity: event.target.value
                          }))
                        }
                        placeholder="Quantity"
                        inputMode="numeric"
                        required
                      />
                    )}
                    <Input
                      value={itemUnitLabel(
                        inventoryItemById.get(adjustmentForm.inventoryItemId)
                      )}
                      readOnly
                      aria-label="Adjustment unit"
                    />
                  </div>
                  <textarea
                    value={adjustmentForm.note}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        note: event.target.value
                      }))
                    }
                    className={textareaClassName}
                    placeholder="Opening balance, delivery reference, waste reason"
                  />
                  <Button
                    type="submit"
                    disabled={adjustmentMutation.isPending}
                    className="w-fit"
                  >
                    {adjustmentMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <SlidersHorizontal className="size-4" aria-hidden="true" />
                    )}
                    Record adjustment
                  </Button>
                </form>
              ) : null}

              <div className="grid gap-3">
                {levelsQuery.data?.levels.map((level) => (
                  <div
                    key={level.inventoryItemId}
                    className="grid gap-3 rounded-card border border-border bg-surface/70 p-3 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {level.item.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {level.quantityOnHand} {humanizeInventoryValue(level.item.unit)}
                        {level.lowStockThresholdQuantity !== null &&
                        level.lowStockThresholdQuantity !== undefined
                          ? ` · threshold ${level.lowStockThresholdQuantity}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant={inventoryStatusBadgeVariant(level.stockStatus)}>
                      {humanizeInventoryValue(level.stockStatus)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Menu item requirements</CardTitle>
              <CardDescription>
                Link menu items to the stock quantities they consume on cashier
                accept.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <select
                value={activeMenuItemId}
                onChange={(event) => {
                  setSelectedMenuItemId(event.target.value);
                  setRequirementForm(emptyRequirementForm);
                }}
                className={selectClassName}
              >
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {selectedMenuItem ? (
                <p className="text-sm text-muted-foreground">
                  Requirements for{" "}
                  <span className="font-semibold text-foreground">
                    {selectedMenuItem.name}
                  </span>
                </p>
              ) : null}
              {canManageInventory && activeMenuItemId ? (
                <form onSubmit={handleAddRequirement} className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_9rem_auto]">
                    <select
                      value={requirementForm.inventoryItemId}
                      onChange={(event) =>
                        setRequirementForm((current) => ({
                          ...current,
                          inventoryItemId: event.target.value
                        }))
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
                    <Input
                      value={requirementForm.quantityRequired}
                      onChange={(event) =>
                        setRequirementForm((current) => ({
                          ...current,
                          quantityRequired: event.target.value
                        }))
                      }
                      placeholder="Qty"
                      inputMode="numeric"
                      required
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={requirementForm.isRequired}
                        onChange={(event) =>
                          setRequirementForm((current) => ({
                            ...current,
                            isRequired: event.target.checked
                          }))
                        }
                      />
                      Required
                    </label>
                  </div>
                  <Button
                    type="submit"
                    disabled={requirementsMutation.isPending}
                    className="w-fit"
                  >
                    <Save className="size-4" aria-hidden="true" />
                    Save requirement
                  </Button>
                </form>
              ) : null}
              <div className="grid gap-3">
                {requirementsQuery.data?.requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface/70 p-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {requirement.inventoryItem.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {requirement.quantityRequired}{" "}
                        {humanizeInventoryValue(requirement.unit)} per item
                        {requirement.isRequired ? "" : " · optional"}
                      </p>
                    </div>
                    {canManageInventory ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={requirementsMutation.isPending}
                        onClick={() =>
                          replaceRequirements(
                            (requirementsQuery.data?.requirements ?? [])
                              .filter((entry) => entry.id !== requirement.id)
                              .map((entry) => ({
                                inventoryItemId: entry.inventoryItemId,
                                quantityRequired: entry.quantityRequired,
                                isRequired: entry.isRequired
                              }))
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                {requirementsQuery.isSuccess &&
                (requirementsQuery.data?.requirements.length ?? 0) === 0 ? (
                  <EmptyState
                    title="No stock requirements"
                    description="This menu item is not stock-gated yet."
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle>Menu availability by stock</CardTitle>
              <CardDescription>
                Computed only. Manual menu availability remains independent.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {menuAvailabilityQuery.data?.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="grid gap-3 rounded-card border border-border bg-surface/70 p-3 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.canOrder
                        ? "Can order"
                        : item.reasons.map(humanizeInventoryValue).join(", ") ||
                          "Unavailable"}
                    </p>
                    {item.missingRequirements.length > 0 ? (
                      <p className="mt-2 text-sm text-danger">
                        Missing{" "}
                        {item.missingRequirements
                          .map(
                            (requirement) =>
                              `${requirement.name} (${requirement.shortageQuantity})`
                          )
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.canOrder ? "success" : "danger"}>
                      {item.canOrder ? "Can order" : "Blocked"}
                    </Badge>
                    <Badge variant={inventoryStatusBadgeVariant(item.stockStatus)}>
                      {humanizeInventoryValue(item.stockStatus)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card variant="quiet">
          <CardHeader>
            <CardTitle>Recent movements</CardTitle>
            <CardDescription>
              Latest manual adjustments and sale consumption records for this
              branch.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {alertsQuery.data?.recentMovements.map((movement) => (
              <div
                key={movement.id}
                className="grid gap-3 rounded-card border border-border bg-surface/70 p-3 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {movement.inventoryItem?.name ?? movement.inventoryItemId}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {humanizeInventoryValue(movement.type)} · delta{" "}
                    {movement.quantityDelta} · after {movement.quantityAfter}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(movement.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {alertsQuery.data?.recentMovements.length === 0 ? (
              <EmptyState
                title="No movement history"
                description="Adjust stock or accept an inventory-linked order to create movements."
              />
            ) : null}
          </CardContent>
        </Card>

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
