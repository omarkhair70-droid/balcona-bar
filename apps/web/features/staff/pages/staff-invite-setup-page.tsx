"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, LogIn, RefreshCw } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { formatErrorMessage } from "@/lib/api/error-message";
import { acceptStaffInvite, getStaffInvite } from "@/lib/api/endpoints";
import type { StaffInviteSummary } from "@/lib/api/types";
import { getStaffRoleLabel } from "../setup-data";

function statusVariant(status?: string | null) {
  if (status === "pending") {
    return "warning" as const;
  }

  if (status === "accepted") {
    return "success" as const;
  }

  if (status === "expired" || status === "revoked") {
    return "danger" as const;
  }

  return "muted" as const;
}

function statusMessage(invite: StaffInviteSummary, canAccept: boolean) {
  if (canAccept) {
    return "Set a password to activate staff login for this workspace.";
  }

  if (invite.status === "accepted") {
    return "This staff invite has already been accepted.";
  }

  if (invite.status === "expired") {
    return "This staff invite has expired.";
  }

  if (invite.status === "revoked") {
    return "This staff invite was replaced by a newer invite.";
  }

  return "This staff invite is not available.";
}

export function StaffInviteSetupPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const inviteQuery = useQuery({
    queryKey: ["staff-invite", token],
    queryFn: () => getStaffInvite(token),
    staleTime: 10_000
  });
  const mutation = useMutation({
    mutationFn: () => acceptStaffInvite(token, { password }),
    onSuccess: () => {
      setPassword("");
      setConfirmPassword("");
      void inviteQuery.refetch();
    }
  });

  if (inviteQuery.isPending) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <LoadingState label="Loading staff invite" />
      </main>
    );
  }

  if (inviteQuery.isError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <EmptyState
          title="Invite could not be loaded"
          description={formatErrorMessage(inviteQuery.error)}
          action={
            <Button onClick={() => inviteQuery.refetch()} variant="secondary">
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
      </main>
    );
  }

  const { invite, canAccept } = inviteQuery.data;
  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 12;
  const formError = !passwordLongEnough
    ? "Password must be at least 12 characters."
    : !passwordsMatch
      ? "Password confirmation does not match."
      : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formError && canAccept) {
      mutation.mutate();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <Card variant="glass" padding="lg" className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant={statusVariant(invite.status)} className="mb-3">
                {invite.status}
              </Badge>
              <CardTitle>Staff password setup</CardTitle>
              <CardDescription>{statusMessage(invite, canAccept)}</CardDescription>
            </div>
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-button border bg-surface/70 p-4 text-sm">
            <div>
              <p className="font-semibold text-foreground">
                {invite.company?.name ?? "Workspace"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {invite.branch?.name ?? "Company access"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">{getStaffRoleLabel(invite.role)}</Badge>
              <Badge variant="muted">{invite.email}</Badge>
            </div>
          </div>

          {mutation.isSuccess ? (
            <div
              role="status"
              className="rounded-button border border-success/40 bg-success/10 p-4 text-sm text-success"
            >
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Password saved
              </div>
              <Link
                href="/staff/login"
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "mt-3"
                })}
              >
                <LogIn className="size-4" aria-hidden="true" />
                Staff login
              </Link>
            </div>
          ) : null}

          {canAccept && !mutation.isSuccess ? (
            <form className="grid gap-3" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Confirm password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              {formError || mutation.isError ? (
                <div
                  role="alert"
                  className="rounded-button border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {formError ?? formatErrorMessage(mutation.error)}
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={Boolean(formError) || mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                Save password
              </Button>
            </form>
          ) : null}
        </CardContent>
        <CardFooter>
          <Link href="/staff/login" className={buttonVariants({ variant: "ghost" })}>
            Staff login
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
