"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Send, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
      readiness.isReady && Boolean(cartQuery.data && cartQuery.data.items.length > 0),
    staleTime: 10_000
  });
  const refreshCart = () =>
    queryClient.invalidateQueries({ queryKey: customerQueryKeys.cart(sessionId) });
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
    ? formatErrorMessage(
        submitMutation.error,
        "Please try again."
      )
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
      eyebrow="Cart"
      title="Review before sending"
      description="The backend owns pricing and validation. This screen shows returned cart totals and submits with an idempotency key."
    >
      {cartQuery.isPending ? <LoadingState label="Loading cart" /> : null}
      {!readiness.isReady ? (
        <div className="mb-4 rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
          {readiness.message}
        </div>
      ) : null}
      {cartQuery.isError ? (
        <EmptyState
          title="Cart could not load"
          description={cartQuery.error.message}
        />
      ) : null}
      {cartQuery.isSuccess && isCartEmpty ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the menu and add something beautiful for the table."
          action={
            <Link
              href={`/customer/session/${sessionId}/menu`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Browse menu
            </Link>
          }
        />
      ) : null}
      {cart && cart.items.length > 0 ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="grid gap-3">
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
          <Card variant="glass" padding="lg" className="h-fit">
            <CardHeader>
              <CardTitle>Total</CardTitle>
              <CardDescription>
                {formatMoney(cart.totals.subtotalMinor, cart.totals.currency)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Note for this order
                <Input
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                  placeholder="Optional note"
                />
              </label>
              {validationQuery.isPending ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Validating cart
                </span>
              ) : null}
              {!isValid ? (
                <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
                  Cart needs attention before submitting.
                </div>
              ) : null}
              {submitErrorMessage ? (
                <div
                  role="alert"
                  className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  We could not submit your order yet. Please check the cart and
                  try again. {submitErrorMessage}
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button
                onClick={() =>
                  submitMutation.mutate({
                    idempotencyKey: createIdempotencyKey(sessionId),
                    payload: { customerNote: customerNote.trim() || null }
                  })
                }
                disabled={!canSubmit}
              >
                <Send className="size-4" aria-hidden="true" />
                {submitMutation.isPending ? "Sending..." : "Submit order"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear
              </Button>
            </CardFooter>
          </Card>
        </section>
      ) : null}
    </CustomerSessionScreen>
  );
}
