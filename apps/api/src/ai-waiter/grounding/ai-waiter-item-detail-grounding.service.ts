import { Injectable } from "@nestjs/common";
import {
  AiWaiterContext,
  AiWaiterMenuItemSnapshot,
  AiWaiterModifierGroupSnapshot,
} from "../ai-waiter.types";
import { normalizeCustomerText } from "./ai-waiter-cafe-lexicon";
import {
  GroundedMenuCandidate,
  MenuGroundingResult,
} from "./ai-waiter-menu-grounding.service";
import { matchModifierOption } from "./ai-waiter-modifier-lexicon";

export type ItemDetailGroundingMode =
  | "none"
  | "exact_item_detail"
  | "pending_modifier_resolution"
  | "modifier_clarification"
  | "complete_for_proposal";

export type CompactModifierOption = {
  id: string;
  name: string;
  slug: string;
};

export type CompactModifierGroup = {
  id: string;
  name: string;
  slug: string;
  selectionType: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: CompactModifierOption[];
  optionCount: number;
  omittedOptionCount: number;
};

export type PendingModifierMetadata = {
  menuItemId: string;
  modifierGroupId: string;
  allowedOptionIds: string[];
  allowedOptions: CompactModifierOption[];
  selectedModifierOptionIds?: string[];
  question: string;
  createdAt: string;
};

export type ItemDetailGroundingResult = {
  mode: ItemDetailGroundingMode;
  item?: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    requiredModifierGroups: CompactModifierGroup[];
    optionalModifierGroups: CompactModifierGroup[];
  };
  pendingModifier?: PendingModifierMetadata;
  pendingItem?: {
    id: string;
    name: string;
  };
  selectedModifierOptionIds: string[];
  missingRequiredGroups: CompactModifierGroup[];
  confidence: number;
  reasons: string[];
};

const MAX_OPTIONS_PER_GROUP = 8;
const NAME_LIMIT = 80;
const DESCRIPTION_LIMIT = 140;
const EXACT_ITEM_SCORE = 150;
const CUSTOMIZATION_TERMS = [
  "size",
  "حجم",
  "sugar",
  "سكر",
  "ice",
  "تلج",
  "milk",
  "لبن",
  "حليب",
  "option",
  "اختيار",
  "add",
  "اضاف",
  "topping",
  "custom",
];

@Injectable()
export class AiWaiterItemDetailGroundingService {
  build(input: {
    context: AiWaiterContext;
    message: string;
    grounding: MenuGroundingResult;
  }): ItemDetailGroundingResult {
    const pending = this.latestPendingModifier(input.context);

    if (pending) {
      return this.resolvePendingModifier(input.context, input.message, pending);
    }

    const selected = this.selectExactItem(
      input.context,
      input.message,
      input.grounding,
    );

    if (!selected) {
      return this.empty("no_exact_item_detail_needed");
    }

    const requiredGroups = selected.item.modifierGroups.filter(
      (group) => group.isRequired && Math.max(1, group.minSelections) > 0,
    );
    const optionalGroups = selected.item.modifierGroups.filter(
      (group) => !group.isRequired,
    );
    const wantsCustomization = this.hasCustomizationIntent(input.message);

    if (requiredGroups.length === 0 && !wantsCustomization) {
      return this.empty("exact_item_has_no_required_modifiers");
    }

    const selectedModifierOptionIds = this.matchMessageModifierOptions(
      input.message,
      selected.item.modifierGroups,
    );
    const missingRequiredGroups = this.missingRequiredGroups(
      requiredGroups,
      selectedModifierOptionIds,
    );
    const mode: ItemDetailGroundingMode =
      missingRequiredGroups.length === 0 && selectedModifierOptionIds.length > 0
        ? "complete_for_proposal"
        : "exact_item_detail";
    const item = this.compactItem(selected.item, requiredGroups, optionalGroups);
    const pendingModifier =
      missingRequiredGroups.length > 0
        ? this.pendingModifierFor(
            selected.item,
            missingRequiredGroups[0],
            selectedModifierOptionIds,
          )
        : undefined;

    return {
      mode,
      item,
      pendingModifier,
      pendingItem: { id: selected.item.id, name: selected.item.name },
      selectedModifierOptionIds,
      missingRequiredGroups,
      confidence: selected.confidence,
      reasons: selected.reasons,
    };
  }

  private resolvePendingModifier(
    context: AiWaiterContext,
    message: string,
    pending: PendingModifierMetadata,
  ): ItemDetailGroundingResult {
    const item = context.menuItems.find(
      (menuItem) => menuItem.id === pending.menuItemId,
    );
    const group = item?.modifierGroups.find(
      (modifierGroup) => modifierGroup.id === pending.modifierGroupId,
    );

    if (!item || !group) {
      return this.empty("pending_modifier_item_or_group_missing");
    }

    const allowedOptionIds = new Set(pending.allowedOptionIds);
    const allowedGroup = {
      ...group,
      options: group.options.filter((option) => allowedOptionIds.has(option.id)),
    };
    const match = matchModifierOption(message, allowedGroup);
    const requiredGroups = item.modifierGroups.filter(
      (modifierGroup) =>
        modifierGroup.isRequired && Math.max(1, modifierGroup.minSelections) > 0,
    );

    if (match.status !== "matched") {
      const compactGroup = this.compactGroup(group);
      return {
        mode: "modifier_clarification",
        item: this.compactItem(
          item,
          requiredGroups,
          item.modifierGroups.filter((modifierGroup) => !modifierGroup.isRequired),
        ),
        pendingModifier: {
          ...pending,
          question: this.questionFor(item, compactGroup, true),
        },
        pendingItem: { id: item.id, name: item.name },
        selectedModifierOptionIds: [],
        missingRequiredGroups: [compactGroup],
        confidence: match.confidence,
        reasons: [match.reason],
      };
    }

    const selectedModifierOptionIds = Array.from(
      new Set([...(pending.selectedModifierOptionIds ?? []), match.optionId]),
    );
    const missingRequiredGroups = this.missingRequiredGroups(
      requiredGroups,
      selectedModifierOptionIds,
    );
    const itemDetail = this.compactItem(
      item,
      requiredGroups,
      item.modifierGroups.filter((modifierGroup) => !modifierGroup.isRequired),
    );
    const nextPending =
      missingRequiredGroups.length > 0
        ? this.pendingModifierFor(
            item,
            missingRequiredGroups[0],
            selectedModifierOptionIds,
          )
        : undefined;

    return {
      mode:
        missingRequiredGroups.length > 0
          ? "pending_modifier_resolution"
          : "complete_for_proposal",
      item: itemDetail,
      pendingModifier: nextPending,
      pendingItem: { id: item.id, name: item.name },
      selectedModifierOptionIds,
      missingRequiredGroups,
      confidence: match.confidence,
      reasons: ["pending_modifier_detected", match.reason],
    };
  }

  private selectExactItem(
    context: AiWaiterContext,
    message: string,
    grounding: MenuGroundingResult,
  ) {
    const top = grounding.candidates[0];

    if (!top) {
      return undefined;
    }

    const item = context.menuItems.find((menuItem) => menuItem.id === top.id);

    if (!item) {
      return undefined;
    }

    const normalizedMessage = normalizeCustomerText(message);
    const normalizedName = normalizeCustomerText(item.name);
    const normalizedSlug = normalizeCustomerText(item.slug);
    const nameMatched =
      containsPhrase(normalizedMessage, normalizedName) ||
      containsPhrase(normalizedMessage, normalizedSlug);
    const highConfidence =
      grounding.exactMatchFound ||
      top.score >= EXACT_ITEM_SCORE ||
      top.matchReasons.includes("exact_name_match") ||
      top.matchReasons.includes("exact_slug_match") ||
      (nameMatched && this.hasOrderingIntent(message));

    if (!highConfidence) {
      return undefined;
    }

    return {
      item,
      confidence: confidenceFor(top),
      reasons: top.matchReasons,
    };
  }

  private matchMessageModifierOptions(
    message: string,
    groups: AiWaiterModifierGroupSnapshot[],
  ) {
    const selected = new Set<string>();

    for (const group of groups) {
      const match = matchModifierOption(message, group);

      if (match.status === "matched") {
        selected.add(match.optionId);
      }
    }

    return Array.from(selected);
  }

  private missingRequiredGroups(
    requiredGroups: AiWaiterModifierGroupSnapshot[],
    selectedModifierOptionIds: string[],
  ) {
    const selected = new Set(selectedModifierOptionIds);

    return requiredGroups
      .filter((group) => {
        const selectedCount = group.options.filter((option) =>
          selected.has(option.id),
        ).length;

        return selectedCount < Math.max(1, group.minSelections);
      })
      .map((group) => this.compactGroup(group));
  }

  private latestPendingModifier(context: AiWaiterContext) {
    for (const message of [...context.recentMessages].reverse()) {
      const pending = this.pendingModifierFromMetadata(message.metadata);

      if (pending) {
        return pending;
      }
    }

    return undefined;
  }

  private pendingModifierFromMetadata(value: unknown) {
    if (!isRecord(value) || value.mode !== "modifier_question") {
      return undefined;
    }

    const pending = isRecord(value.pendingModifier)
      ? value.pendingModifier
      : undefined;
    const allowedOptions = Array.isArray(pending?.allowedOptions)
      ? pending.allowedOptions.filter(isRecord).map((option) => ({
          id: stringValue(option.id),
          name: stringValue(option.name),
          slug: stringValue(option.slug),
        }))
      : [];
    const menuItemId = stringValue(pending?.menuItemId);
    const modifierGroupId = stringValue(pending?.modifierGroupId);
    const question = stringValue(pending?.question);
    const selectedModifierOptionIds =
      stringArray(pending?.selectedModifierOptionIds).length > 0
        ? stringArray(pending?.selectedModifierOptionIds)
        : stringArray(value.selectedModifierOptionIds);

    if (!menuItemId || !modifierGroupId || allowedOptions.length === 0) {
      return undefined;
    }

    return {
      menuItemId,
      modifierGroupId,
      allowedOptionIds: allowedOptions.map((option) => option.id),
      allowedOptions,
      selectedModifierOptionIds,
      question,
      createdAt:
        stringValue(pending?.createdAt) || new Date().toISOString(),
    } satisfies PendingModifierMetadata;
  }

  private compactItem(
    item: AiWaiterMenuItemSnapshot,
    requiredGroups: AiWaiterModifierGroupSnapshot[],
    optionalGroups: AiWaiterModifierGroupSnapshot[],
  ): NonNullable<ItemDetailGroundingResult["item"]> {
    return {
      id: item.id,
      slug: item.slug,
      name: this.truncate(item.name, NAME_LIMIT) ?? item.name,
      description: this.truncate(item.description ?? null, DESCRIPTION_LIMIT),
      requiredModifierGroups: requiredGroups.map((group) =>
        this.compactGroup(group),
      ),
      optionalModifierGroups: optionalGroups.map((group) =>
        this.compactGroup(group),
      ),
    };
  }

  private pendingModifierFor(
    item: AiWaiterMenuItemSnapshot,
    group: CompactModifierGroup,
    selectedModifierOptionIds: string[] = [],
  ): PendingModifierMetadata {
    return {
      menuItemId: item.id,
      modifierGroupId: group.id,
      allowedOptionIds: group.options.map((option) => option.id),
      allowedOptions: group.options,
      selectedModifierOptionIds,
      question: this.questionFor(item, group),
      createdAt: new Date().toISOString(),
    };
  }

  private questionFor(
    item: AiWaiterMenuItemSnapshot,
    group: CompactModifierGroup,
    clarification = false,
  ) {
    const labels = group.options.map((option) => option.name).join(" / ");
    const prefix = clarification
      ? "محتاج أوضح الاختيار."
      : `تمام، ${item.name}.`;

    return `${prefix} اختار ${group.name}: ${labels}؟`;
  }

  private compactGroup(group: AiWaiterModifierGroupSnapshot): CompactModifierGroup {
    const options = group.options.slice(0, MAX_OPTIONS_PER_GROUP).map((option) => ({
      id: option.id,
      name: this.truncate(option.name, NAME_LIMIT) ?? option.name,
      slug: option.slug,
    }));

    return {
      id: group.id,
      name: this.truncate(group.name, NAME_LIMIT) ?? group.name,
      slug: group.slug,
      selectionType: group.selectionType,
      isRequired: group.isRequired,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      options,
      optionCount: group.options.length,
      omittedOptionCount: Math.max(0, group.options.length - options.length),
    };
  }

  private hasCustomizationIntent(message: string) {
    const normalized = normalizeCustomerText(message);

    return CUSTOMIZATION_TERMS.some((term) =>
      containsPhrase(normalized, normalizeCustomerText(term)),
    );
  }

  private hasOrderingIntent(message: string) {
    const normalized = normalizeCustomerText(message);
    const terms = ["هات", "عايز", "عاوز", "add", "order", "جيب", "ممكن"];

    return terms.some((term) =>
      containsPhrase(normalized, normalizeCustomerText(term)),
    );
  }

  private empty(reason: string): ItemDetailGroundingResult {
    return {
      mode: "none",
      selectedModifierOptionIds: [],
      missingRequiredGroups: [],
      confidence: 0,
      reasons: [reason],
    };
  }

  private truncate(value: string | null, maxChars: number) {
    if (!value) {
      return value;
    }

    return value.length > maxChars ? value.slice(0, maxChars).trim() : value;
  }
}

function confidenceFor(candidate: GroundedMenuCandidate) {
  return Math.max(0.55, Math.min(0.98, candidate.score / 240));
}

function containsPhrase(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  return ` ${haystack} `.includes(` ${needle} `);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
