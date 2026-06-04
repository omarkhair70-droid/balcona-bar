"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import { staffLogin } from "@/lib/api/endpoints";
import { getDefaultStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";

const loginErrorFallback =
  "Login failed. Check credentials and local password bootstrap.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadableMessage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("[object Object]")
  );
}

function getDetailsMessage(details: unknown) {
  if (!isRecord(details)) {
    return undefined;
  }

  const message = details.message;

  if (Array.isArray(message)) {
    const joinedMessage = message
      .filter((entry): entry is string => isReadableMessage(entry))
      .join(", ");

    return joinedMessage.length > 0 ? joinedMessage : undefined;
  }

  if (isReadableMessage(message)) {
    return message;
  }

  return isReadableMessage(details.error) ? details.error : undefined;
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof Error && isReadableMessage(error.message)) {
    return error.message;
  }

  if (isRecord(error)) {
    const detailsMessage = getDetailsMessage(error.details);

    if (detailsMessage) {
      return detailsMessage;
    }

    if (isReadableMessage(error.message)) {
      return error.message;
    }
  }

  return loginErrorFallback;
}

export function StaffLoginPage() {
  const router = useRouter();
  const setFromLogin = useStaffAuthStore((state) => state.setFromLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState("");
  const loginMutation = useMutation({
    mutationFn: () =>
      staffLogin({
        email: email.trim(),
        password,
        branchId: branchId.trim() || undefined
      }),
    onSuccess: (result) => {
      setFromLogin(result);
      router.replace(
        getDefaultStaffRoute(result.effectiveAccess, result.defaultBranch?.id)
      );
    }
  });
  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate();
  };

  return (
    <StaffPageShell
      title="Staff login"
      description="Sign in to open branch operations. The session is restored locally and validated through the staff auth API."
      actions={
        <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Staff overview
        </Link>
      }
    >
      <section className="mx-auto grid max-w-3xl gap-5 lg:grid-cols-[1fr_18rem]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Open staff session</CardTitle>
            <CardDescription>
              Use a staff account with branch access. Branch ID is optional and
              the dashboard can use the default branch returned by the backend.
            </CardDescription>
          </CardHeader>
          <form onSubmit={submitLogin}>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Email
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="staff@example.com"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Password
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Branch ID
                <Input
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              {loginMutation.isError ? (
                <div
                  role="alert"
                  className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {getLoginErrorMessage(loginMutation.error)}
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loginMutation.isPending}>
                <LogIn className="size-4" aria-hidden="true" />
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card variant="quiet" padding="lg" className="h-fit">
          <CardHeader>
            <CardTitle>Session rules</CardTitle>
            <CardDescription>
              Staff tokens are stored locally, sent as bearer tokens for staff
              endpoints, and cleared on logout or failed restoration.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </StaffPageShell>
  );
}
