import type {
  AiWaiterLanguage,
  AiWaiterStateResult,
  BranchEffectiveExperience,
  MenuItemSummary
} from "@/lib/api/types";
import { translate } from "@/lib/i18n/messages";
import { formatMoney, getMenuItemPrice } from "./customer-format";

export type AiLanguageOption = {
  value: AiWaiterLanguage;
  labelKey: string;
  dir: "ltr" | "rtl";
};

export type AiWaiterText = (
  key: string,
  values?: Record<string, string | number>
) => string;

export const aiLanguageOptions: AiLanguageOption[] = [
  { value: "en", labelKey: "language.english", dir: "ltr" },
  { value: "ar-EG", labelKey: "language.arabic", dir: "rtl" }
];

export const aiSuggestedPromptKeys: Record<AiWaiterLanguage, string[]> = {
  en: [
    "recommendLight",
    "coldDrink",
    "coffeePairing",
    "orderForTwo",
    "notTooSweet",
    "whereIsOrder",
    "getBill",
    "callWaiter",
    "chooseFast"
  ],
  "ar-EG": [
    "recommendLight",
    "coldDrink",
    "coffeePairing",
    "orderForTwo",
    "notTooSweet",
    "whereIsOrder",
    "getBill",
    "callWaiter",
    "chooseFast"
  ]
};

export function getAiPromptLocale(language: AiWaiterLanguage) {
  return language === "ar-EG" ? "ar" : "en";
}

export function getAiSuggestedPrompt(language: AiWaiterLanguage, key: string) {
  return translate(getAiPromptLocale(language), `customer.ai.prompts.${key}`);
}

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

export function getMessageContent(message: Record<string, unknown>, fallback = "") {
  return (
    getString(message, "content") ||
    getString(getNestedRecord(message, "structuredPayload"), "message") ||
    fallback
  );
}

export function getPendingModifierQuickReplies(
  message: Record<string, unknown>
) {
  const metadata = getNestedRecord(message, "metadata");
  const pendingModifier = getNestedRecord(metadata, "pendingModifier");
  const options = getRecordArray(pendingModifier?.allowedOptions);
  const labels = new Set<string>();

  for (const option of options) {
    const label = getString(option, "name").trim();

    if (label) {
      labels.add(label);
    }
  }

  return Array.from(labels).slice(0, 8);
}

export function getAiToolExecutionStatusKey(message: Record<string, unknown>) {
  const metadata = getNestedRecord(message, "metadata");
  const toolExecution = getNestedRecord(metadata, "toolExecution");
  const actions = getRecordArray(toolExecution?.actions);
  const action = actions.find((item) => {
    const toolName = getString(item, "toolName");

    return (
      toolName === "request_bill" ||
      toolName === "call_waiter" ||
      toolName === "read_order_status"
    );
  });

  if (!action) {
    return undefined;
  }

  const toolName = getString(action, "toolName");
  const status = getString(action, "status", "succeeded");
  const output = getNestedRecord(action, "output");
  const reason = getString(output, "reason");

  if (toolName === "request_bill") {
    if (status === "succeeded") {
      return "tools.billRequestSent";
    }

    if (reason === "active_bill_request_exists") {
      return "tools.billAlreadyRequested";
    }

    if (reason === "no_billable_orders") {
      return "tools.billAvailableAfterAcceptedOrder";
    }

    return "tools.billRequestChecked";
  }

  if (toolName === "call_waiter") {
    if (status === "succeeded") {
      return "tools.waiterNotified";
    }

    if (reason === "active_waiter_call_exists") {
      return "tools.waiterCallAlreadyActive";
    }

    return "tools.waiterCallChecked";
  }

  if (toolName === "read_order_status") {
    if (status === "succeeded") {
      return "tools.orderStatusChecked";
    }

    return "tools.noOrderPlacedYet";
  }

  return undefined;
}

export function shouldRefreshFromAiToolResult(result?: Record<string, unknown>) {
  const assistantMessage = getRecord(result?.assistantMessage);
  const metadata = getNestedRecord(assistantMessage, "metadata");
  const toolExecution = getNestedRecord(metadata, "toolExecution");

  return toolExecution?.refreshCustomerState === true;
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

export function getProposalTitle(
  proposal: Record<string, unknown> | undefined,
  t: AiWaiterText
) {
  return (
    getString(proposal, "title") ||
    getString(proposal, "summary") ||
    t("proposal.fallbackTitle")
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
  menuItemsById: Map<string, MenuItemSummary>,
  t: AiWaiterText
) {
  const menuItemId = getProposalItemMenuId(item);
  const quantity = Math.max(1, getNumber(item, "quantity", 1));
  const menuItem = menuItemId ? menuItemsById.get(menuItemId) : undefined;

  if (!menuItem) {
    return {
      quantity,
      title: menuItemId
        ? t("proposal.menuItemWithId", {
            id: menuItemId.slice(0, 8)
          })
        : t("proposal.menuItemFallback"),
      detail: t("proposal.menuDetailsUnavailable"),
      price: "",
      menuItemId
    };
  }

  return {
    quantity,
    title: menuItem.name,
    detail: t("proposal.liveMenuMatch"),
    price: formatMoney(getMenuItemPrice(menuItem), menuItem.currency),
    menuItemId
  };
}

export function getAiWaiterExperience(
  state: AiWaiterStateResult | undefined,
  branchExperience: BranchEffectiveExperience | undefined,
  t: AiWaiterText
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
    getString(branch, "name") ||
    getString(company, "name") ||
    t("page.thisCafe");
  const title =
    getString(aiWaiterTone, "title") ||
    getString(aiWaiterTone, "headline") ||
    t("page.tenantAiWaiterTitle", { name: brandName });
  const description =
    getString(introBlock, "body") ||
    getString(aiWaiterTone, "description") ||
    getString(brandVoice, "customerGreeting") ||
    t("page.defaultExperienceDescription");
  const tone =
    getString(aiWaiterTone, "tone") ||
    getString(brandVoice, "tone") ||
    t("page.defaultTone");

  return {
    brandName,
    title,
    description,
    tone
  };
}
