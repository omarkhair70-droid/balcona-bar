"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { formatErrorMessage } from "@/lib/api/error-message";
import { addCartItem, getBranchMenu, getCart } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { AddCartItemPayload, MenuItemSummary } from "@/lib/api/types";
import { withCustomerTransientRetry } from "@/lib/customer/customer-api-reliability";
import {
  assertCustomerSessionReady,
  getCustomerSessionReadiness
} from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerSessionScreen } from "../customer-session-screen";
import { CartSummary } from "../cart-summary";
import { ItemDetailPanel } from "../item-detail-panel";
import { MenuCategoryTabs } from "../menu-category-tabs";
import { MenuItemCard } from "../menu-item-card";

type CustomerMenuPageProps = {
  sessionId: string;
};

const CUSTOMER_MUTATION_TIMEOUT_MS = 12_000;

function createAddCartIdempotencyKey(sessionId: string, menuItemId: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cart-add-${sessionId}-${menuItemId}-${crypto.randomUUID()}`;
  }

  return `cart-add-${sessionId}-${menuItemId}-${Date.now()}`;
}

export function CustomerMenuPage({ sessionId }: CustomerMenuPageProps) {
  const t = useTranslations("customer");
  const queryClient = useQueryClient();
  const hasHydrated = useCustomerSessionStore((state) => state.hasHydrated);
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const expiresAt = useCustomerSessionStore(
    (state) => state.customerAccessTokenExpiresAt
  );
  const readiness = getCustomerSessionReadiness(
    {
      hasHydrated,
      sessionId: storedSessionId,
      branchId,
      customerAccessToken: token,
      customerAccessTokenExpiresAt: expiresAt
    },
    sessionId
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string>();
  const [selectedItem, setSelectedItem] = useState<MenuItemSummary | null>(null);
  const menuQuery = useQuery({
    queryKey: customerQueryKeys.menu(branchId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getBranchMenu(ready.branchId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
    staleTime: 30_000
  });
  const cartQuery = useQuery({
    queryKey: customerQueryKeys.cart(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getCart(ready.sessionId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
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
    mutationFn: (payload: AddCartItemPayload) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );
      const idempotencyKey = createAddCartIdempotencyKey(
        ready.sessionId,
        payload.menuItemId
      );

      return withCustomerTransientRetry(
        () =>
          addCartItem(
            ready.sessionId,
            payload,
            ready.customerAccessToken,
            {
              idempotencyKey,
              timeoutMs: CUSTOMER_MUTATION_TIMEOUT_MS
            }
          ),
        {
          flow: "add_cart_item",
          maxAttempts: 3
        }
      );
    },
    onSuccess: () => {
      setSelectedItem(null);
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.cart(sessionId)
      });
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.status(sessionId)
      });
    }
  });
  const selectItem = (item: MenuItemSummary) => {
    addMutation.reset();
    setSelectedItem(item);
  };

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="menu"
      eyebrow={t("menu.eyebrow")}
      title={t("menu.title")}
      description={t("menu.description")}
    >
      <div className="mb-5 rounded-card border border-primary/40 bg-primary/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("menu.aiHelpTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("menu.aiHelpDescription")}
              </p>
            </div>
          </div>
          <Link
            href={`/customer/session/${sessionId}/ai-waiter`}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("actions.askAiWaiter")}
          </Link>
        </div>
      </div>
      {!readiness.isReady ? (
        <EmptyState
          title={t("menu.tableAccessLoading")}
          description={readiness.message}
        />
      ) : null}
      {menuQuery.isPending ? <LoadingState label={t("menu.loading")} /> : null}
      {menuQuery.isError ? (
        <EmptyState
          title={t("errors.menuLoad")}
          description={menuQuery.error.message}
          action={<AlertTriangle className="size-5 text-warning" aria-hidden="true" />}
          debug={{
            action: "menu_load",
            flow: "customer_order_cycle",
            sessionId,
            error: menuQuery.error
          }}
        />
      ) : null}
      {menuQuery.isSuccess && categories.length === 0 ? (
        <EmptyState
          title={t("empty.menuUnavailableTitle")}
          description={t("empty.menuUnavailableDescription")}
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
                  {t("menu.featured")}
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {featuredItems.slice(0, 4).map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onSelect={selectItem}
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
                      onSelect={selectItem}
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
              <>
                <ItemDetailPanel
                  item={selectedItem}
                  isAdding={addMutation.isPending}
                  isAddDisabled={!readiness.isReady}
                  disabledMessage={
                    readiness.isReady ? undefined : readiness.message
                  }
                  errorMessage={
                    addMutation.isError
                      ? t("errors.addCartItem", {
                          message: formatErrorMessage(addMutation.error)
                        })
                      : undefined
                  }
                  onClose={() => setSelectedItem(null)}
                  onAdd={async (payload) => {
                    await addMutation.mutateAsync(payload);
                  }}
                />
                {addMutation.isError ? (
                  <div className="mt-3">
                    <CopyDebugReportButton
                      action="cart_add_item"
                      flow="customer_order_cycle"
                      sessionId={sessionId}
                      error={addMutation.error}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                title={t("empty.selectItemTitle")}
                description={t("empty.selectItemDescription")}
              />
            )}
          </aside>
        </section>
      ) : null}
    </CustomerSessionScreen>
  );
}
