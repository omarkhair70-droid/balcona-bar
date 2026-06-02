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
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={cn(
            "min-h-10 whitespace-nowrap rounded-button border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground",
            activeCategoryId === category.id &&
              "border-primary bg-primary text-primary-foreground"
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
