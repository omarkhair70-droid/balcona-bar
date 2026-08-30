"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Sparkles } from "lucide-react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
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
import { CartSummary } from "../cart-summary";
import { CustomerSessionScreen } from "../customer-session-screen";
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

  const featuredItems = useMemo(
    () =>
      categories
        .flatMap((category) => category.items)
        .filter(
          (item) =>
            item.isFeatured &&
            item.canOrder !== false &&
            item.isAvailable !== false &&
            item.status === "active"
        ),
    [categories]
  );

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
      <Link
        href={`/guest/session/${sessionId}/ai-waiter`}
        className="mb-4 flex w-full items-center gap-3 rounded-[18px] border border-border bg-muted px-3 py-2.5 text-start"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-black text-foreground">
            {t("menu.aiHelpTitle")}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {t("menu.aiHelpDescription")}
          </span>
        </span>
        <ChevronRight className="ms-auto size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
      </Link>

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
          action={
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
          }
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
        <>
          <MenuCategoryTabs
            categories={categories}
            activeCategoryId={activeCategory?.id}
            onSelect={setActiveCategoryId}
          />

          {featuredItems.length > 0 ? (
            <section className="pt-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-foreground">
                  {t("menu.featured")}
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  {t("menu.title")}
                </span>
              </div>
              <div className="no-scrollbar mt-2 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {featuredItems.slice(0, 6).map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    variant="feature"
                    onSelect={selectItem}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {activeCategory ? (
            <section className="pb-24 pt-5">
              <h2 className="text-sm font-black text-foreground">
                {activeCategory.name}
              </h2>
              <div className="mt-2 divide-y divide-border rounded-[22px] border border-border bg-card px-3">
                {activeCategory.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    variant="row"
                    onSelect={selectItem}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <CartSummary sessionId={sessionId} cart={cartQuery.data} />
        </>
      ) : null}

      {selectedItem ? (
        <>
          <ItemDetailPanel
            key={selectedItem.id}
            item={selectedItem}
            isAdding={addMutation.isPending}
            isAddDisabled={!readiness.isReady}
            disabledMessage={readiness.isReady ? undefined : readiness.message}
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
            <div className="fixed bottom-24 start-1/2 z-[60] w-[calc(100%-2rem)] max-w-[416px] -translate-x-1/2 rtl:translate-x-1/2">
              <CopyDebugReportButton
                action="cart_add_item"
                flow="customer_order_cycle"
                sessionId={sessionId}
                error={addMutation.error}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </CustomerSessionScreen>
  );
}
