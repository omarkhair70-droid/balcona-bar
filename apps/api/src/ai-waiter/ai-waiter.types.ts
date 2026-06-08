import {
  AiWaiterMessageKind,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
} from "@prisma/client";

export interface AiWaiterModifierOptionSnapshot {
  id: string;
  groupId: string;
  name: string;
  slug: string;
}

export interface AiWaiterModifierGroupSnapshot {
  id: string;
  name: string;
  slug: string;
  selectionType: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: AiWaiterModifierOptionSnapshot[];
}

export interface AiWaiterMenuItemSnapshot {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  currency: string;
  isFeatured: boolean;
  category?: {
    id?: string;
    name?: string;
    slug?: string;
  } | null;
  modifierGroups: AiWaiterModifierGroupSnapshot[];
}

export interface AiWaiterRecentMessage {
  role: string;
  kind: string;
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AiWaiterOperationalContext {
  generatedAt: string;
  sessionAgeMinutes?: number;
  table?: {
    id: string;
    label?: string | null;
    status?: string;
    capacity?: number | null;
    floor?: { id: string; name: string } | null;
  };
  cart?: {
    itemCount: number;
    totalQuantity: number;
    hasOpenCart: boolean;
    items: Array<{
      id: string;
      menuItemId: string;
      name: string;
      quantity: number;
      notes?: string | null;
      modifierLabels: string[];
    }>;
  };
  orders?: {
    activeCount: number;
    latest?: {
      id: string;
      orderNumber?: string | null;
      status: string;
      customerStatus?: string;
      submittedAt?: string | null;
      acceptedAt?: string | null;
      readyAt?: string | null;
      servedAt?: string | null;
      completedAt?: string | null;
      itemCount: number;
      preparationSummary?: {
        pending: number;
        preparing: number;
        ready: number;
        cancelled: number;
        stations: string[];
      };
    };
    recent: Array<{
      id: string;
      orderNumber?: string | null;
      status: string;
      customerStatus?: string;
      itemCount: number;
      submittedAt?: string | null;
    }>;
  };
  bill?: {
    activeBillRequestId?: string | null;
    activeBillRequestStatus?: string | null;
    hasBillableOrders: boolean;
    billStatus?: string | null;
    paymentStatus?: string | null;
    receiptAvailable?: boolean;
  };
  waiterCalls?: {
    activeCount: number;
    latest?: {
      id: string;
      type: string;
      status: string;
      priority: number;
      createdAt: string;
      message?: string | null;
    };
  };
  attention?: {
    status?: string;
    priority?: string;
    score?: number;
    reasons?: string[];
    recommendedActions?: string[];
  };
  branchOps?: {
    operatingMode?: string;
    serviceMode?: string;
    aiWaiterEnabled?: boolean;
    waiterCallsEnabled?: boolean;
    billFlowEnabled?: boolean;
    tableAttentionEnabled?: boolean;
  };
}

export interface AiWaiterContext {
  tableSession: {
    id: string;
    companyId: string;
    branchId: string;
    tableId: string;
    status: string;
    guestLabel?: string | null;
    partySize?: number | null;
    startedAt?: Date | null;
    expiresAt?: Date | null;
    createdAt?: Date | null;
  };
  branch: {
    id: string;
    companyId: string;
    name: string;
    slug: string;
  };
  effectiveExperience: {
    profileId?: string;
    key?: string;
    name?: string;
    language?: string;
    brandVoice?: unknown;
    aiWaiterTone?: unknown;
  };
  cartSummary: unknown;
  recentMessages: AiWaiterRecentMessage[];
  menuItems: AiWaiterMenuItemSnapshot[];
  operationalContext?: AiWaiterOperationalContext;
}

export interface AiWaiterProposalItem {
  menuItemId: string;
  quantity: number;
  modifierOptionIds?: string[];
  customerNote?: string;
}

export interface AiWaiterProviderToolCall {
  toolName: AiWaiterToolName;
  status?: AiWaiterToolCallStatus;
  input?: unknown;
  output?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface AiWaiterProviderResult {
  content: string;
  kind: AiWaiterMessageKind;
  suggestedActions: string[];
  proposal?: {
    title?: string;
    items: AiWaiterProposalItem[];
    expiresAt?: Date;
  };
  toolCalls: AiWaiterProviderToolCall[];
  metadata?: Record<string, unknown>;
}

export interface AiWaiterProvider {
  readonly name: string;
  respond(
    context: AiWaiterContext,
    input: { message: string; language: string },
  ): Promise<AiWaiterProviderResult> | AiWaiterProviderResult;
}
