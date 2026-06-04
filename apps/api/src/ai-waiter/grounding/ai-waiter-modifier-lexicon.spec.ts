import { AiWaiterModifierGroupSnapshot } from "../ai-waiter.types";
import { matchModifierOption } from "./ai-waiter-modifier-lexicon";

function group(
  input: Partial<AiWaiterModifierGroupSnapshot> & {
    options: AiWaiterModifierGroupSnapshot["options"];
  },
): AiWaiterModifierGroupSnapshot {
  return {
    id: input.id ?? "group-1",
    name: input.name ?? "Modifier",
    slug: input.slug ?? "modifier",
    selectionType: input.selectionType ?? "single",
    isRequired: input.isRequired ?? true,
    minSelections: input.minSelections ?? 1,
    maxSelections: input.maxSelections ?? 1,
    options: input.options,
  };
}

describe("ai waiter modifier lexicon", () => {
  it.each([
    ["medium", "medium"],
    ["وسط", "medium"],
    ["M", "medium"],
  ])("maps size answer %s to Medium", (message, expectedSlug) => {
    const result = matchModifierOption(
      message,
      group({
        name: "Size",
        slug: "size",
        options: [
          { id: "small", groupId: "size", name: "Small", slug: "small" },
          { id: "medium", groupId: "size", name: "Medium", slug: "medium" },
          { id: "large", groupId: "size", name: "Large", slug: "large" },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "matched",
      optionSlug: expectedSlug,
    });
  });

  it("maps Egyptian low-sugar phrasing to an existing Low sugar option", () => {
    const result = matchModifierOption(
      "مش مسكر قوي",
      group({
        name: "Sugar",
        slug: "sugar",
        options: [
          {
            id: "no-sugar",
            groupId: "sugar",
            name: "No sugar",
            slug: "no-sugar",
          },
          {
            id: "low-sugar",
            groupId: "sugar",
            name: "Low sugar",
            slug: "low-sugar",
          },
          {
            id: "normal",
            groupId: "sugar",
            name: "Normal sugar",
            slug: "normal-sugar",
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "matched",
      optionId: "low-sugar",
    });
  });

  it("matches عادي only when the pending group has a normal option", () => {
    const result = matchModifierOption(
      "عادي",
      group({
        name: "Sugar",
        slug: "sugar",
        options: [
          {
            id: "normal",
            groupId: "sugar",
            name: "Normal sugar",
            slug: "normal-sugar",
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "matched",
      optionId: "normal",
    });
  });
});
