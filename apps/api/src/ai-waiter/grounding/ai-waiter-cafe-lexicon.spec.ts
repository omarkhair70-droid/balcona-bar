import { AiWaiterMenuItemSnapshot } from "../ai-waiter.types";
import {
  detectLanguageLite,
  expandQueryTokens,
  itemSearchTokens,
  normalizeCustomerText,
  scoreLexiconMatches,
} from "./ai-waiter-cafe-lexicon";

function menuItem(
  overrides: Partial<AiWaiterMenuItemSnapshot>,
): AiWaiterMenuItemSnapshot {
  return {
    id: "item-1",
    slug: "iced-spanish-latte",
    name: "Iced Spanish Latte",
    description: "Cold coffee latte with caffeine",
    currency: "EGP",
    isFeatured: true,
    category: {
      id: "category-coffee",
      name: "Coffee",
      slug: "coffee",
    },
    modifierGroups: [],
    ...overrides,
  };
}

describe("ai waiter cafe lexicon", () => {
  it("normalizes Arabic text for cafe phrase matching", () => {
    expect(normalizeCustomerText("إزّايك؟ عايز حاجة ساقعة")).toBe(
      "ازايك عايز حاجه ساقعه",
    );
  });

  it("detects English, Arabic, and Franco-Arabic language hints", () => {
    expect(detectLanguageLite("I want coffee")).toBe("en");
    expect(detectLanguageLite("عايز قهوة")).toBe("ar-EG");
    expect(detectLanguageLite("3ayez haga sa2a3a")).toBe("mixed");
  });

  it("maps Franco-Arabic cold drink phrases to action-ready intent tokens", () => {
    const query = expandQueryTokens("3ayez haga sa2a3a");

    expect(query.language).toBe("mixed");
    expect(query.tokens).toEqual(expect.arrayContaining(["want", "cold"]));
    expect(query.intents).toContain("cold");
  });

  it("maps cafe safety and preference phrases without broad dictionary noise", () => {
    expect(expandQueryTokens("مش مسكر قوي").intents).toContain("low_sugar");
    expect(expandQueryTokens("عندي حساسية لبن").intents).toContain("allergy");
    expect(expandQueryTokens("ناديلي حد ويتر").intents).toContain("waiter");
    expect(expandQueryTokens("الحساب لو سمحت").intents).toContain("bill");
  });

  it("scores caffeine requests against coffee menu items", () => {
    const query = expandQueryTokens("عايز حاجة تفوقني");
    const score = scoreLexiconMatches({
      query,
      item: itemSearchTokens(
        menuItem({
          name: "Double Espresso",
          slug: "double-espresso",
          description: "Strong coffee with caffeine",
        }),
      ),
    });

    expect(score.score).toBeGreaterThan(0);
    expect(score.reasons).toEqual(
      expect.arrayContaining(["coffee_intent", "caffeine_intent"]),
    );
  });

  it("keeps Balcona menu aliases and typos grounded to item tokens", () => {
    const query = expandQueryTokens("lemoon mint");
    const item = itemSearchTokens(
      menuItem({
        id: "item-lemon-mint",
        slug: "lemon-mint",
        name: "Lemon Mint",
        description: "Cold lemon and mint drink",
      }),
    );

    expect(query.tokens).toEqual(expect.arrayContaining(["lemon", "mint"]));
    expect(item.tokens).toEqual(expect.arrayContaining(["lemon", "mint"]));
  });
});
