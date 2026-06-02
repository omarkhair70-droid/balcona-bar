"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, LoaderCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { startTableSession } from "@/lib/api/endpoints";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { CustomerShell } from "@/features/customer/customer-shell";

type CustomerTableStartPageProps = {
  qrToken: string;
};

export function CustomerTableStartPage({
  qrToken
}: CustomerTableStartPageProps) {
  const router = useRouter();
  const setFromStartResult = useCustomerSessionStore(
    (state) => state.setFromStartResult
  );
  const startMutation = useMutation({
    mutationFn: () => startTableSession({ qrToken }),
    onSuccess: (result) => {
      setFromStartResult(qrToken, result);
      router.replace(`/customer/session/${result.session.id}`);
    }
  });
  const { isIdle, mutate } = startMutation;

  useEffect(() => {
    if (!isIdle) {
      return;
    }

    mutate();
  }, [isIdle, mutate]);

  return (
    <CustomerShell
      eyebrow="Opening table"
      title="Preparing your table session"
      description="We are starting or resuming your table session and storing the customer access token locally for this PWA flow."
    >
      <Card variant="glass" padding="lg" className="mb-8">
        <CardHeader>
          <div className="text-primary">
            {startMutation.isError ? (
              <AlertTriangle className="size-7" aria-hidden="true" />
            ) : (
              <QrCode className="size-7" aria-hidden="true" />
            )}
          </div>
          <CardTitle>
            {startMutation.isError ? "Table link could not open" : qrToken}
          </CardTitle>
          <CardDescription>
            {startMutation.isError
              ? startMutation.error.message
              : "Connecting to the table session..."}
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3 px-6 pb-6">
          {startMutation.isPending ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Starting session
            </span>
          ) : null}
          {startMutation.isError ? (
            <>
              <Button onClick={() => startMutation.mutate()}>Try again</Button>
              <Button variant="secondary" onClick={() => router.push("/customer")}>
                Back
              </Button>
            </>
          ) : null}
        </div>
      </Card>
    </CustomerShell>
  );
}
