"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import { formatErrorMessage } from "@/lib/api/error-message";

type MockCheckoutResult = {
  outcome?: string;
  onlinePaymentIntent?: {
    id?: string;
    status?: string;
  };
  bill?: {
    id?: string;
    status?: string;
    balanceDueMinor?: number;
    currency?: string;
  } | null;
};

export function MockPaymentCheckoutPage({
  providerIntentId
}: {
  providerIntentId: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "success" | "failed">(
    "idle"
  );
  const [error, setError] = useState("");

  const finish = async (status: "succeeded" | "failed") => {
    if (state === "working") {
      return;
    }

    setState("working");
    setError("");

    try {
      await apiRequest<MockCheckoutResult>(
        "/online-payments/webhooks/mock",
        {
          method: "POST",
          body: {
            providerIntentId,
            providerEventId: `reviewer_${Date.now()}`,
            status,
            ...(status === "failed"
              ? {
                  failureCode: "reviewer_declined",
                  failureMessage: "Reviewer demo payment declined"
                }
              : {})
          },
          flow: "reviewer_payment",
          action: `reviewer_payment_${status}`,
          timeoutMs: 10_000
        }
      );

      if (status === "succeeded") {
        setState("success");
        window.setTimeout(() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.assign("/");
          }
        }, 900);
      } else {
        setState("failed");
      }
    } catch (caught) {
      setError(formatErrorMessage(caught, "Demo payment could not be completed."));
      setState("idle");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex min-h-[75vh] w-full max-w-xl items-center">
        <section className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                Balcona reviewer checkout
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Demo payment
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This checkout simulates the PSP confirmation path for the public
                review environment. No real money or card data is used.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-muted/45 p-4">
            <p className="text-xs font-bold text-muted-foreground">
              Provider intent
            </p>
            <p className="mt-1 break-all font-mono text-xs text-foreground">
              {providerIntentId}
            </p>
          </div>

          {state === "success" ? (
            <div className="mt-6 rounded-2xl border border-success/30 bg-success/10 p-4 text-success">
              <div className="flex items-center gap-2 font-black">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                Payment confirmed
              </div>
              <p className="mt-1 text-sm leading-6">
                Balcona has applied the demo provider confirmation and is
                returning to the bill.
              </p>
            </div>
          ) : null}

          {state === "failed" ? (
            <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-danger">
              <div className="flex items-center gap-2 font-black">
                <XCircle className="size-5" aria-hidden="true" />
                Payment declined
              </div>
              <p className="mt-1 text-sm leading-6">
                The bill was not settled. Go back and retry to inspect the
                failure path.
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm leading-6"
            >
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button
              className="min-h-12"
              disabled={state === "working" || state === "success"}
              onClick={() => void finish("succeeded")}
            >
              {state === "working" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              Complete demo payment
            </Button>
            <Button
              variant="secondary"
              className="min-h-12"
              disabled={state === "working" || state === "success"}
              onClick={() => void finish("failed")}
            >
              <XCircle className="size-4" aria-hidden="true" />
              Simulate decline
            </Button>
          </div>

          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => window.history.back()}
          >
            Back to bill
          </Button>

          <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">
            Reviewer mode proves Balcona&apos;s intent, settlement, receipt,
            realtime, Service, and Money workflow without claiming a live
            merchant transaction.
          </p>
        </section>
      </div>
    </main>
  );
}
