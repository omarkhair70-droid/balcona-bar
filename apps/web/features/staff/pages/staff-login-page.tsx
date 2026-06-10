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
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { getDefaultStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";

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

function getLoginErrorMessage(error: unknown, fallback: string) {
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

  return fallback;
}

export function StaffLoginPage() {
  const t = useTranslations("staff");
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
      title={t("auth.title")}
      description={t("auth.loginDescription")}
      actions={
        <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("actions.overview")}
        </Link>
      }
    >
      <section className="mx-auto grid max-w-3xl gap-5 lg:grid-cols-[1fr_18rem]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>{t("auth.openSessionTitle")}</CardTitle>
            <CardDescription>{t("auth.openSessionDescription")}</CardDescription>
          </CardHeader>
          <form onSubmit={submitLogin}>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t("auth.emailLabel")}
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t("auth.passwordLabel")}
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("auth.passwordPlaceholder")}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t("auth.branchIdLabel")}
                <Input
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  placeholder={t("auth.branchIdPlaceholder")}
                />
              </label>
              {loginMutation.isError ? (
                <div
                  role="alert"
                  className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {getLoginErrorMessage(
                    loginMutation.error,
                    t("auth.loginFallback")
                  )}
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loginMutation.isPending}>
                <LogIn className="size-4" aria-hidden="true" />
                {loginMutation.isPending
                  ? t("actions.signingIn")
                  : t("actions.signIn")}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card variant="quiet" padding="lg" className="h-fit">
          <CardHeader>
            <CardTitle>{t("auth.sessionRulesTitle")}</CardTitle>
            <CardDescription>{t("auth.sessionRulesDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    </StaffPageShell>
  );
}
