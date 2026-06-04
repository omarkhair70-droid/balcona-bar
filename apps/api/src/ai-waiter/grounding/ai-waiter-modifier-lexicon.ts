import { AiWaiterModifierGroupSnapshot } from "../ai-waiter.types";
import { normalizeCustomerText } from "./ai-waiter-cafe-lexicon";

export type ModifierLexiconMatch =
  | {
      status: "matched";
      optionId: string;
      optionName: string;
      optionSlug: string;
      confidence: number;
      reason: string;
    }
  | {
      status: "ambiguous";
      optionIds: string[];
      confidence: number;
      reason: string;
    }
  | {
      status: "none";
      confidence: number;
      reason: string;
    };

type OptionSnapshot = AiWaiterModifierGroupSnapshot["options"][number];

type AliasFamily = {
  canonical: string;
  aliases: string[];
  optionHints: string[];
};

const ALIAS_FAMILIES: AliasFamily[] = [
  {
    canonical: "small",
    aliases: ["small", "s", "sm", "صغير", "صغيره", "ص"],
    optionHints: ["small", "s", "صغير"],
  },
  {
    canonical: "medium",
    aliases: ["medium", "m", "med", "وسط", "وسطه", "normal size"],
    optionHints: ["medium", "m", "وسط"],
  },
  {
    canonical: "large",
    aliases: ["large", "l", "lg", "كبير", "كبيره"],
    optionHints: ["large", "l", "كبير"],
  },
  {
    canonical: "no sugar",
    aliases: [
      "no sugar",
      "without sugar",
      "sugar free",
      "sugar-free",
      "من غير سكر",
      "بدون سكر",
      "بلا سكر",
      "mafeesh sokar",
      "mn gher sokar",
      "mn 8er sokar",
    ],
    optionHints: ["no sugar", "without sugar", "sugar free", "zero sugar", "بدون سكر", "من غير سكر"],
  },
  {
    canonical: "low sugar",
    aliases: [
      "low sugar",
      "less sugar",
      "not too sweet",
      "مش مسكر",
      "مش مسكره",
      "سكر قليل",
      "sokar 2aleel",
      "sokar aleel",
      "mesh msakar",
      "mesh mesakar",
    ],
    optionHints: ["low sugar", "less sugar", "light sugar", "سكر قليل", "مش مسكر"],
  },
  {
    canonical: "normal sugar",
    aliases: ["normal sugar", "regular sugar", "عادي", "سكر عادي", "normal", "regular"],
    optionHints: ["normal", "regular", "عادي", "سكر عادي"],
  },
  {
    canonical: "extra sugar",
    aliases: ["extra sugar", "more sugar", "زيادة سكر", "سكر زياده", "sokar zyada"],
    optionHints: ["extra sugar", "more sugar", "زيادة سكر"],
  },
  {
    canonical: "no ice",
    aliases: ["no ice", "without ice", "من غير تلج", "بدون تلج", "mafeesh telg"],
    optionHints: ["no ice", "without ice", "بدون تلج", "من غير تلج"],
  },
  {
    canonical: "light ice",
    aliases: ["light ice", "less ice", "تلج قليل", "تلج خفيف"],
    optionHints: ["light ice", "less ice", "تلج قليل", "تلج خفيف"],
  },
  {
    canonical: "normal ice",
    aliases: ["normal ice", "regular ice", "ice normal", "تلج عادي", "عادي"],
    optionHints: ["normal ice", "regular ice", "تلج عادي", "normal"],
  },
  {
    canonical: "extra ice",
    aliases: ["extra ice", "more ice", "تلج زيادة", "تلج زياده"],
    optionHints: ["extra ice", "more ice", "تلج زيادة"],
  },
  {
    canonical: "regular milk",
    aliases: ["regular milk", "normal milk", "whole milk", "لبن عادي", "حليب عادي"],
    optionHints: ["regular milk", "normal milk", "whole milk", "لبن عادي"],
  },
  {
    canonical: "oat milk",
    aliases: ["oat", "oat milk", "شوفان", "اوت", "اوت ميلك"],
    optionHints: ["oat", "oat milk", "شوفان", "اوت"],
  },
  {
    canonical: "almond milk",
    aliases: ["almond", "almond milk", "لوز", "لبن لوز"],
    optionHints: ["almond", "almond milk", "لوز"],
  },
  {
    canonical: "lactose free",
    aliases: ["lactose free", "lactose-free", "لاكتوز فري", "من غير لاكتوز"],
    optionHints: ["lactose free", "lactose-free", "لاكتوز فري"],
  },
  {
    canonical: "hot",
    aliases: ["hot", "سخن", "ساخن", "so5n", "sokhn"],
    optionHints: ["hot", "سخن", "ساخن"],
  },
  {
    canonical: "cold",
    aliases: ["cold", "iced", "ساقع", "بارد", "مثلج", "ice", "sa2a3", "sa23a"],
    optionHints: ["cold", "iced", "ساقع", "بارد", "مثلج"],
  },
  {
    canonical: "yes",
    aliases: ["yes", "ok", "okay", "اه", "آه", "ايوه", "تمام", "ماشي"],
    optionHints: ["yes", "with", "add", "اه", "نعم"],
  },
  {
    canonical: "no",
    aliases: ["no", "nope", "لا", "مش", "بلاش"],
    optionHints: ["no", "without", "remove", "لا", "بلاش"],
  },
];

export function matchModifierOption(
  message: string,
  group: AiWaiterModifierGroupSnapshot,
): ModifierLexiconMatch {
  const normalizedMessage = normalizeCustomerText(message);

  if (!normalizedMessage || group.options.length === 0) {
    return { status: "none", confidence: 0, reason: "empty_or_no_options" };
  }

  const scored = group.options
    .map((option) => ({
      option,
      ...scoreOption(normalizedMessage, option),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.option.name.localeCompare(b.option.name);
    });

  if (scored.length === 0) {
    return { status: "none", confidence: 0, reason: "no_option_alias_match" };
  }

  const topScore = scored[0].score;
  const topMatches = scored.filter((entry) => entry.score === topScore);

  if (topMatches.length > 1) {
    return {
      status: "ambiguous",
      optionIds: topMatches.map((entry) => entry.option.id),
      confidence: Math.min(0.7, topScore),
      reason: "multiple_modifier_options_matched",
    };
  }

  const top = scored[0];

  return {
    status: "matched",
    optionId: top.option.id,
    optionName: top.option.name,
    optionSlug: top.option.slug,
    confidence: Math.min(1, top.score),
    reason: top.reason,
  };
}

function scoreOption(normalizedMessage: string, option: OptionSnapshot) {
  const optionText = normalizeCustomerText(`${option.name} ${option.slug}`);
  let score = 0;
  let reason = "no_match";

  if (containsPhrase(normalizedMessage, normalizeCustomerText(option.name))) {
    score = 1;
    reason = "exact_option_name_match";
  }

  if (containsPhrase(normalizedMessage, normalizeCustomerText(option.slug))) {
    score = Math.max(score, 0.96);
    reason = score === 1 ? reason : "exact_option_slug_match";
  }

  for (const family of ALIAS_FAMILIES) {
    const messageMatched = family.aliases.some((alias) =>
      containsPhrase(normalizedMessage, normalizeCustomerText(alias)),
    );

    if (!messageMatched) {
      continue;
    }

    const optionMatched = family.optionHints.some((hint) =>
      containsPhrase(optionText, normalizeCustomerText(hint)),
    );

    if (!optionMatched) {
      continue;
    }

    const familyScore = family.canonical === "yes" || family.canonical === "no" ? 0.72 : 0.92;

    if (familyScore > score) {
      score = familyScore;
      reason = `${family.canonical.replaceAll(" ", "_")}_alias_match`;
    }
  }

  return { score, reason };
}

function containsPhrase(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  return ` ${haystack} `.includes(` ${needle} `);
}
