import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MenuItemSummary } from "@/lib/api/types";
import { getMenuItemPrice, formatMoney } from "./customer-format";

type MenuItemCardProps = {
  item: MenuItemSummary;
  onSelect: (item: MenuItemSummary) => void;
};

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isUnavailable = item.isAvailable === false || item.status !== "active";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      disabled={isUnavailable}
      className="text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Card variant="glass" className="h-full overflow-hidden transition hover:border-primary/60">
        {item.imageUrl ? (
          <div
            className="h-32 bg-cover bg-center"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="h-32 bg-gradient-to-br from-primary/30 via-surface-2 to-accent/25" />
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription className="mt-2 line-clamp-2">
                {item.description ?? "Prepared for this table experience."}
              </CardDescription>
            </div>
            {item.isFeatured ? <Badge>Featured</Badge> : null}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-primary">
              {formatMoney(getMenuItemPrice(item), item.currency)}
            </span>
            {item.station ? (
              <Badge variant="muted" className="capitalize">
                {item.station}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>
    </button>
  );
}
