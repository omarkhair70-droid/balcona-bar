"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Send, Trash2 } from "lucide-react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import {
  clearCart,
  getCart,
  removeCartItem,
  submitCart,
  updateCartItem,
  validateCart
} from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { SubmitCartPayload } from "@/lib/api/types";
import { withCustomerTransientRetry } from "@/lib/customer/customer-api-reliability";
import {
  assertCustomerSessionReady,
  getCustomerSessionReadiness
} from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CartItemRow } from "../cart-item-row";
import { CustomerSessionScreen } from "../customer-session-screen";
import { formatMoney } from "../customer-format";

type CustomerCartPageProps = {
  sessionId: string;
};

const CUSTOMER_MUTATION_TIMEOUT_MS = 15_000;

function createIdempotencyKey(sessionId: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cart-submit-${sessionId}-${crypto.randomUUID()}`;
  }

  return `cart-submit-${sessionId}-${Date.now()}`;
}

export function CustomerCartPage({ sessionId }: CustomerCartPageProps) {
  const t = useTranslations("customer");
  const router = useRouter();
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
  const [customerNote, setCustomerNote] = useState("");

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

  const validationQuery = useQuery({
    queryKey: customerQueryKeys.cartValidation(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return validateCart(ready.sessionId, ready.customerAccessToken);
    },
    enabled:
      readiness.isReady &&
      Boolean(cartQuery.data && cartQuery.data.items.length > 0),
    staleTime: 10_000
  });

  const refreshCart = () =>
    queryClient.invalidateQueries({
      queryKey: customerQueryKeys.cart(sessionId)
    });

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return updateCartItem(id, { quantity }, ready.customerAccessToken);
    },
    onSuccess: () => {
      void refreshCart();
    }
  });

  const removeMutation = useMutation({
    mutationFn: (cartItemId: string) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return removeCartItem(cartItemId, ready.customerAccessToken);
    },
    onSuccess: () => {
      void refreshCart();
    }
  });

  const clearMutation = useMutation({
    mutationFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return clearCart(ready.sessionId, ready.customerAccessToken);
    },
    onSuccess: () => {
      void refreshCart();
    }
  });

  const submitMutation = useMutation({
    mutationFn: ({
      idempotencyKey,
      payload
    }: {
      idempotencyKey: string;
      payload: SubmitCartPayload;
    }) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return withCustomerTransientRetry(
        () =>
          submitCart(
            ready.sessionId,
            payload,
            idempotencyKey,
            ready.customerAccessToken,
            { timeoutMs: CUSTOMER_MUTATION_TIMEOUT_MS }
          ),
        {
          flow: "submit_cart",
          maxAttempts: 3
        }
      );
    },
    onSuccess: () => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.cart(sessionId)
      });
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.cartValidation(sessionId)
      });
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.orders(sessionId)
      });
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.status(sessionId)
      });
      router.push(`/customer/session/${sessionId}/status`);
    },
    onError: () => {
      vibrateWarning();
    }
  });

  const cart = cartQuery.data;
  const isCartEmpty = !cart || cart.items.length === 0;
  const isValid = validationQuery.data?.isValid ?? true;
  const canSubmit =
    readiness.isReady &&
    cartQuery.isSuccess &&
    !isCartEmpty &&
    !validationQuery.isPending &&
    isValid &&
    !submitMutation.isPending;

  const submitErrorMessage = submitMutation.isError
    ? formatErrorMessage(submitMutation.error, t("cart.submitFallback"))
    : null;

  const pendingItemId = useMemo(() => {
    if (updateMutation.isPending && updateMutation.variables) {
      return updateMutation.variables.id;
    }

    if (removeMutation.isPending && removeMutation.variables) {
      return removeMutation.variables;
    }

    return undefined;
  }, [
    removeMutation.isPending,
    removeMutation.variables,
    updateMutation.isPending,
    updateMutation.variables
  ]);

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="cart"
      eyebrow={t("cart.eyebrow")}
      title={t("cart.title")}
      description={t("cart.description")}
    >
      {cartQuery.isPending ? <LoadingState label={t("cart.loading")} /> : null}

      {!readiness.isReady ? (
        <div className="mb-4 rounded-xl border border-warning bg-warning/10 p-3 text-sm text-warning">
          {readiness.message}
        </div>
      ) : null}

      {cartQuery.isError ? (
        <EmptyState
          title={t("cart.errorTitle")}
          description={cartQuery.error.message}
          debug={{
            action: "cart_get",
            flow: "customer_order_cycle",
            sessionId,
            error: cartQuery.error
          }}
        />
      ) : null}

      {cartQuery.isSuccess && isCartEmpty ? (
        <EmptyState
          title={t("cart.emptyTitle")}
          description={t("cart.emptyDescription")}
          action={
            <Link
              href={`/customer/session/${sessionId}/menu`}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("actions.browseMenu")}
            </Link>
          }
        />
      ) : null}

      {cart && cart.items.length > 0 ? (
        <section className="pb-8">
          <div className="divide-y divide-border rounded-[22px] border border-border bg-card px-3">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                isPending={pendingItemId === item.id}
                onQuantityChange={(quantity) =>
                  updateMutation.mutate({ id: item.id, quantity })
                }
                onRemove={() => removeMutation.mutate(item.id)}
              />
            ))}
          </div>

          <label className="mt-4 block text-xs font-black text-foreground">
            {t("cart.noteLabel")}
            <Input
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)}
              placeholder={t("cart.notePlaceholder")}
              maxLength={500}
              className="mt-2 min-h-12 rounded-xl bg-card text-sm font-normal"
            />
          </label>

          <div className="mt-4 rounded-2xl bg-muted p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t("cart.total")}</span>
              <strong className="text-foreground">
                {formatMoney(
                  cart.totals.subtotalMinor,
                  cart.totals.currency
                )}
              </strong>
            </div>

            {validationQuery.isPending ? (
              <span className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                {t("cart.validating")}
              </span>
            ) : null}

            {!isValid ? (
              <div className="mt-3 rounded-xl border border-warning bg-warning/10 p-3 text-sm text-warning">
                {t("cart.needsAttention")}
              </div>
            ) : null}
          </div>

          {submitErrorMessage ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {t("cart.submitError", { message: submitErrorMessage })}
              <div className="mt-3">
                <CopyDebugReportButton
                  action="cart_submit"
                  flow="customer_order_cycle"
                  sessionId={sessionId}
                  error={submitMutation.error}
                />
              </div>
            </div>
          ) : null}

          <Button
            onClick={() =>
              submitMutation.mutate({
                idempotencyKey: createIdempotencyKey(sessionId),
                payload: { customerNote: customerNote.trim() || null }
              })
            }
            disabled={!canSubmit}
            className="mt-4 min-h-14 w-full rounded-2xl text-sm font-black"
          >
            <Send className="size-4" aria-hidden="true" />
            {submitMutation.isPending
              ? t("cart.submitting")
              : `${t("cart.submitOrder")} · ${formatMoney(
                  cart.totals.subtotalMinor,
                  cart.totals.currency
                )}`}
          </Button>

          <Button
            variant="ghost"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="mt-2 w-full text-muted-foreground"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("cart.clear")}
          </Button>
        </section>
      ) : null}
    </CustomerSessionScreen>
  );
}
