import { AiWaiterMenuItemSnapshot } from "../ai-waiter.types";

export type LiteLanguage = "ar-EG" | "en" | "mixed";

export type LexiconMatch = {
  score: number;
  reasons: string[];
  intents: string[];
};

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;
const NON_TOKEN_CHARS = /[^\p{L}\p{N}]+/gu;

const ALIAS_GROUPS: Array<{
  canonical: string;
  aliases: string[];
  intents?: string[];
}> = [
  {
    canonical: "want",
    aliases: [
      "عايز",
      "عاوز",
      "هات",
      "ممكن",
      "رشحلي",
      "3ayez",
      "3awz",
      "momken",
      "recommend",
    ],
  },
  {
    canonical: "cold",
    aliases: [
      "ساقع",
      "ساقعة",
      "ساقعه",
      "بارد",
      "تلج",
      "cold",
      "iced",
      "ice",
      "sa2a3",
      "sa23a",
      "sa2a3a",
    ],
    intents: ["cold"],
  },
  {
    canonical: "hot",
    aliases: ["سخن", "hot", "so5n", "sokhn"],
    intents: ["hot"],
  },
  {
    canonical: "coffee",
    aliases: ["قهوة", "coffee", "cofee", "كوفي", "2ahwa", "ahwa"],
    intents: ["coffee", "caffeine"],
  },
  {
    canonical: "juice",
    aliases: ["عصير", "juice"],
    intents: ["cold", "juice"],
  },
  {
    canonical: "mango",
    aliases: ["مانجو", "mango", "mangoo"],
    intents: ["cold", "juice"],
  },
  {
    canonical: "lemon",
    aliases: ["ليمون", "lemon", "lemoon"],
    intents: ["cold"],
  },
  { canonical: "mint", aliases: ["نعناع", "mint"], intents: ["cold"] },
  {
    canonical: "lemon mint",
    aliases: ["ليمون نعناع", "lemon mint", "lemoon mint", "ليمون ونعناع"],
    intents: ["cold"],
  },
  { canonical: "matcha", aliases: ["ماتشا", "matcha"], intents: ["premium"] },
  {
    canonical: "spanish",
    aliases: ["سبانيش", "spanish"],
    intents: ["coffee", "premium"],
  },
  { canonical: "latte", aliases: ["لاتيه", "latte"], intents: ["coffee"] },
  { canonical: "waffle", aliases: ["وافل", "waffle"], intents: ["dessert"] },
  {
    canonical: "pancake",
    aliases: ["بان كيك", "pancake"],
    intents: ["dessert"],
  },
  {
    canonical: "milkshake",
    aliases: ["ميلك شيك", "milkshake", "milk shake"],
    intents: ["cold", "dessert"],
  },
  {
    canonical: "smoothie",
    aliases: ["سموذي", "smoothie", "smothie"],
    intents: ["cold"],
  },
  {
    canonical: "dessert",
    aliases: ["حلو", "حلوة", "dessert", "sweet"],
    intents: ["dessert"],
  },
  {
    canonical: "chocolate",
    aliases: ["شوكولاتة", "شيكولاتة", "chocolate"],
    intents: ["dessert"],
  },
  {
    canonical: "caffeine",
    aliases: ["تفوقني", "تصحصحني", "caffeine", "energy", "wake me up", "wake"],
    intents: ["coffee", "caffeine"],
  },
  {
    canonical: "low sugar",
    aliases: ["مش مسكر", "low sugar", "no sugar", "sugar-free", "sugar free"],
    intents: ["low_sugar"],
  },
  {
    canonical: "budget",
    aliases: ["رخيص", "رخيصة", "رخيصه", "اقتصادي", "cheap", "budget"],
    intents: ["budget"],
  },
  {
    canonical: "premium",
    aliases: ["فخم", "premium", "signature"],
    intents: ["premium"],
  },
  {
    canonical: "bill",
    aliases: ["الحساب", "bill", "check"],
    intents: ["bill"],
  },
  {
    canonical: "waiter",
    aliases: ["ويتر", "waiter", "help"],
    intents: ["waiter"],
  },
  {
    canonical: "order status",
    aliases: ["طلبي فين", "order status", "where is my order"],
    intents: ["order_status"],
  },
  {
    canonical: "allergy",
    aliases: ["حساسية", "allergy"],
    intents: ["allergy"],
  },
  {
    canonical: "study",
    aliases: ["أذاكر", "اذاكر", "study", "work", "focus"],
    intents: ["study"],
  },
  {
    canonical: "group",
    aliases: ["صحابي", "جروب", "group", "friends"],
    intents: ["group"],
  },
  {
    canonical: "mood",
    aliases: ["مخنوق", "رايق", "mood", "tired"],
    intents: ["mood"],
  },
];

const ALIAS_TO_CANONICAL = new Map<
  string,
  { canonical: string; intents: string[] }
>();

for (const group of ALIAS_GROUPS) {
  for (const value of [group.canonical, ...group.aliases]) {
    ALIAS_TO_CANONICAL.set(normalizeCustomerText(value), {
      canonical: group.canonical,
      intents: group.intents ?? [],
    });
  }
}

const INTENT_ITEM_TERMS: Record<string, string[]> = {
  cold: [
    "cold",
    "iced",
    "ice",
    "juice",
    "mango",
    "lemon",
    "mint",
    "smoothie",
    "milkshake",
    "refreshing",
    "منعش",
    "ساقع",
  ],
  hot: ["hot", "coffee", "latte", "قهوة", "سخن"],
  coffee: [
    "coffee",
    "latte",
    "spanish",
    "matcha",
    "espresso",
    "cappuccino",
    "قهوة",
    "لاتيه",
    "كوفي",
  ],
  caffeine: ["coffee", "espresso", "latte", "spanish", "قهوة", "تفوق"],
  dessert: [
    "waffle",
    "pancake",
    "dessert",
    "sweet",
    "chocolate",
    "milkshake",
    "وافل",
    "بان",
    "حلو",
  ],
  low_sugar: ["low sugar", "no sugar", "sugar-free", "مش مسكر"],
  budget: ["classic", "small", "simple", "اقتصادي"],
  premium: ["signature", "premium", "special", "spanish", "matcha", "فخم"],
  study: ["coffee", "latte", "matcha", "tea", "قهوة", "كافيين"],
  group: ["sharing", "waffle", "pancake", "dessert", "combo"],
  mood: ["comfort", "chocolate", "latte", "smoothie", "lemon", "mint"],
};

export function normalizeCustomerText(value: string) {
  return value
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(NON_TOKEN_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLanguageLite(value: string): LiteLanguage {
  const hasArabic = /[\u0600-\u06FF]/.test(value);
  const hasLatin = /[a-z]/i.test(value);

  if (hasArabic && hasLatin) {
    return "mixed";
  }

  if (hasArabic) {
    return "ar-EG";
  }

  if (looksLikeFrancoArabic(value)) {
    return "mixed";
  }

  return "en";
}

export function expandQueryTokens(value: string) {
  const normalized = normalizeCustomerText(value);
  const tokens = new Set(tokenizeNormalized(normalized));
  const intents = new Set<string>();

  for (const [alias, match] of ALIAS_TO_CANONICAL.entries()) {
    if (containsTokenPhrase(normalized, alias)) {
      tokenizeNormalized(match.canonical).forEach((token) => tokens.add(token));
      match.intents.forEach((intent) => intents.add(intent));
    }
  }

  return {
    normalized,
    tokens: Array.from(tokens),
    intents: Array.from(intents),
    language: detectLanguageLite(value),
  };
}

export function itemSearchTokens(item: AiWaiterMenuItemSnapshot) {
  const category = categoryText(item);
  const normalized = normalizeCustomerText(
    [item.name, item.slug, item.description ?? "", category].join(" "),
  );
  const tokens = new Set(tokenizeNormalized(normalized));

  for (const [alias, match] of ALIAS_TO_CANONICAL.entries()) {
    if (containsTokenPhrase(normalized, alias)) {
      tokenizeNormalized(match.canonical).forEach((token) => tokens.add(token));
    }
  }

  return {
    normalized,
    tokens: Array.from(tokens),
    category: normalizeCustomerText(category),
  };
}

export function scoreLexiconMatches(input: {
  query: ReturnType<typeof expandQueryTokens>;
  item: ReturnType<typeof itemSearchTokens>;
}) {
  const reasons: string[] = [];
  let score = 0;

  for (const intent of input.query.intents) {
    const terms = INTENT_ITEM_TERMS[intent] ?? [];
    const matched = terms.some((term) =>
      containsTokenPhrase(input.item.normalized, normalizeCustomerText(term)),
    );

    if (matched) {
      score += 42;
      reasons.push(`${intent}_intent`);
    }
  }

  return {
    score,
    reasons,
    intents: input.query.intents,
  } satisfies LexiconMatch;
}

export function tokenEditDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;

      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function tokenizeNormalized(value: string) {
  return value.split(" ").filter((token) => token.length > 0);
}

function containsTokenPhrase(haystack: string, needle: string) {
  if (!needle) {
    return false;
  }

  return ` ${haystack} `.includes(` ${needle} `);
}

function categoryText(item: AiWaiterMenuItemSnapshot) {
  const category = item.category;

  if (!category) {
    return "";
  }

  return [category.name, category.slug].filter(Boolean).join(" ");
}

function looksLikeFrancoArabic(value: string) {
  return /\b(3ayez|3awz|7aga|sa2a3|sa23a|so5n|2ahwa|mesh|mafeesh|keda|ana)\b/i.test(
    value,
  );
}
