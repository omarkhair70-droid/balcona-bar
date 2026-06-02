"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { addCartItem, getBranchMenu, getCart } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { AddCartItemPayload, MenuItemSummary } from "@/lib/api/types";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { CustomerSessionScreen } from "../customer-session-screen";
import { CartSummary } from "../cart-summary";
import { ItemDetailPanel } from "../item-detail-panel";
import { MenuCategoryTabs } from "../menu-category-tabs";
import { MenuItemCard } from "../menu-item-card";

type CustomerMenuPageProps = {
  sessionId: string;
};

export function CustomerMenuPage({ sessionId }: CustomerMenuPageProps) {
  const queryClient = useQueryClient();
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const [activeCategoryId, setActiveCategoryId] = useState<string>();
  const [selectedItem, setSelectedItem] = useState<MenuItemSummary | null>(null);
  const menuQuery = useQuery({
    queryKey: customerQueryKeys.menu(branchId),
    queryFn: () => getBranchMenu(branchId ?? "", token),
    enabled: Boolean(branchId),
    staleTime: 30_000
  });
  const cartQuery = useQuery({
    queryKey: customerQueryKeys.cart(sessionId),
    queryFn: () => getCart(sessionId, token),
    staleTime: 10_000
  });
  const categories = useMemo(
    () => menuQuery.data?.categories ?? [],
    [menuQuery.data?.categories]
  );
  const activeCategory = useMemo(
    () =>
      categories.find((category) => category.id === activeCategoryId) ??
      categories[0],
    [activeCategoryId, categories]
  );
  const featuredItems = categories
    .flatMap((category) => category.items)
    .filter((item) => item.isFeatured);
  const addMutation = useMutation({
    mutationFn: (payload: AddCartItemPayload) =>
      addCartItem(sessionId, payload, token),
    onSuccess: () => {
      setSelectedItem(null);
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.cart(sessionId)
      });
    }
  });

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="menu"
      eyebrow="Visual menu"
      title="Choose for the table"
      description="Browse live branch menu categories, inspect modifiers, and add items to the backend cart."
    >
      {!branchId ? (
        <EmptyState
          title="Table branch is not loaded"
          description="Open the table QR route again so the PWA can load the branch menu."
        />
      ) : null}
      {menuQuery.isPending ? <LoadingState label="Loading menu" /> : null}
      {menuQuery.isError ? (
        <EmptyState
          title="Menu could not load"
          description={menuQuery.error.message}
          action={<AlertTriangle className="size-5 text-warning" aria-hidden="true" />}
        />
      ) : null}
      {menuQuery.isSuccess && categories.length === 0 ? (
        <EmptyState
          title="No menu is available"
          description="This branch does not have visible items yet."
        />
      ) : null}
      {categories.length > 0 ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_24rem]">
          <div className="min-w-0">
            <MenuCategoryTabs
              categories={categories}
              activeCategoryId={activeCategory?.id}
              onSelect={setActiveCategoryId}
            />
            {featuredItems.length > 0 ? (
              <section className="mt-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Featured
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {featuredItems.slice(0, 4).map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onSelect={setSelectedItem}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {activeCategory ? (
              <section className="mt-5">
                <h2 className="text-lg font-semibold text-foreground">
                  {activeCategory.name}
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {activeCategory.items.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onSelect={setSelectedItem}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            <div className="mt-5">
              <CartSummary sessionId={sessionId} cart={cartQuery.data} />
            </div>
          </div>
          <aside>
            {selectedItem ? (
              <ItemDetailPanel
                item={selectedItem}
                isAdding={addMutation.isPending}
                onClose={() => setSelectedItem(null)}
                onAdd={async (payload) => {
                  await addMutation.mutateAsync(payload);
                }}
              />
            ) : (
              <EmptyState
                title="Select an item"
                description="Details, required modifiers, notes, and quantity controls appear here."
              />
            )}
          </aside>
        </section>
      ) : null}
    </CustomerSessionScreen>
  );
}
