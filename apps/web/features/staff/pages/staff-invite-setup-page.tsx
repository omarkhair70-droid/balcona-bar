"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useState
} from "react";
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

const inviteTheme = {
  colorScheme: "dark",
  "--background": "#17120F",
  "--foreground": "#FFF5E8",
  "--surface": "#1D1713",
  "--surface-2": "#211A15",
  "--surface-raised": "#241C17",
  "--surface-overlay": "rgba(29,23,19,.96)",
  "--primary": "#C68A4A",
  "--primary-foreground": "#1B120C",
  "--muted": "#2B221C",
  "--muted-foreground": "#A99A8D",
  "--border": "#3A2F27",
  "--ring": "#C68A4A",
  "--danger": "#FF8F86",
  "--success": "#84C38D",
  "--warning": "#E5B66D",
  "--shadow-card": "0 1px 0 rgba(255,255,255,.03)",
  "--shadow-elevated": "0 24px 70px rgba(0,0,0,.24)",
  "--shadow-glow": "none"
} as CSSProperties;

function InviteSurface({ children }: { children: ReactNode }) {
  return (
    <main
      style={inviteTheme}
      className="min-h-screen bg-[#17120F] text-[#FFF5E8]"
    >
      <header className="border-b border-[#352B24] bg-[#18130F]">
        <div className="mx-auto flex min-h-14 max-w-[1120px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Balcona">
            <span className="flex size-8 items-center justify-center rounded-md bg-[#C68A4A] text-xs font-black text-[#1B120C]">
              B
            </span>
            <span>
              <span className="block text-sm font-semibold text-[#FFF6E9]">
                Balcona Staff
              </span>
              <span className="block text-[10px] text-[#9F9184]">
                Secure workspace access
              </span>
            </span>
          </Link>
          <Link
            href="/staff/login"
            className="ms-auto inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold text-[#B8A99B] transition hover:bg-[#282019] hover:text-[#FFF5E8]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Staff login
          </Link>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-[1120px] items-center px-4 py-10 sm:px-6">
        <div className="grid w-full gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <section className="hidden lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A98A6A]">
              STAFF ONBOARDING
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#FFF4E6]">
              Join the operating workspace.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-[#A99A8D]">
              Your role, company and branch access were prepared before this link was issued.
            </p>
            <div className="mt-8 flex items-start gap-3 border-t border-[#30261F] pt-5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#2C211A] text-[#D5A365]">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <p className="max-w-sm text-xs leading-5 text-[#928579]">
                This step only activates your staff password. Your workspace permissions stay scoped to the invite.
              </p>
            </div>
          </section>

          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}

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
      <InviteSurface>
        <div className="rounded-xl border border-[#3A2F27] bg-[#1D1713] p-6 shadow-[0_24px_70px_rgba(0,0,0,.22)]">
          <LoadingState label="Loading staff invite" />
        </div>
      </InviteSurface>
    );
  }

  if (inviteQuery.isError) {
    return (
      <InviteSurface>
        <div className="rounded-xl border border-[#3A2F27] bg-[#1D1713] p-6 shadow-[0_24px_70px_rgba(0,0,0,.22)]">
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
        </div>
      </InviteSurface>
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
    <InviteSurface>
      <Card
        variant="quiet"
        padding="lg"
        className="w-full border-[#3A2F27] bg-[#1D1713] shadow-[0_24px_70px_rgba(0,0,0,.22)]"
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant={statusVariant(invite.status)} className="mb-3">
                {invite.status}
              </Badge>
              <CardTitle>Staff password setup</CardTitle>
              <CardDescription>{statusMessage(invite, canAccept)}</CardDescription>
            </div>
            <div className="flex size-10 items-center justify-center rounded-md bg-[#2C211A] text-[#D5A365]">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-md border border-[#3A2F27] bg-[#17120F] p-4 text-sm">
            <div>
              <p className="font-semibold text-[#FFF5E8]">
                {invite.company?.name ?? "Workspace"}
              </p>
              <p className="mt-1 text-[#A99A8D]">
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
              className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-success"
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
              <label className="grid gap-2 text-sm font-medium text-[#DCCFC3]">
                Password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-[#44372E] bg-[#17120F] text-[#FFF5E8]"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#DCCFC3]">
                Confirm password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="border-[#44372E] bg-[#17120F] text-[#FFF5E8]"
                />
              </label>
              {formError || mutation.isError ? (
                <div
                  role="alert"
                  className="rounded-md border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {formError ?? formatErrorMessage(mutation.error)}
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={Boolean(formError) || mutation.isPending}
                className="min-h-11 bg-[#C68A4A] text-[#1B120C] hover:bg-[#D39A57]"
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
    </InviteSurface>
  );
}
