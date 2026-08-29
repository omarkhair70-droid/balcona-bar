"use client";

import { cn } from "@/lib/utils/cn";
import type { BranchMenuCategory } from "@/lib/api/types";

type MenuCategoryTabsProps = {
  categories: BranchMenuCategory[];
  activeCategoryId?: string;
  onSelect: (categoryId: string) => void;
};

export function MenuCategoryTabs({
  categories,
  activeCategoryId,
  onSelect
}: MenuCategoryTabsProps) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto border-y border-border bg-background/95 px-4 py-2.5 backdrop-blur">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={cn(
            "min-h-9 shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-4 text-xs font-black text-muted-foreground transition hover:bg-muted hover:text-foreground",
            activeCategoryId === category.id &&
              "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
