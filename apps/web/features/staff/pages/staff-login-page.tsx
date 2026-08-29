"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChefHat,
  LayoutGrid,
  LogIn,
  Receipt,
  ShieldCheck
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Input } from "@/components/ui/input";
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
    <main className="min-h-screen bg-[#17120F] text-[#FFF5E8]">
      <header className="border-b border-[#352B24] bg-[#18130F]">
        <div className="mx-auto flex min-h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Balcona">
            <span className="flex size-8 items-center justify-center rounded-md bg-[#C68A4A] text-xs font-black text-[#1B120C]">
              B
            </span>
            <span>
              <span className="block text-sm font-semibold text-[#FFF6E9]">
                {t("serviceShell.productLabel")}
              </span>
              <span className="block text-[10px] text-[#9F9184]">
                {t("serviceShell.subtitle")}
              </span>
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold text-[#B8A99B] transition hover:bg-[#282019] hover:text-[#FFF5E8] sm:inline-flex"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("actions.overview")}
            </Link>
            <LanguageSwitcher className="border-[#41362E] bg-[#211A15]" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-57px)] max-w-[1240px] items-stretch lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between border-b border-[#342A23] px-5 py-10 sm:px-8 sm:py-14 lg:border-b-0 lg:border-e lg:px-10 lg:py-16">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A98A6A]">
              {t("serviceShell.cashierEyebrow")}
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.045em] text-[#FFF4E6] sm:text-5xl">
              {t("auth.title")}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#A99A8D] sm:text-base">
              {t("auth.loginDescription")}
            </p>

            <div className="mt-8 grid gap-2 sm:grid-cols-3">
              {[
                {
                  icon: Receipt,
                  label: t("serviceShell.cashier")
                },
                {
                  icon: LayoutGrid,
                  label: t("serviceShell.waiter")
                },
                {
                  icon: ChefHat,
                  label: t("overview.areaKitchenTitle")
                }
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex min-h-12 items-center gap-2 rounded-md border border-[#352B24] bg-[#1D1713] px-3 text-xs font-semibold text-[#D9CCBF]"
                  >
                    <Icon className="size-4 text-[#C68A4A]" aria-hidden="true" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 border-t border-[#30261F] pt-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#2C211A] text-[#D5A365]">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#F5E9DC]">
                  {t("auth.sessionRulesTitle")}
                </p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-[#928579]">
                  {t("auth.sessionRulesDescription")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full rounded-xl border border-[#3A2F27] bg-[#1D1713] p-5 shadow-[0_24px_70px_rgba(0,0,0,.22)] sm:p-7">
            <div className="border-b border-[#342A23] pb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A98A6A]">
                {t("auth.openSessionTitle")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#A99A8D]">
                {t("auth.openSessionDescription")}
              </p>
            </div>

            <form onSubmit={submitLogin} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-xs font-semibold text-[#DCCFC3]">
                {t("auth.emailLabel")}
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  required
                  className="border-[#44372E] bg-[#17120F] text-[#FFF5E8] placeholder:text-[#75695F]"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold text-[#DCCFC3]">
                {t("auth.passwordLabel")}
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("auth.passwordPlaceholder")}
                  required
                  className="border-[#44372E] bg-[#17120F] text-[#FFF5E8] placeholder:text-[#75695F]"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold text-[#DCCFC3]">
                {t("auth.branchIdLabel")}
                <Input
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  placeholder={t("auth.branchIdPlaceholder")}
                  className="border-[#44372E] bg-[#17120F] text-[#FFF5E8] placeholder:text-[#75695F]"
                />
              </label>

              {loginMutation.isError ? (
                <div
                  role="alert"
                  className="rounded-md border border-[#7A3F3A] bg-[#3A211F] p-3 text-sm text-[#FFB6AE]"
                >
                  {getLoginErrorMessage(
                    loginMutation.error,
                    t("auth.loginFallback")
                  )}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="mt-1 min-h-12 w-full bg-[#C68A4A] text-[#1B120C] hover:bg-[#D39A57]"
              >
                <LogIn className="size-4" aria-hidden="true" />
                {loginMutation.isPending
                  ? t("actions.signingIn")
                  : t("actions.signIn")}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
