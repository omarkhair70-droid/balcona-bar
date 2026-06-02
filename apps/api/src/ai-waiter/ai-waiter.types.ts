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
  modifierGroups: AiWaiterModifierGroupSnapshot[];
}

export interface AiWaiterRecentMessage {
  role: string;
  kind: string;
  content: string;
  createdAt: Date;
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
    expiresAt?: Date | null;
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
