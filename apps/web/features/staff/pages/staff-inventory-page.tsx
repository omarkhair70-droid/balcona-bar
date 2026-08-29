"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Gauge,
  History,
  Loader2,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  ReceiptText,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Truck,
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
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
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
  addPurchaseOrderLine,
  cancelPurchaseOrder,
  createInventoryItem,
  createPurchaseOrder,
  createSupplier,
  getBranchInventoryAlerts,
  getBranchInventoryLevels,
  getBranchInventoryMenuAvailability,
  getBranchInventoryReceipts,
  getBranchMenuAdminOverview,
  getBranchPurchaseOrders,
  getBranchSuppliers,
  getInventoryItems,
  getMenuItemInventoryRequirements,
  receivePurchaseOrder,
  removePurchaseOrderLine,
  submitPurchaseOrder,
  updateInventoryItem,
  updateMenuItemInventoryRequirements,
  updatePurchaseOrder,
  updatePurchaseOrderLine,
  updateSupplier
} from "@/lib/api/endpoints";
import { customerQueryKeys, staffQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import type {
  AdjustInventoryLevelPayload,
  CreatePurchaseOrderLinePayload,
  CreatePurchaseOrderPayload,
  CreateSupplierPayload,
  InventoryReceipt,
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
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  ReceivePurchaseOrderPayload,
  ReplaceMenuItemInventoryRequirementsPayload,
  Supplier,
  SupplierStatus,
  UpdateInventoryItemPayload,
  UpdatePurchaseOrderLinePayload,
  UpdatePurchaseOrderPayload,
  UpdateSupplierPayload
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

type SupplierFormState = {
  id: string | null;
  name: string;
  contact: string;
  phone: string;
  email: string;
  taxId: string;
  address: string;
  notes: string;
  status: SupplierStatus;
};

type PurchaseOrderFormState = {
  id: string | null;
  supplierId: string;
  expectedAt: string;
  notes: string;
  currency: string;
};

type PurchaseOrderLineFormState = {
  id: string | null;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantityOrdered: string;
  unitCostEgp: string;
  notes: string;
};

type ReceivingFormState = {
  purchaseOrderId: string;
  receivedAt: string;
  notes: string;
  quantitiesByLineId: Record<string, string>;
  unitCostByLineId: Record<string, string>;
};

type InventoryTab =
  | "overview"
  | "items"
  | "levels"
  | "alerts"
  | "adjustments"
  | "suppliers"
  | "purchase_orders"
  | "receiving"
  | "requirements"
  | "availability"
  | "movements";

const inventoryTabs: Array<{ id: InventoryTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "items", label: "Items" },
  { id: "levels", label: "Stock levels" },
  { id: "alerts", label: "Alerts" },
  { id: "adjustments", label: "Adjustments" },
  { id: "suppliers", label: "Suppliers" },
  { id: "purchase_orders", label: "Purchase orders" },
  { id: "receiving", label: "Receiving" },
  { id: "requirements", label: "Requirements" },
  { id: "availability", label: "Menu availability" },
  { id: "movements", label: "Recent movements" }
];

const supplierStatuses: SupplierStatus[] = ["active", "inactive", "archived"];
const receivablePurchaseOrderStatuses = new Set<PurchaseOrderStatus>([
  "submitted",
  "partially_received"
]);

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

const emptySupplierForm: SupplierFormState = {
  id: null,
  name: "",
  contact: "",
  phone: "",
  email: "",
  taxId: "",
  address: "",
  notes: "",
  status: "active"
};

const emptyPurchaseOrderForm: PurchaseOrderFormState = {
  id: null,
  supplierId: "",
  expectedAt: "",
  notes: "",
  currency: "EGP"
};

const emptyPurchaseOrderLineForm: PurchaseOrderLineFormState = {
  id: null,
  purchaseOrderId: "",
  inventoryItemId: "",
  quantityOrdered: "",
  unitCostEgp: "",
  notes: ""
};

const emptyReceivingForm: ReceivingFormState = {
  purchaseOrderId: "",
  receivedAt: "",
  notes: "",
  quantitiesByLineId: {},
  unitCostByLineId: {}
};

const emptyInventoryItems: InventoryItem[] = [];
const emptyInventoryLevels: InventoryLevel[] = [];
const emptyInventoryMovements: InventoryMovement[] = [];
const emptyMenuAvailabilityItems: InventoryMenuAvailabilityItem[] = [];
const emptySuppliers: Supplier[] = [];
const emptyPurchaseOrders: PurchaseOrder[] = [];
const emptyInventoryReceipts: InventoryReceipt[] = [];

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

function optionalText(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function toSupplierPayload(
  form: SupplierFormState
): CreateSupplierPayload | UpdateSupplierPayload {
  return {
    name: form.name.trim(),
    contact: optionalText(form.contact),
    phone: optionalText(form.phone),
    email: optionalText(form.email),
    taxId: optionalText(form.taxId),
    address: optionalText(form.address),
    notes: optionalText(form.notes),
    status: form.status
  };
}

function toSupplierForm(supplier: Supplier): SupplierFormState {
  return {
    id: supplier.id,
    name: supplier.name,
    contact: supplier.contact ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    taxId: supplier.taxId ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
    status: supplier.status
  };
}

function toPurchaseOrderPayload(
  form: PurchaseOrderFormState
): CreatePurchaseOrderPayload | UpdatePurchaseOrderPayload {
  return {
    supplierId: form.supplierId,
    expectedAt: optionalText(form.expectedAt),
    notes: optionalText(form.notes),
    currency: form.currency.trim().toUpperCase() || "EGP"
  };
}

function toPurchaseOrderForm(order: PurchaseOrder): PurchaseOrderFormState {
  return {
    id: order.id,
    supplierId: order.supplierId,
    expectedAt: order.expectedAt ? order.expectedAt.slice(0, 10) : "",
    notes: order.notes ?? "",
    currency: order.currency
  };
}

function moneyInputToMinor(value: string, label: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative amount.`);
  }

  return Math.round(parsed * 100);
}

function optionalMoneyInputToMinor(value: string, label: string) {
  return value.trim().length === 0 ? null : moneyInputToMinor(value, label);
}

function minorToMoneyInput(value?: number | null) {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}

function formatMinor(value: number, currency = "EGP") {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function toPurchaseOrderLinePayload(
  form: PurchaseOrderLineFormState
): CreatePurchaseOrderLinePayload {
  return {
    inventoryItemId: form.inventoryItemId,
    quantityOrdered: inventoryInputToQuantity(
      form.quantityOrdered,
      "Ordered quantity"
    ),
    unitCostMinor: moneyInputToMinor(form.unitCostEgp, "Unit cost"),
    notes: optionalText(form.notes)
  };
}

function toPurchaseOrderLineForm(
  orderId: string,
  line: PurchaseOrderLine
): PurchaseOrderLineFormState {
  return {
    id: line.id,
    purchaseOrderId: orderId,
    inventoryItemId: line.inventoryItemId,
    quantityOrdered: quantityToInput(line.quantityOrdered),
    unitCostEgp: minorToMoneyInput(line.unitCostMinor),
    notes: line.notes ?? ""
  };
}

function purchaseOrderLineRemaining(line: PurchaseOrderLine) {
  return Math.max(0, line.quantityOrdered - line.quantityReceived);
}

function purchaseOrderEstimatedValue(order: PurchaseOrder) {
  return order.lines.reduce(
    (total, line) => total + line.quantityOrdered * line.unitCostMinor,
    0
  );
}

function purchaseOrderReceivedValue(order: PurchaseOrder) {
  return order.lines.reduce(
    (total, line) => total + line.quantityReceived * line.unitCostMinor,
    0
  );
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

function purchaseOrderStatusVariant(
  status: PurchaseOrderStatus
): "success" | "warning" | "danger" | "muted" {
  if (status === "received") {
    return "success";
  }

  if (status === "submitted" || status === "partially_received") {
    return "warning";
  }

  if (status === "cancelled") {
    return "danger";
  }

  return "muted";
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

  if (tabId === "suppliers") {
    return <Truck className="size-4" aria-hidden="true" />;
  }

  if (tabId === "purchase_orders") {
    return <FilePlus2 className="size-4" aria-hidden="true" />;
  }

  if (tabId === "receiving") {
    return <ReceiptText className="size-4" aria-hidden="true" />;
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
  const [supplierForm, setSupplierForm] =
    useState<SupplierFormState>(emptySupplierForm);
  const [purchaseOrderForm, setPurchaseOrderForm] =
    useState<PurchaseOrderFormState>(emptyPurchaseOrderForm);
  const [purchaseOrderLineForm, setPurchaseOrderLineForm] =
    useState<PurchaseOrderLineFormState>(emptyPurchaseOrderLineForm);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [receivingForm, setReceivingForm] =
    useState<ReceivingFormState>(emptyReceivingForm);
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
  const suppliersQuery = useQuery({
    queryKey: staffQueryKeys.branchSuppliers(selectedBranchId),
    queryFn: () =>
      getBranchSuppliers(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token),
    staleTime: 30_000
  });
  const purchaseOrdersQuery = useQuery({
    queryKey: staffQueryKeys.branchPurchaseOrders(selectedBranchId),
    queryFn: () =>
      getBranchPurchaseOrders(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token),
    staleTime: 30_000
  });
  const receiptsQuery = useQuery({
    queryKey: staffQueryKeys.branchInventoryReceipts(selectedBranchId),
    queryFn: () =>
      getBranchInventoryReceipts(selectedBranchId ?? "", token ?? undefined),
    enabled: Boolean(selectedBranchId && token),
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
  const suppliers = suppliersQuery.data?.suppliers ?? emptySuppliers;
  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.status === "active"
  );
  const purchaseOrders =
    purchaseOrdersQuery.data?.purchaseOrders ?? emptyPurchaseOrders;
  const selectedPurchaseOrder =
    purchaseOrders.find((order) => order.id === selectedPurchaseOrderId) ??
    purchaseOrders[0];
  const receivablePurchaseOrders = purchaseOrders.filter((order) =>
    receivablePurchaseOrderStatuses.has(order.status)
  );
  const activeReceivingPurchaseOrderId =
    receivingForm.purchaseOrderId || receivablePurchaseOrders[0]?.id || "";
  const selectedReceivingPurchaseOrder = purchaseOrders.find(
    (order) => order.id === activeReceivingPurchaseOrderId
  );
  const receipts = receiptsQuery.data?.receipts ?? emptyInventoryReceipts;
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
    requirementsQuery.error ??
    suppliersQuery.error ??
    purchaseOrdersQuery.error ??
    receiptsQuery.error;
  const isLoading =
    (canReadCompanyInventory && inventoryItemsQuery.isPending) ||
    levelsQuery.isPending ||
    alertsQuery.isPending ||
    menuAvailabilityQuery.isPending ||
    suppliersQuery.isPending ||
    purchaseOrdersQuery.isPending ||
    receiptsQuery.isPending;

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
        queryKey: staffQueryKeys.branchSuppliers(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.suppliers(companyId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchPurchaseOrders(selectedBranchId)
      }),
      queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchInventoryReceipts(selectedBranchId)
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
  const createSupplierMutation = useMutation({
    mutationFn: (payload: CreateSupplierPayload) =>
      createSupplier(companyId ?? "", payload, token ?? undefined),
    onSuccess: async (result) => {
      setSupplierForm(emptySupplierForm);
      setFormError(null);
      setSuccessMessage(`${result.supplier.name} was added as a supplier.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const updateSupplierMutation = useMutation({
    mutationFn: (input: {
      supplierId: string;
      payload: UpdateSupplierPayload;
    }) => updateSupplier(input.supplierId, input.payload, token ?? undefined),
    onSuccess: async (result) => {
      setSupplierForm(emptySupplierForm);
      setFormError(null);
      setSuccessMessage(`${result.supplier.name} was saved.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const createPurchaseOrderMutation = useMutation({
    mutationFn: (payload: CreatePurchaseOrderPayload) =>
      createPurchaseOrder(selectedBranchId ?? "", payload, token ?? undefined),
    onSuccess: async (result) => {
      setPurchaseOrderForm(emptyPurchaseOrderForm);
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setPurchaseOrderLineForm({
        ...emptyPurchaseOrderLineForm,
        purchaseOrderId: result.purchaseOrder.id
      });
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} was created.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const updatePurchaseOrderMutation = useMutation({
    mutationFn: (input: {
      purchaseOrderId: string;
      payload: UpdatePurchaseOrderPayload;
    }) =>
      updatePurchaseOrder(
        input.purchaseOrderId,
        input.payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setPurchaseOrderForm(emptyPurchaseOrderForm);
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} was saved.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const addPurchaseOrderLineMutation = useMutation({
    mutationFn: (input: {
      purchaseOrderId: string;
      payload: CreatePurchaseOrderLinePayload;
    }) =>
      addPurchaseOrderLine(
        input.purchaseOrderId,
        input.payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setPurchaseOrderLineForm({
        ...emptyPurchaseOrderLineForm,
        purchaseOrderId: result.purchaseOrder.id
      });
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} line was saved.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const updatePurchaseOrderLineMutation = useMutation({
    mutationFn: (input: {
      purchaseOrderId: string;
      purchaseOrderLineId: string;
      payload: UpdatePurchaseOrderLinePayload;
    }) =>
      updatePurchaseOrderLine(
        input.purchaseOrderId,
        input.purchaseOrderLineId,
        input.payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setPurchaseOrderLineForm({
        ...emptyPurchaseOrderLineForm,
        purchaseOrderId: result.purchaseOrder.id
      });
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} line was saved.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const removePurchaseOrderLineMutation = useMutation({
    mutationFn: (input: {
      purchaseOrderId: string;
      purchaseOrderLineId: string;
    }) =>
      removePurchaseOrderLine(
        input.purchaseOrderId,
        input.purchaseOrderLineId,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setPurchaseOrderLineForm({
        ...emptyPurchaseOrderLineForm,
        purchaseOrderId: result.purchaseOrder.id
      });
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} line was removed.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const submitPurchaseOrderMutation = useMutation({
    mutationFn: (purchaseOrderId: string) =>
      submitPurchaseOrder(purchaseOrderId, token ?? undefined),
    onSuccess: async (result) => {
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} was submitted.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const cancelPurchaseOrderMutation = useMutation({
    mutationFn: (purchaseOrderId: string) =>
      cancelPurchaseOrder(purchaseOrderId, token ?? undefined),
    onSuccess: async (result) => {
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(`${result.purchaseOrder.orderNumber} was cancelled.`);
      await invalidateInventory();
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getInventoryErrorMessage(error));
    }
  });
  const receivePurchaseOrderMutation = useMutation({
    mutationFn: (input: {
      purchaseOrderId: string;
      payload: ReceivePurchaseOrderPayload;
    }) =>
      receivePurchaseOrder(
        input.purchaseOrderId,
        input.payload,
        token ?? undefined
      ),
    onSuccess: async (result) => {
      setReceivingForm(emptyReceivingForm);
      setSelectedPurchaseOrderId(result.purchaseOrder.id);
      setFormError(null);
      setSuccessMessage(
        `${result.receipt?.receiptNumber ?? "Receipt"} posted for ${
          result.purchaseOrder.orderNumber
        }.`
      );
      await invalidateInventory();
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

  function handleSaveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageCompanyInventory) {
      setFormError("Supplier management requires company-level inventory access.");
      return;
    }

    try {
      const payload = toSupplierPayload(supplierForm);

      if (supplierForm.id) {
        updateSupplierMutation.mutate({
          supplierId: supplierForm.id,
          payload
        });
        return;
      }

      createSupplierMutation.mutate(payload as CreateSupplierPayload);
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  function handleSavePurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Purchase orders require branch-level inventory management.");
      return;
    }

    try {
      const payload = toPurchaseOrderPayload(purchaseOrderForm);

      if (!payload.supplierId) {
        setFormError("Choose an active supplier before saving the purchase order.");
        return;
      }

      if (purchaseOrderForm.id) {
        updatePurchaseOrderMutation.mutate({
          purchaseOrderId: purchaseOrderForm.id,
          payload
        });
        return;
      }

      createPurchaseOrderMutation.mutate(payload as CreatePurchaseOrderPayload);
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  function handleSavePurchaseOrderLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Purchase order lines require branch-level inventory management.");
      return;
    }

    const purchaseOrderId =
      purchaseOrderLineForm.purchaseOrderId || selectedPurchaseOrder?.id;

    if (!purchaseOrderId) {
      setFormError("Choose a draft purchase order before adding lines.");
      return;
    }

    try {
      const payload = toPurchaseOrderLinePayload(purchaseOrderLineForm);

      if (purchaseOrderLineForm.id) {
        const lineUpdatePayload: UpdatePurchaseOrderLinePayload = {
          quantityOrdered: payload.quantityOrdered,
          unitCostMinor: payload.unitCostMinor,
          notes: payload.notes
        };
        updatePurchaseOrderLineMutation.mutate({
          purchaseOrderId,
          purchaseOrderLineId: purchaseOrderLineForm.id,
          payload: lineUpdatePayload
        });
        return;
      }

      addPurchaseOrderLineMutation.mutate({
        purchaseOrderId,
        payload: payload as CreatePurchaseOrderLinePayload
      });
    } catch (error) {
      setFormError(getInventoryErrorMessage(error));
    }
  }

  function handleSubmitPurchaseOrder(order: PurchaseOrder) {
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Submitting purchase orders requires inventory management.");
      return;
    }

    submitPurchaseOrderMutation.mutate(order.id);
  }

  function handleCancelPurchaseOrder(order: PurchaseOrder) {
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Cancelling purchase orders requires inventory management.");
      return;
    }

    if (
      !window.confirm(`Cancel ${order.orderNumber}? This stops further receiving.`)
    ) {
      return;
    }

    cancelPurchaseOrderMutation.mutate(order.id);
  }

  function handleRemovePurchaseOrderLine(line: PurchaseOrderLine) {
    const purchaseOrderId = selectedPurchaseOrder?.id;

    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Removing purchase order lines requires inventory management.");
      return;
    }

    if (!purchaseOrderId) {
      setFormError("Choose a purchase order before removing a line.");
      return;
    }

    removePurchaseOrderLineMutation.mutate({
      purchaseOrderId,
      purchaseOrderLineId: line.id
    });
  }

  function handleReceivePurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!canManageBranchStock) {
      setFormError("Receiving requires branch-level inventory management.");
      return;
    }

    if (!selectedReceivingPurchaseOrder) {
      setFormError("Choose a submitted purchase order before receiving.");
      return;
    }

    try {
      const lines: ReceivePurchaseOrderPayload["lines"] = [];

      for (const line of selectedReceivingPurchaseOrder.lines) {
        const quantityValue = receivingForm.quantitiesByLineId[line.id] ?? "";

        if (quantityValue.trim().length === 0) {
          continue;
        }

        const quantityReceived = inventoryInputToQuantity(
          quantityValue,
          `${line.inventoryItem.name} received quantity`
        );
        const remaining = purchaseOrderLineRemaining(line);

        if (quantityReceived > remaining) {
          throw new Error(`${line.inventoryItem.name} cannot be over-received.`);
        }

        lines.push({
          purchaseOrderLineId: line.id,
          quantityReceived,
          unitCostMinor: optionalMoneyInputToMinor(
            receivingForm.unitCostByLineId[line.id] ?? "",
            `${line.inventoryItem.name} unit cost`
          )
        });
      }

      if (lines.length === 0) {
        setFormError("Enter at least one received quantity.");
        return;
      }

      receivePurchaseOrderMutation.mutate({
        purchaseOrderId: selectedReceivingPurchaseOrder.id,
        payload: {
          receivedAt: optionalText(receivingForm.receivedAt),
          notes: optionalText(receivingForm.notes),
          lines
        }
      });
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

        {activeTab === "suppliers" ? (
          <SuppliersSection
            canManageCompanyInventory={canManageCompanyInventory}
            supplierForm={supplierForm}
            suppliers={suppliers}
            isSaving={
              createSupplierMutation.isPending ||
              updateSupplierMutation.isPending
            }
            onFormChange={setSupplierForm}
            onSubmit={handleSaveSupplier}
            onEdit={setSupplierForm}
            onReset={() => setSupplierForm(emptySupplierForm)}
          />
        ) : null}

        {activeTab === "purchase_orders" ? (
          <PurchaseOrdersSection
            canManageBranchStock={canManageBranchStock}
            purchaseOrderForm={purchaseOrderForm}
            lineForm={purchaseOrderLineForm}
            suppliers={activeSuppliers}
            purchaseOrders={purchaseOrders}
            selectedPurchaseOrder={selectedPurchaseOrder}
            selectedPurchaseOrderId={selectedPurchaseOrder?.id ?? ""}
            inventoryItems={visibleInventoryItems}
            isSavingOrder={
              createPurchaseOrderMutation.isPending ||
              updatePurchaseOrderMutation.isPending
            }
            isSavingLine={
              addPurchaseOrderLineMutation.isPending ||
              updatePurchaseOrderLineMutation.isPending ||
              removePurchaseOrderLineMutation.isPending
            }
            isTransitioning={
              submitPurchaseOrderMutation.isPending ||
              cancelPurchaseOrderMutation.isPending
            }
            onOrderFormChange={setPurchaseOrderForm}
            onLineFormChange={setPurchaseOrderLineForm}
            onSubmitOrderForm={handleSavePurchaseOrder}
            onSubmitLineForm={handleSavePurchaseOrderLine}
            onSelectOrder={(order) => {
              setSelectedPurchaseOrderId(order.id);
              setPurchaseOrderLineForm({
                ...emptyPurchaseOrderLineForm,
                purchaseOrderId: order.id
              });
            }}
            onEditOrder={(order) => setPurchaseOrderForm(toPurchaseOrderForm(order))}
            onEditLine={(line) => {
              if (!selectedPurchaseOrder) {
                return;
              }

              setPurchaseOrderLineForm(
                toPurchaseOrderLineForm(selectedPurchaseOrder.id, line)
              );
            }}
            onRemoveLine={handleRemovePurchaseOrderLine}
            onSubmitPurchaseOrder={handleSubmitPurchaseOrder}
            onCancelPurchaseOrder={handleCancelPurchaseOrder}
            onResetOrder={() => setPurchaseOrderForm(emptyPurchaseOrderForm)}
            onResetLine={() =>
              setPurchaseOrderLineForm({
                ...emptyPurchaseOrderLineForm,
                purchaseOrderId: selectedPurchaseOrder?.id ?? ""
              })
            }
          />
        ) : null}

        {activeTab === "receiving" ? (
          <ReceivingSection
            canManageBranchStock={canManageBranchStock}
            purchaseOrders={receivablePurchaseOrders}
            selectedPurchaseOrder={selectedReceivingPurchaseOrder}
            activePurchaseOrderId={activeReceivingPurchaseOrderId}
            receivingForm={receivingForm}
            receipts={receipts}
            isSaving={receivePurchaseOrderMutation.isPending}
            onPurchaseOrderChange={(purchaseOrderId) =>
              setReceivingForm({
                ...emptyReceivingForm,
                purchaseOrderId
              })
            }
            onFormChange={setReceivingForm}
            onSubmit={handleReceivePurchaseOrder}
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

function SuppliersSection({
  canManageCompanyInventory,
  supplierForm,
  suppliers,
  isSaving,
  onFormChange,
  onSubmit,
  onEdit,
  onReset
}: {
  canManageCompanyInventory: boolean;
  supplierForm: SupplierFormState;
  suppliers: Supplier[];
  isSaving: boolean;
  onFormChange: (form: SupplierFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (form: SupplierFormState) => void;
  onReset: () => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Company suppliers</Badge>
          <CardTitle>
            {supplierForm.id ? "Edit supplier" : "Create supplier"}
          </CardTitle>
          <CardDescription>
            Suppliers are company-scoped and can be used by branch purchase
            orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManageCompanyInventory ? (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Name">
                  <Input
                    value={supplierForm.name}
                    onChange={(event) =>
                      onFormChange({ ...supplierForm, name: event.target.value })
                    }
                    placeholder="Cairo Dairy"
                    required
                  />
                </FieldLabel>
                <FieldLabel label="Contact">
                  <Input
                    value={supplierForm.contact}
                    onChange={(event) =>
                      onFormChange({
                        ...supplierForm,
                        contact: event.target.value
                      })
                    }
                    placeholder="Nour"
                  />
                </FieldLabel>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Phone">
                  <Input
                    value={supplierForm.phone}
                    onChange={(event) =>
                      onFormChange({ ...supplierForm, phone: event.target.value })
                    }
                    placeholder="01000000000"
                  />
                </FieldLabel>
                <FieldLabel label="Email">
                  <Input
                    type="email"
                    value={supplierForm.email}
                    onChange={(event) =>
                      onFormChange({ ...supplierForm, email: event.target.value })
                    }
                    placeholder="orders@example.com"
                  />
                </FieldLabel>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Tax ID">
                  <Input
                    value={supplierForm.taxId}
                    onChange={(event) =>
                      onFormChange({ ...supplierForm, taxId: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </FieldLabel>
                <FieldLabel label="Status">
                  <select
                    value={supplierForm.status}
                    onChange={(event) =>
                      onFormChange({
                        ...supplierForm,
                        status: event.target.value as SupplierStatus
                      })
                    }
                    className={selectClassName}
                  >
                    {supplierStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeInventoryValue(status)}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>
              <FieldLabel label="Address">
                <textarea
                  value={supplierForm.address}
                  onChange={(event) =>
                    onFormChange({ ...supplierForm, address: event.target.value })
                  }
                  className={textareaClassName}
                  placeholder="Delivery address or supplier address"
                />
              </FieldLabel>
              <FieldLabel label="Notes">
                <textarea
                  value={supplierForm.notes}
                  onChange={(event) =>
                    onFormChange({ ...supplierForm, notes: event.target.value })
                  }
                  className={textareaClassName}
                  placeholder="Payment terms, order days, contact notes"
                />
              </FieldLabel>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  {supplierForm.id ? "Save supplier" : "Create supplier"}
                </Button>
                {supplierForm.id ? (
                  <Button type="button" variant="secondary" onClick={onReset}>
                    Reset
                  </Button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
              Supplier create/edit requires company-level inventory management.
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <Badge variant="muted">Supplier directory</Badge>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>
            Branch purchase orders can use active suppliers from this company.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{supplier.name}</p>
                  <Badge
                    variant={supplier.status === "active" ? "success" : "muted"}
                  >
                    {humanizeInventoryValue(supplier.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {supplier.contact ?? "No contact"} /{" "}
                  {supplier.phone ?? "No phone"} /{" "}
                  {supplier.email ?? "No email"}
                </p>
                {supplier.notes ? (
                  <p className="mt-2 rounded-button border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {supplier.notes}
                  </p>
                ) : null}
              </div>
              {canManageCompanyInventory ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(toSupplierForm(supplier))}
                >
                  Edit
                </Button>
              ) : null}
            </div>
          ))}
          {suppliers.length === 0 ? (
            <EmptyState
              title="No suppliers yet"
              description="Create active suppliers before drafting purchase orders."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function PurchaseOrdersSection({
  canManageBranchStock,
  purchaseOrderForm,
  lineForm,
  suppliers,
  purchaseOrders,
  selectedPurchaseOrder,
  selectedPurchaseOrderId,
  inventoryItems,
  isSavingOrder,
  isSavingLine,
  isTransitioning,
  onOrderFormChange,
  onLineFormChange,
  onSubmitOrderForm,
  onSubmitLineForm,
  onSelectOrder,
  onEditOrder,
  onEditLine,
  onRemoveLine,
  onSubmitPurchaseOrder,
  onCancelPurchaseOrder,
  onResetOrder,
  onResetLine
}: {
  canManageBranchStock: boolean;
  purchaseOrderForm: PurchaseOrderFormState;
  lineForm: PurchaseOrderLineFormState;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  selectedPurchaseOrder?: PurchaseOrder;
  selectedPurchaseOrderId: string;
  inventoryItems: InventoryItem[];
  isSavingOrder: boolean;
  isSavingLine: boolean;
  isTransitioning: boolean;
  onOrderFormChange: (form: PurchaseOrderFormState) => void;
  onLineFormChange: (form: PurchaseOrderLineFormState) => void;
  onSubmitOrderForm: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitLineForm: (event: FormEvent<HTMLFormElement>) => void;
  onSelectOrder: (order: PurchaseOrder) => void;
  onEditOrder: (order: PurchaseOrder) => void;
  onEditLine: (line: PurchaseOrderLine) => void;
  onRemoveLine: (line: PurchaseOrderLine) => void;
  onSubmitPurchaseOrder: (order: PurchaseOrder) => void;
  onCancelPurchaseOrder: (order: PurchaseOrder) => void;
  onResetOrder: () => void;
  onResetLine: () => void;
}) {
  const selectedIsDraft = selectedPurchaseOrder?.status === "draft";
  const linePurchaseOrderId = lineForm.purchaseOrderId || selectedPurchaseOrderId;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid gap-4">
        <Card variant="quiet">
          <CardHeader>
            <Badge variant="muted">Purchase order</Badge>
            <CardTitle>
              {purchaseOrderForm.id ? "Edit draft PO" : "Create draft PO"}
            </CardTitle>
            <CardDescription>
              Draft and submitted purchase orders do not change stock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageBranchStock ? (
              <form onSubmit={onSubmitOrderForm} className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldLabel label="Supplier">
                    <select
                      value={purchaseOrderForm.supplierId}
                      onChange={(event) =>
                        onOrderFormChange({
                          ...purchaseOrderForm,
                          supplierId: event.target.value
                        })
                      }
                      className={selectClassName}
                      required
                    >
                      <option value="">Choose active supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Expected date">
                    <Input
                      type="date"
                      value={purchaseOrderForm.expectedAt}
                      onChange={(event) =>
                        onOrderFormChange({
                          ...purchaseOrderForm,
                          expectedAt: event.target.value
                        })
                      }
                    />
                  </FieldLabel>
                </div>
                <div className="grid gap-4 md:grid-cols-[9rem_1fr]">
                  <FieldLabel label="Currency">
                    <Input
                      value={purchaseOrderForm.currency}
                      onChange={(event) =>
                        onOrderFormChange({
                          ...purchaseOrderForm,
                          currency: event.target.value
                        })
                      }
                      maxLength={8}
                    />
                  </FieldLabel>
                  <FieldLabel label="Notes">
                    <Input
                      value={purchaseOrderForm.notes}
                      onChange={(event) =>
                        onOrderFormChange({
                          ...purchaseOrderForm,
                          notes: event.target.value
                        })
                      }
                      placeholder="Delivery window or supplier reference"
                    />
                  </FieldLabel>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isSavingOrder}>
                    {isSavingOrder ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <FilePlus2 className="size-4" aria-hidden="true" />
                    )}
                    {purchaseOrderForm.id ? "Save PO" : "Create PO"}
                  </Button>
                  {purchaseOrderForm.id ? (
                    <Button type="button" variant="secondary" onClick={onResetOrder}>
                      Reset
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
                Purchase order creation requires branch-level inventory
                management.
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <Badge variant="muted">Draft line</Badge>
            <CardTitle>{lineForm.id ? "Edit line" : "Add line"}</CardTitle>
            <CardDescription>
              Lines can only be changed while the purchase order is draft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageBranchStock && selectedIsDraft ? (
              <form onSubmit={onSubmitLineForm} className="grid gap-4">
                <input type="hidden" value={linePurchaseOrderId} readOnly />
                <div className="grid gap-4 md:grid-cols-[1fr_8rem_9rem]">
                  <FieldLabel label="Stock item">
                    <select
                      value={lineForm.inventoryItemId}
                      onChange={(event) =>
                        onLineFormChange({
                          ...lineForm,
                          purchaseOrderId: linePurchaseOrderId,
                          inventoryItemId: event.target.value
                        })
                      }
                      className={selectClassName}
                      disabled={Boolean(lineForm.id)}
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
                      value={lineForm.quantityOrdered}
                      onChange={(event) =>
                        onLineFormChange({
                          ...lineForm,
                          quantityOrdered: event.target.value
                        })
                      }
                      required
                    />
                  </FieldLabel>
                  <FieldLabel label="Unit cost EGP">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={lineForm.unitCostEgp}
                      onChange={(event) =>
                        onLineFormChange({
                          ...lineForm,
                          unitCostEgp: event.target.value
                        })
                      }
                      required
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="Notes">
                  <Input
                    value={lineForm.notes}
                    onChange={(event) =>
                      onLineFormChange({ ...lineForm, notes: event.target.value })
                    }
                    placeholder="Pack size, brand, delivery note"
                  />
                </FieldLabel>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isSavingLine}>
                    {isSavingLine ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    {lineForm.id ? "Save line" : "Add line"}
                  </Button>
                  {lineForm.id ? (
                    <Button type="button" variant="secondary" onClick={onResetLine}>
                      Reset
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
                Choose a draft purchase order to add or edit lines.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card variant="glass">
          <CardHeader>
            <Badge variant="muted">Selected PO</Badge>
            <CardTitle>
              {selectedPurchaseOrder?.orderNumber ?? "No purchase order selected"}
            </CardTitle>
            <CardDescription>
              Submit when the draft is ready. Receiving happens in the Receiving
              tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {selectedPurchaseOrder ? (
              <>
                <div className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {selectedPurchaseOrder.supplier.name}
                      </p>
                      <Badge
                        variant={purchaseOrderStatusVariant(
                          selectedPurchaseOrder.status
                        )}
                      >
                        {humanizeInventoryValue(selectedPurchaseOrder.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Expected{" "}
                      {selectedPurchaseOrder.expectedAt
                        ? new Date(
                            selectedPurchaseOrder.expectedAt
                          ).toLocaleDateString()
                        : "not set"}{" "}
                      / Estimate{" "}
                      {formatMinor(
                        purchaseOrderEstimatedValue(selectedPurchaseOrder),
                        selectedPurchaseOrder.currency
                      )}{" "}
                      / Received{" "}
                      {formatMinor(
                        purchaseOrderReceivedValue(selectedPurchaseOrder),
                        selectedPurchaseOrder.currency
                      )}
                    </p>
                    {selectedPurchaseOrder.notes ? (
                      <p className="mt-2 rounded-button border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        {selectedPurchaseOrder.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {selectedPurchaseOrder.status === "draft" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onEditOrder(selectedPurchaseOrder)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            selectedPurchaseOrder.lines.length === 0 ||
                            isTransitioning
                          }
                          onClick={() =>
                            onSubmitPurchaseOrder(selectedPurchaseOrder)
                          }
                        >
                          <Send className="size-3.5" aria-hidden="true" />
                          Submit
                        </Button>
                      </>
                    ) : null}
                    {selectedPurchaseOrder.status !== "received" &&
                    selectedPurchaseOrder.status !== "cancelled" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isTransitioning}
                        onClick={() => onCancelPurchaseOrder(selectedPurchaseOrder)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>

                {selectedPurchaseOrder.lines.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {line.inventoryItem.name}
                        </p>
                        <Badge variant="muted">
                          {humanizeInventoryValue(line.inventoryItem.unit)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ordered {line.quantityOrdered} / Received{" "}
                        {line.quantityReceived} / Remaining{" "}
                        {purchaseOrderLineRemaining(line)} / Unit{" "}
                        {formatMinor(
                          line.unitCostMinor,
                          selectedPurchaseOrder.currency
                        )}
                      </p>
                      {line.notes ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {line.notes}
                        </p>
                      ) : null}
                    </div>
                    {selectedPurchaseOrder.status === "draft" &&
                    canManageBranchStock ? (
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onEditLine(line)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={isSavingLine}
                          onClick={() => onRemoveLine(line)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {selectedPurchaseOrder.lines.length === 0 ? (
                  <EmptyState
                    title="No PO lines"
                    description="Add at least one stock item before submitting."
                  />
                ) : null}
              </>
            ) : (
              <EmptyState
                title="No purchase orders yet"
                description="Create a draft purchase order to start supplier purchasing."
              />
            )}
          </CardContent>
        </Card>

        <Card variant="quiet">
          <CardHeader>
            <Badge variant="muted">PO list</Badge>
            <CardTitle>Purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {purchaseOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder(order)}
                className={`grid gap-2 rounded-card border p-4 text-left transition hover:border-primary/60 ${
                  selectedPurchaseOrderId === order.id
                    ? "border-primary bg-primary/10"
                    : "bg-surface/70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{order.orderNumber}</span>
                  <Badge variant={purchaseOrderStatusVariant(order.status)}>
                    {humanizeInventoryValue(order.status)}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {order.supplier.name} / {order.lines.length} line
                  {order.lines.length === 1 ? "" : "s"} /{" "}
                  {formatMinor(purchaseOrderEstimatedValue(order), order.currency)}
                </span>
              </button>
            ))}
            {purchaseOrders.length === 0 ? (
              <EmptyState
                title="No purchase orders"
                description="Draft a purchase order after creating suppliers and stock items."
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ReceivingSection({
  canManageBranchStock,
  purchaseOrders,
  selectedPurchaseOrder,
  activePurchaseOrderId,
  receivingForm,
  receipts,
  isSaving,
  onPurchaseOrderChange,
  onFormChange,
  onSubmit
}: {
  canManageBranchStock: boolean;
  purchaseOrders: PurchaseOrder[];
  selectedPurchaseOrder?: PurchaseOrder;
  activePurchaseOrderId: string;
  receivingForm: ReceivingFormState;
  receipts: InventoryReceipt[];
  isSaving: boolean;
  onPurchaseOrderChange: (purchaseOrderId: string) => void;
  onFormChange: (form: ReceivingFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const remainingLines =
    selectedPurchaseOrder?.lines.filter(
      (line) => purchaseOrderLineRemaining(line) > 0
    ) ?? [];

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card variant="glass">
        <CardHeader>
          <Badge variant="warning">Stock-in from PO</Badge>
          <CardTitle>Receive purchase order</CardTitle>
          <CardDescription>
            Receiving creates a receipt, stock-in movements, and updates PO
            received quantities in one transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManageBranchStock ? (
            <form onSubmit={onSubmit} className="grid gap-4">
              <FieldLabel label="Purchase order">
                <select
                  value={activePurchaseOrderId}
                  onChange={(event) => onPurchaseOrderChange(event.target.value)}
                  className={selectClassName}
                  required
                >
                  <option value="">Choose submitted or partial PO</option>
                  {purchaseOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} / {order.supplier.name} /{" "}
                      {humanizeInventoryValue(order.status)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
                <FieldLabel label="Received date">
                  <Input
                    type="date"
                    value={receivingForm.receivedAt}
                    onChange={(event) =>
                      onFormChange({
                        ...receivingForm,
                        purchaseOrderId: activePurchaseOrderId,
                        receivedAt: event.target.value
                      })
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Receipt note">
                  <Input
                    value={receivingForm.notes}
                    onChange={(event) =>
                      onFormChange({
                        ...receivingForm,
                        purchaseOrderId: activePurchaseOrderId,
                        notes: event.target.value
                      })
                    }
                    placeholder="Delivery note or supplier reference"
                  />
                </FieldLabel>
              </div>

              <div className="grid gap-3">
                {remainingLines.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-3 rounded-card border bg-surface/70 p-4 md:grid-cols-[1fr_8rem_9rem]"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {line.inventoryItem.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ordered {line.quantityOrdered} / Received{" "}
                        {line.quantityReceived} / Remaining{" "}
                        {purchaseOrderLineRemaining(line)}{" "}
                        {humanizeInventoryValue(line.inventoryItem.unit)}
                      </p>
                    </div>
                    <FieldLabel label="Receive">
                      <Input
                        type="number"
                        min="0"
                        max={purchaseOrderLineRemaining(line)}
                        step="1"
                        value={receivingForm.quantitiesByLineId[line.id] ?? ""}
                        onChange={(event) =>
                          onFormChange({
                            ...receivingForm,
                            purchaseOrderId: activePurchaseOrderId,
                            quantitiesByLineId: {
                              ...receivingForm.quantitiesByLineId,
                              [line.id]: event.target.value
                            }
                          })
                        }
                        placeholder="0"
                      />
                    </FieldLabel>
                    <FieldLabel label="Unit cost EGP">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={receivingForm.unitCostByLineId[line.id] ?? ""}
                        onChange={(event) =>
                          onFormChange({
                            ...receivingForm,
                            purchaseOrderId: activePurchaseOrderId,
                            unitCostByLineId: {
                              ...receivingForm.unitCostByLineId,
                              [line.id]: event.target.value
                            }
                          })
                        }
                        placeholder={minorToMoneyInput(line.unitCostMinor)}
                      />
                    </FieldLabel>
                  </div>
                ))}
                {selectedPurchaseOrder && remainingLines.length === 0 ? (
                  <EmptyState
                    title="No remaining quantities"
                    description="This purchase order has no receivable lines left."
                  />
                ) : null}
                {!selectedPurchaseOrder ? (
                  <EmptyState
                    title="No receivable purchase order selected"
                    description="Submit a purchase order before receiving stock."
                  />
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={isSaving || !selectedPurchaseOrder || remainingLines.length === 0}
                className="w-fit"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ReceiptText className="size-4" aria-hidden="true" />
                )}
                Confirm receipt
              </Button>
            </form>
          ) : (
            <div className="rounded-card border bg-muted/40 p-3 text-sm text-muted-foreground">
              Receiving purchase orders requires branch-level inventory
              management.
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted">Receipt history</Badge>
          <CardTitle>Recent receipts</CardTitle>
          <CardDescription>
            Receipts show the source PO and the stock items received.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="rounded-card border bg-surface/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {receipt.receiptNumber}
                </p>
                <Badge variant="success">
                  {new Date(receipt.receivedAt).toLocaleDateString()}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {receipt.supplier?.name ?? "Supplier not recorded"} /{" "}
                {receipt.lines.length} line{receipt.lines.length === 1 ? "" : "s"}
              </p>
              <div className="mt-3 grid gap-2">
                {receipt.lines.map((line) => (
                  <p
                    key={line.id}
                    className="rounded-button border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {line.inventoryItem.name}: {line.quantityReceived}{" "}
                    {humanizeInventoryValue(line.inventoryItem.unit)}
                    {line.unitCostMinor !== null &&
                    line.unitCostMinor !== undefined
                      ? ` / ${formatMinor(line.unitCostMinor)}`
                      : ""}
                  </p>
                ))}
              </div>
              {receipt.notes ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {receipt.notes}
                </p>
              ) : null}
            </div>
          ))}
          {receipts.length === 0 ? (
            <EmptyState
              title="No receipts yet"
              description="Confirmed receiving will appear here and in recent movements."
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
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
  const t = useTranslations("staff");

  return (
    <OfficeStaffShell
      activeDomain="inventory"
      title={t("office.inventoryTitle")}
      description={t("office.inventoryDescription")}
    >
      <StaffInventoryContent />
    </OfficeStaffShell>
  );
}
