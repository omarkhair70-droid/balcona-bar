"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, LogIn } from "lucide-react";
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
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { platformLogin } from "@/lib/api/endpoints";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";

export function PlatformLoginPage() {
  const router = useRouter();
  const setFromLogin = usePlatformAuthStore((state) => state.setFromLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useMutation({
    mutationFn: () =>
      platformLogin({
        email: email.trim(),
        password
      }),
    onSuccess: (result) => {
      setFromLogin(result);
      router.replace("/platform");
    }
  });
  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate();
  };

  return (
    <PlatformShell
      title="Platform login"
      description="Internal sales and support access for cafe workspace bootstrap. Tenant staff accounts cannot open this surface."
      actions={
        <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Staff surface
        </Link>
      }
    >
      <section className="mx-auto grid max-w-3xl gap-5 lg:grid-cols-[1fr_18rem]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Open platform session</CardTitle>
            <CardDescription>
              Use the platform admin account created by the explicit local dev
              bootstrap seed. Sessions are opaque, database-backed, and
              separate from staff auth.
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
                  placeholder="platform@balcona.local"
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
                  placeholder="Platform password"
                  required
                />
              </label>
              {loginMutation.isError ? (
                <div
                  role="alert"
                  className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {formatErrorMessage(
                    loginMutation.error,
                    "Platform login failed. Check credentials and dev bootstrap."
                  )}
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
            <CardTitle>Internal only</CardTitle>
            <CardDescription>
              This is the sales-led bootstrap surface. Public signup,
              subscription checkout, and real email invitations remain future
              phases.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </PlatformShell>
  );
}
