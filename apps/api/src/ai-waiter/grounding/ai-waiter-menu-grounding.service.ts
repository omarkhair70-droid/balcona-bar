import { Injectable } from "@nestjs/common";
import { AiWaiterContext, AiWaiterMenuItemSnapshot } from "../ai-waiter.types";
import {
  expandQueryTokens,
  itemSearchTokens,
  normalizeCustomerText,
  scoreLexiconMatches,
  tokenEditDistance,
} from "./ai-waiter-cafe-lexicon";

export type GroundedMenuCandidate = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isFeatured: boolean;
  category?: string;
  score: number;
  matchReasons: string[];
};

export type MenuGroundingResult = {
  candidates: GroundedMenuCandidate[];
  totalMenuItemsAvailable: number;
  groundingMode: "ranked" | "fallback_featured";
  topMatchReasons: string[];
  exactMatchFound: boolean;
  omittedMenuItemCount: number;
};

type CandidateScore = {
  item: AiWaiterMenuItemSnapshot;
  score: number;
  reasons: string[];
  index: number;
};

const DEFAULT_CANDIDATE_LIMIT = 12;
const HARD_CANDIDATE_CAP = 20;
const DESCRIPTION_LIMIT = 160;

@Injectable()
export class AiWaiterMenuGroundingService {
  rankCandidates(
    context: AiWaiterContext,
    input: {
      message: string;
      maxCandidates?: number;
    },
  ): MenuGroundingResult {
    const maxCandidates = this.normalizeCandidateLimit(input.maxCandidates);
    const query = expandQueryTokens(input.message);
    const recentText = normalizeCustomerText(
      context.recentMessages
        .slice(-4)
        .map((message) => message.content)
        .join(" "),
    );
    const scored = context.menuItems.map((item, index) =>
      this.scoreItem(item, index, query, recentText),
    );
    const matched = scored.filter((candidate) => candidate.score > 0);
    const selected =
      matched.length > 0
        ? this.fillCandidates(
            this.sortCandidates(matched).slice(0, maxCandidates),
            context.menuItems,
            maxCandidates,
          )
        : this.fallbackCandidates(context.menuItems, maxCandidates);
    const candidates = selected.map((candidate) =>
      this.toGroundedCandidate(candidate),
    );

    return {
      candidates,
      totalMenuItemsAvailable: context.menuItems.length,
      groundingMode: matched.length > 0 ? "ranked" : "fallback_featured",
      topMatchReasons: this.topReasons(candidates),
      exactMatchFound: candidates.some(
        (candidate) =>
          candidate.matchReasons.includes("exact_name_match") ||
          candidate.matchReasons.includes("exact_slug_match"),
      ),
      omittedMenuItemCount: Math.max(
        0,
        context.menuItems.length - candidates.length,
      ),
    };
  }

  private scoreItem(
    item: AiWaiterMenuItemSnapshot,
    index: number,
    query: ReturnType<typeof expandQueryTokens>,
    recentText: string,
  ): CandidateScore {
    const itemTokens = itemSearchTokens(item);
    const reasons = new Set<string>();
    let score = 0;

    if (containsPhrase(query.normalized, itemTokens.normalized)) {
      score += 220;
      reasons.add("exact_name_match");
    }

    if (containsPhrase(query.normalized, normalizeCustomerText(item.name))) {
      score += 180;
      reasons.add("exact_name_match");
    }

    if (containsPhrase(query.normalized, normalizeCustomerText(item.slug))) {
      score += 160;
      reasons.add("exact_slug_match");
    }

    const overlappingTokens = query.tokens.filter((token) =>
      itemTokens.tokens.includes(token),
    );

    if (overlappingTokens.length > 0) {
      score += overlappingTokens.length * 28;
      reasons.add("token_overlap");
    }

    if (this.hasTypoMatch(query.tokens, itemTokens.tokens)) {
      score += 36;
      reasons.add("typo_match");
    }

    if (
      itemTokens.category &&
      query.tokens.some((token) => itemTokens.category.includes(token))
    ) {
      score += 34;
      reasons.add("category_match");
    }

    const lexicon = scoreLexiconMatches({ query, item: itemTokens });

    if (lexicon.score > 0) {
      score += lexicon.score;
      lexicon.reasons.forEach((reason) => reasons.add(reason));
    }

    if (item.isFeatured && score > 0) {
      score += 10;
      reasons.add("featured_boost");
    }

    if (
      recentText &&
      (containsPhrase(recentText, normalizeCustomerText(item.name)) ||
        containsPhrase(recentText, normalizeCustomerText(item.slug)))
    ) {
      score += 24;
      reasons.add("recent_item_boost");
    }

    if (score > 0) {
      score += Math.max(0, 10 - index) * 0.1;
    }

    return {
      item,
      score,
      reasons: Array.from(reasons),
      index,
    };
  }

  private sortCandidates(candidates: CandidateScore[]) {
    return [...candidates].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (Number(b.item.isFeatured) !== Number(a.item.isFeatured)) {
        return Number(b.item.isFeatured) - Number(a.item.isFeatured);
      }

      return a.index - b.index;
    });
  }

  private fallbackCandidates(
    menuItems: AiWaiterMenuItemSnapshot[],
    maxCandidates: number,
  ) {
    const selected: CandidateScore[] = [];
    const seenCategory = new Set<string>();
    const sorted = [...menuItems]
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (Number(b.item.isFeatured) !== Number(a.item.isFeatured)) {
          return Number(b.item.isFeatured) - Number(a.item.isFeatured);
        }

        return a.index - b.index;
      });

    for (const entry of sorted) {
      const category = this.categoryText(entry.item) ?? "uncategorized";

      if (
        !seenCategory.has(category) ||
        selected.length < Math.ceil(maxCandidates / 2)
      ) {
        seenCategory.add(category);
        selected.push({
          item: entry.item,
          index: entry.index,
          score: entry.item.isFeatured ? 4 : 1,
          reasons: entry.item.isFeatured
            ? ["fallback_featured", "featured_boost"]
            : ["fallback_diverse"],
        });
      }

      if (selected.length >= maxCandidates) {
        break;
      }
    }

    if (selected.length < maxCandidates) {
      for (const entry of sorted) {
        if (selected.some((candidate) => candidate.item.id === entry.item.id)) {
          continue;
        }

        selected.push({
          item: entry.item,
          index: entry.index,
          score: entry.item.isFeatured ? 4 : 1,
          reasons: entry.item.isFeatured
            ? ["fallback_featured", "featured_boost"]
            : ["fallback_diverse"],
        });

        if (selected.length >= maxCandidates) {
          break;
        }
      }
    }

    return selected;
  }

  private fillCandidates(
    selected: CandidateScore[],
    menuItems: AiWaiterMenuItemSnapshot[],
    maxCandidates: number,
  ) {
    if (selected.length >= maxCandidates) {
      return selected;
    }

    const filled = [...selected];

    for (const candidate of this.fallbackCandidates(menuItems, maxCandidates)) {
      if (filled.some((entry) => entry.item.id === candidate.item.id)) {
        continue;
      }

      filled.push(candidate);

      if (filled.length >= maxCandidates) {
        break;
      }
    }

    return filled;
  }

  private toGroundedCandidate(
    candidate: CandidateScore,
  ): GroundedMenuCandidate {
    return {
      id: candidate.item.id,
      slug: candidate.item.slug,
      name: candidate.item.name,
      description: this.truncate(candidate.item.description ?? undefined),
      isFeatured: candidate.item.isFeatured,
      category: this.categoryText(candidate.item),
      score: Math.round(candidate.score * 100) / 100,
      matchReasons: candidate.reasons,
    };
  }

  private topReasons(candidates: GroundedMenuCandidate[]) {
    return Array.from(
      new Set(candidates.flatMap((candidate) => candidate.matchReasons)),
    ).slice(0, 8);
  }

  private hasTypoMatch(queryTokens: string[], itemTokens: string[]) {
    return queryTokens.some((queryToken) => {
      if (queryToken.length < 5) {
        return false;
      }

      return itemTokens.some((itemToken) => {
        if (itemToken.length < 5) {
          return false;
        }

        const distance = tokenEditDistance(queryToken, itemToken);

        return distance > 0 && distance <= 2;
      });
    });
  }

  private categoryText(item: AiWaiterMenuItemSnapshot) {
    return (
      [item.category?.name, item.category?.slug].filter(Boolean).join(" ") ||
      undefined
    );
  }

  private normalizeCandidateLimit(value: number | undefined) {
    if (!Number.isFinite(value) || !value) {
      return DEFAULT_CANDIDATE_LIMIT;
    }

    return Math.min(Math.max(Math.floor(value), 1), HARD_CANDIDATE_CAP);
  }

  private truncate(value: string | undefined) {
    if (!value) {
      return value;
    }

    return value.length > DESCRIPTION_LIMIT
      ? value.slice(0, DESCRIPTION_LIMIT).trim()
      : value;
  }
}

function containsPhrase(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  return ` ${haystack} `.includes(` ${needle} `);
}
