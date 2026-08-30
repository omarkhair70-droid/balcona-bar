"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronRight,
  CircleDollarSign,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  X
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getPlatformCompanies, getPlatformDemoRequests } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type { PlatformCompanySummary } from "@/lib/api/types";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { humanizeStatus } from "@/features/staff/staff-format";

type Tone = "ok" | "warn" | "danger" | "neutral";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function toneForStatus(status?: string | null): Tone {
  if (status === "active") return "ok";
  if (status === "trialing" || status === "past_due") return "warn";
  if (status === "suspended" || status === "cancelled") return "danger";
  return "neutral";
}

function Pill({
  tone = "neutral",
  children
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const cls = {
    ok: "border-[#C8D7C8] bg-[#F0F6EF] text-[#315638]",
    warn: "border-[#E5D2AD] bg-[#FFF8E9] text-[#7D591F]",
    danger: "border-[#E4C5C1] bg-[#FBEEEE] text-[#8D3F37]",
    neutral: "border-[#D7D7D2] bg-[#F7F7F4] text-[#62625C]"
  }[tone];

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  return (
    <div className="border-e border-[#E2E2DD] p-4 last:border-e-0 rtl:border-e-0 rtl:border-s rtl:last:border-s-0">
      <p className="text-[11px] text-[#777771]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{value}</p>
      <p
        className={`mt-1 text-[11px] ${
          tone === "danger"
            ? "text-[#8D3F37]"
            : tone === "warn"
              ? "text-[#805C25]"
              : "text-[#85857F]"
        }`}
      >
        {hint}
      </p>
    </div>
  );
}

function CompanyDrawer({
  company,
  onClose
}: {
  company: PlatformCompanySummary | null;
  onClose: () => void;
}) {
  const { locale } = useI18n();

  if (!company) return null;

  const subscription = company.subscription;
  const status = subscription?.status ?? "unconfigured";
  const plan = subscription?.plan;

  return (
    <>
      <button
        type="button"
        aria-label={L(locale, "Close company detail", "إغلاق تفاصيل الشركة")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/15"
      />
      <aside className="fixed inset-y-0 end-0 z-50 w-full max-w-lg overflow-y-auto border-s border-[#D5D5D0] bg-[#FBFBF8] shadow-[-18px_0_50px_rgba(0,0,0,.12)]">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[#DEDED9] bg-[#FBFBF8]/96 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A746D]">
              BALCONA PLATFORM · TENANT
            </p>
            <h2 className="mt-1.5 text-xl font-semibold">{company.name}</h2>
            <p className="mt-1 text-xs text-[#777771]">{company.slug}</p>
          </div>
          <button
            type="button"
            aria-label={L(locale, "Close company detail", "إغلاق تفاصيل الشركة")}
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md border border-[#D5D5D0] bg-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <section className="overflow-hidden rounded-lg border border-[#DADAD5] bg-white">
            <div className="border-b border-[#E7E7E2] px-4 py-3">
              <h3 className="text-xs font-semibold">
                {L(locale, "Tenant summary", "ملخص الشركة")}
              </h3>
            </div>
            {[
              [L(locale, "Plan", "الخطة"), plan?.name ?? L(locale, "Not assigned", "غير محددة")],
              [L(locale, "Subscription", "الاشتراك"), humanizeStatus(status)],
              [L(locale, "Branches", "الفروع"), String(company.branchCount)],
              [L(locale, "Staff memberships", "عضويات الفريق"), String(company.staffMembershipCount)]
            ].map(([a, b]) => (
              <div
                key={a}
                className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-[#EEEEEA] px-4 py-3 text-xs last:border-0"
              >
                <span className="text-[#797973]">{a}</span>
                <span className="font-semibold">{b}</span>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold">
                  {L(locale, "Identity boundary", "حدود الهوية")}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#777771]">
                  {L(
                    locale,
                    "Platform reviews tenant state but does not impersonate restaurant staff.",
                    "Platform يراجع حالة الشركة لكنه لا ينتحل دور موظفي المطعم."
                  )}
                </p>
              </div>
              <UsersRound className="size-5 text-[#76634A]" />
            </div>
          </section>

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <p className="text-xs font-semibold">
              {L(locale, "Subscription boundary", "حدود الاشتراك")}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#85857F]">
              {L(
                locale,
                "Plans control tenant access and entitlements. Restaurant customer payments remain outside Platform administration.",
                "الخطط تتحكم في وصول الشركة وصلاحياتها. مدفوعات عملاء المطعم خارج إدارة Platform."
              )}
            </p>
          </section>

          <Link
            href={`/platform/companies/${company.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#292925] px-4 text-sm font-semibold !text-white"
          >
            {L(locale, "Open full company", "افتح الشركة كاملة")}
          </Link>
        </div>
      </aside>
    </>
  );
}

function PlatformDashboardContent() {
  const t = useTranslations("platform");
  const { locale } = useI18n();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const [selected, setSelected] = useState<PlatformCompanySummary | null>(null);
  const companiesQuery = useQuery({
    queryKey: platformQueryKeys.companies(),
    queryFn: () => getPlatformCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });
  const newLeadsQuery = useQuery({
    queryKey: platformQueryKeys.demoRequests("new", ""),
    queryFn: () =>
      getPlatformDemoRequests(accessToken ?? "", {
        status: "new",
        limit: 5
      }),
    enabled: Boolean(accessToken),
    staleTime: 30_000
  });

  if (companiesQuery.isPending) {
    return <LoadingState label={t("companies.loading")} />;
  }

  if (companiesQuery.isError) {
    return (
      <EmptyState
        title={t("errors.companiesLoadTitle")}
        description={formatErrorMessage(companiesQuery.error)}
        action={
          <button
            type="button"
            onClick={() => void companiesQuery.refetch()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
          >
            <RefreshCw className="size-4" />
            {t("actions.retry")}
          </button>
        }
      />
    );
  }

  const data = companiesQuery.data;
  const attention = data.companies.filter((company) =>
    ["past_due", "suspended", "cancelled"].includes(
      company.subscription?.status ?? ""
    )
  );

  return (
    <>
      <div className="grid gap-4">
        <section className="grid overflow-hidden rounded-lg border border-[#D9D9D4] bg-white sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label={L(locale, "Companies", "الشركات")}
            value={String(data.summary.totalCompanies)}
            hint={L(locale, "Tenant workspaces", "مساحات عمل")}
          />
          <Metric
            label={L(locale, "Active", "نشط")}
            value={String(data.summary.activeSubscriptions)}
            hint={L(locale, "Internal subscription state", "حالة اشتراك داخلية")}
          />
          <Metric
            label={L(locale, "Trialing", "تجريبي")}
            value={String(data.summary.trialingSubscriptions)}
            hint={L(locale, "Onboarding in progress", "التجهيز مستمر")}
            tone="warn"
          />
          <Metric
            label={L(locale, "Needs action", "يحتاج تدخل")}
            value={String(attention.length)}
            hint={L(locale, "Past due / suspended / cancelled", "متأخر / موقوف / ملغي")}
            tone={attention.length > 0 ? "danger" : "neutral"}
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#E7E7E2] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">
                {L(locale, "Tenant attention", "تنبيهات الشركات")}
              </h2>
              <p className="mt-1 text-xs text-[#777771]">
                {L(
                  locale,
                  "Subscription states that require internal platform review.",
                  "حالات الاشتراك التي تحتاج مراجعة فريق Platform."
                )}
              </p>
            </div>
            <Pill tone={attention.length > 0 ? "danger" : "ok"}>
              {attention.length}
            </Pill>
          </div>

          {attention.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#777771]">
              {L(locale, "No tenant currently requires subscription action.", "لا توجد شركة تحتاج تدخل في الاشتراك حاليًا.")}
            </p>
          ) : (
            <div className="divide-y divide-[#ECECE8]">
              {attention.map((company) => {
                const status = company.subscription?.status ?? "unconfigured";
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setSelected(company)}
                    className="grid w-full gap-3 px-4 py-3 text-start hover:bg-[#FAFAF8] sm:grid-cols-[minmax(0,1fr)_140px_120px_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold">{company.name}</p>
                      <p className="mt-1 text-xs text-[#777771]">{company.slug}</p>
                    </div>
                    <span className="text-xs">
                      {company.subscription?.plan?.name ?? L(locale, "No plan", "لا توجد خطة")}
                    </span>
                    <Pill tone={toneForStatus(status)}>{humanizeStatus(status)}</Pill>
                    <ChevronRight className="size-4 text-[#999993] rtl:rotate-180" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
          <div className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
            <div className="flex items-center justify-between border-b border-[#E7E7E2] px-4 py-3">
              <h2 className="text-sm font-semibold">
                {L(locale, "Recent companies", "أحدث الشركات")}
              </h2>
              <Link
                href="/platform/companies"
                className="text-xs font-semibold text-[#62533F] underline-offset-4 hover:underline"
              >
                {L(locale, "Open registry", "افتح السجل")}
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E4] bg-[#F7F7F4] text-[11px] text-[#6F6F69]">
                    {[
                      L(locale, "Company", "الشركة"),
                      L(locale, "Plan", "الخطة"),
                      L(locale, "Subscription", "الاشتراك"),
                      L(locale, "Branches", "الفروع"),
                      L(locale, "Staff", "الفريق")
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-2.5 text-start font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECE8]">
                  {data.companies.slice(0, 8).map((company) => {
                    const status = company.subscription?.status ?? "unconfigured";
                    return (
                      <tr
                        key={company.id}
                        onClick={() => setSelected(company)}
                        className="cursor-pointer hover:bg-[#FAFAF8]"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-semibold">{company.name}</p>
                          <p className="text-xs text-[#777771]">{company.slug}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          {company.subscription?.plan?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <Pill tone={toneForStatus(status)}>{humanizeStatus(status)}</Pill>
                        </td>
                        <td className="px-4 py-3.5">{company.branchCount}</td>
                        <td className="px-4 py-3.5">{company.staffMembershipCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid content-start gap-4">
            <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {L(locale, "Demo requests", "طلبات العرض")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#777771]">
                    {newLeadsQuery.isError
                      ? L(locale, "The request queue could not load.", "تعذر تحميل قائمة الطلبات.")
                      : L(
                          locale,
                          `${newLeadsQuery.data?.total ?? 0} new request(s) awaiting review.`,
                          `${newLeadsQuery.data?.total ?? 0} طلب جديد بانتظار المراجعة.`
                        )}
                  </p>
                </div>
                <Mail className="size-4 text-[#76634A]" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/platform/leads"
                  className="inline-flex min-h-9 items-center rounded-md border border-[#D6D6D1] px-3 text-xs font-semibold"
                >
                  {L(locale, "Open requests", "افتح الطلبات")}
                </Link>
                {newLeadsQuery.isError ? (
                  <button
                    type="button"
                    onClick={() => void newLeadsQuery.refetch()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#D6D6D1] px-3 text-xs font-semibold"
                  >
                    <RefreshCw className="size-3.5" />
                    {L(locale, "Retry", "إعادة المحاولة")}
                  </button>
                ) : null}
              </div>
            </article>

            <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {L(locale, "System status", "حالة النظام")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#777771]">
                    {L(
                      locale,
                      "Safe runtime metadata and web API target are checked separately.",
                      "بيانات التشغيل الآمنة وهدف API للويب يتم فحصهما بشكل منفصل."
                    )}
                  </p>
                </div>
                <Activity className="size-4 text-[#4F7655]" />
              </div>
              <Link
                href="/platform/status"
                className="mt-3 inline-flex min-h-9 items-center rounded-md border border-[#D6D6D1] px-3 text-xs font-semibold"
              >
                {L(locale, "Open status", "افتح الحالة")}
              </Link>
            </article>

            <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {L(locale, "Tenant plans", "خطط الشركات")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#777771]">
                    {L(
                      locale,
                      "Plans define tenant access, limits and enabled capabilities.",
                      "الخطط تحدد وصول الشركة والحدود والإمكانات المفعلة."
                    )}
                  </p>
                </div>
                <CircleDollarSign className="size-4 text-[#76634A]" />
              </div>
              <Link
                href="/platform/plans"
                className="mt-3 inline-flex min-h-9 items-center rounded-md border border-[#D6D6D1] px-3 text-xs font-semibold"
              >
                {L(locale, "Open plans", "افتح الخطط")}
              </Link>
            </article>

            <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {L(locale, "Platform identity", "هوية Platform")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#777771]">
                    {L(
                      locale,
                      "Separate PlatformAdmin auth. No restaurant staff impersonation.",
                      "مصادقة PlatformAdmin منفصلة. لا يوجد انتحال لموظفي المطعم."
                    )}
                  </p>
                </div>
                <ShieldCheck className="size-4 text-[#526E57]" />
              </div>
            </article>
          </div>
        </section>
      </div>

      <CompanyDrawer company={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export function PlatformDashboardPage() {
  const t = useTranslations("platform");

  return (
    <PlatformShell
      title={t("navigation.dashboard")}
      description={t("companies.description")}
      actions={
        <Link
          href="/platform/companies/new"
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#292925] px-3 text-xs font-semibold !text-white"
        >
          <Plus className="size-4" />
          {t("actions.addCafe")}
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformDashboardContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
