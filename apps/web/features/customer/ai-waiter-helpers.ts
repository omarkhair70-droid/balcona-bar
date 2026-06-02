import type {
  AiWaiterLanguage,
  AiWaiterStateResult,
  BranchEffectiveExperience,
  MenuItemSummary
} from "@/lib/api/types";
import { formatMoney, getMenuItemPrice } from "./customer-format";

export type AiLanguageOption = {
  value: AiWaiterLanguage;
  label: string;
  dir: "ltr" | "rtl";
};

export const aiLanguageOptions: AiLanguageOption[] = [
  { value: "en", label: "English", dir: "ltr" },
  { value: "ar-EG", label: "العربية", dir: "rtl" }
];

export const aiSuggestedPrompts: Record<AiWaiterLanguage, string[]> = {
  en: [
    "Recommend something light",
    "I want a cold drink",
    "What goes well with coffee?",
    "Build an order for two",
    "I want something not too sweet",
    "Help me choose fast"
  ],
  "ar-EG": [
    "رشحلي حاجة خفيفة",
    "عايز مشروب ساقع",
    "إيه يمشي مع القهوة؟",
    "جهزلي طلب لاتنين",
    "عايز حاجة مش مسكرة قوي",
    "ساعدني أختار بسرعة"
  ]
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}

export function getRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function getString(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = ""
) {
  const value = record?.[key];

  return typeof value === "string" ? value : fallback;
}

export function getNumber(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = 0
) {
  const value = record?.[key];

  return typeof value === "number" ? value : fallback;
}

export function getNestedRecord(
  record: Record<string, unknown> | undefined,
  key: string
) {
  return getRecord(record?.[key]);
}

export function getMessageRole(message: Record<string, unknown>) {
  const role = getString(message, "role", "assistant");

  return role === "customer" || role === "system" ? role : "assistant";
}

export function getMessageContent(message: Record<string, unknown>) {
  return (
    getString(message, "content") ||
    getString(getNestedRecord(message, "structuredPayload"), "message") ||
    "Message details are not available yet."
  );
}

export function getRecordDateLabel(record: Record<string, unknown>) {
  const raw = getString(record, "createdAt") || getString(record, "updatedAt");

  if (!raw) {
    return "";
  }

  return new Date(raw).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getProposalId(proposal?: Record<string, unknown>) {
  return getString(proposal, "id");
}

export function getProposalStatus(proposal?: Record<string, unknown>) {
  return getString(proposal, "status", "draft").replaceAll("_", " ");
}

export function getProposalTitle(proposal?: Record<string, unknown>) {
  return (
    getString(proposal, "title") ||
    getString(proposal, "summary") ||
    "Cart proposal"
  );
}

export function getProposalMessage(proposal?: Record<string, unknown>) {
  return getString(proposal, "message");
}

export function getProposalItems(proposal?: Record<string, unknown>) {
  return getRecordArray(proposal?.items);
}

export function getProposalItemMenuId(item: Record<string, unknown>) {
  const nestedMenuItem = getNestedRecord(item, "menuItem");

  return (
    getString(item, "menuItemId") ||
    getString(nestedMenuItem, "id") ||
    getString(item, "id")
  );
}

export function describeProposalItem(
  item: Record<string, unknown>,
  menuItemsById: Map<string, MenuItemSummary>
) {
  const menuItemId = getProposalItemMenuId(item);
  const quantity = Math.max(1, getNumber(item, "quantity", 1));
  const menuItem = menuItemId ? menuItemsById.get(menuItemId) : undefined;

  if (!menuItem) {
    return {
      quantity,
      title: menuItemId ? `Menu item ${menuItemId.slice(0, 8)}` : "Menu item",
      detail:
        "Menu details are not loaded here yet. The backend validates this proposal before it reaches your cart.",
      price: "",
      menuItemId
    };
  }

  return {
    quantity,
    title: menuItem.name,
    detail: "Matched to the live branch menu and availability snapshot.",
    price: formatMoney(getMenuItemPrice(menuItem), menuItem.currency),
    menuItemId
  };
}

export function getAiWaiterExperience(
  state?: AiWaiterStateResult,
  branchExperience?: BranchEffectiveExperience
) {
  const aiExperience = getRecord(state?.effectiveExperience);
  const tenantExperience = getRecord(branchExperience);
  const sourceExperience = tenantExperience ?? aiExperience;
  const branch = getNestedRecord(sourceExperience, "branch");
  const company = getNestedRecord(sourceExperience, "company");
  const aiWaiterTone =
    getNestedRecord(sourceExperience, "aiWaiterTone") ??
    getNestedRecord(aiExperience, "aiWaiterTone");
  const brandVoice =
    getNestedRecord(sourceExperience, "brandVoice") ??
    getNestedRecord(aiExperience, "brandVoice");
  const contentBlocks = getRecordArray(sourceExperience?.contentBlocks);
  const introBlock = contentBlocks.find((block) => {
    const key = `${getString(block, "placement")} ${getString(block, "key")}`;

    return key.toLowerCase().includes("ai");
  });
  const brandName =
    getString(branch, "name") || getString(company, "name") || "this cafe";
  const title =
    getString(aiWaiterTone, "title") ||
    getString(aiWaiterTone, "headline") ||
    `${brandName} AI waiter`;
  const description =
    getString(introBlock, "body") ||
    getString(aiWaiterTone, "description") ||
    getString(brandVoice, "customerGreeting") ||
    "Tell the cafe AI waiter what you like. Suggestions are grounded in this branch menu and availability.";
  const tone =
    getString(aiWaiterTone, "tone") ||
    getString(brandVoice, "tone") ||
    "Warm cafe concierge";

  return {
    brandName,
    title,
    description,
    tone
  };
}
