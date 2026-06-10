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
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";

export function PlatformLoginPage() {
  const t = useTranslations("platform");
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
      title={t("auth.loginTitle")}
      description={t("auth.loginDescription")}
      actions={
        <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("auth.staffSurface")}
        </Link>
      }
    >
      <section className="mx-auto grid max-w-3xl gap-5 lg:grid-cols-[1fr_18rem]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>{t("auth.openSessionTitle")}</CardTitle>
            <CardDescription>
              {t("auth.openSessionDescription")}
            </CardDescription>
          </CardHeader>
          <form onSubmit={submitLogin}>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t("auth.email")}
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
                {t("auth.password")}
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("auth.passwordPlaceholder")}
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
                    t("errors.loginFailed")
                  )}
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loginMutation.isPending}>
                <LogIn className="size-4" aria-hidden="true" />
                {loginMutation.isPending
                  ? t("auth.signingIn")
                  : t("auth.signIn")}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card variant="quiet" padding="lg" className="h-fit">
          <CardHeader>
            <CardTitle>{t("auth.internalOnlyTitle")}</CardTitle>
            <CardDescription>
              {t("auth.internalOnlyDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </PlatformShell>
  );
}
