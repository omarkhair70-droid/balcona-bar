"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Check,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getPlatformPlans } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type { SaasPlan } from "@/lib/api/types";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { formatMoney } from "@/features/staff/staff-format";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function limitValue(locale: "en" | "ar", value?: number | null) {
  return value === null || value === undefined
    ? L(locale, "Unlimited", "غير محدود")
    : value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US");
}

function PlanRow({ plan }: { plan: SaasPlan }) {
  const { locale } = useI18n();
  const enabled = [
    plan.setupEnabled && L(locale, "Setup", "Setup"),
    plan.kdsEnabled && "KDS",
    plan.inventoryEnabled && L(locale, "Inventory", "المخزون"),
    plan.onlinePaymentsEnabled && L(locale, "Online payments", "الدفع الإلكتروني"),
    plan.ownerAnalyticsEnabled && L(locale, "Owner analytics", "تحليلات المالك"),
    plan.aiWaiterEnabled && "AI Waiter",
    plan.multiBranchEnabled && L(locale, "Multi-branch", "متعدد الفروع"),
    plan.advancedReportsEnabled && L(locale, "Advanced reports", "تقارير متقدمة")
  ].filter(Boolean) as string[];

  return (
    <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7A746D]">
            {plan.code}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold">{plan.name}</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#777771]">
            {plan.description ?? L(locale, "Internal Balcona entitlement plan.", "خطة صلاحيات داخلية في بلكونة.")}
          </p>
        </div>

        <div className="text-start sm:text-end">
          <p className="text-lg font-semibold">
            {plan.monthlyPriceMinor === null || plan.monthlyPriceMinor === undefined
              ? L(locale, "Custom", "مخصص")
              : formatMoney(plan.monthlyPriceMinor, plan.currency)}
          </p>
          <span className="mt-1 inline-flex rounded-full border border-[#D7D7D2] bg-[#F7F7F4] px-2.5 py-1 text-[11px] font-semibold text-[#62625C]">
            {plan.status}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [L(locale, "Branches", "الفروع"), limitValue(locale, plan.maxBranches)],
          [L(locale, "Tables", "الترابيزات"), limitValue(locale, plan.maxTables)],
          [L(locale, "Staff users", "الموظفون"), limitValue(locale, plan.maxStaffUsers)],
          [L(locale, "Menu items", "منتجات المنيو"), limitValue(locale, plan.maxMenuItems)],
          [L(locale, "Inventory items", "عناصر المخزون"), limitValue(locale, plan.maxInventoryItems)],
          [L(locale, "AI messages / month", "رسائل AI / شهر"), limitValue(locale, plan.maxAiMessagesPerMonth)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#E2E2DD] bg-[#FAFAF8] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7C7C76]">{label}</p>
            <p className="mt-1.5 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {enabled.map((feature) => (
          <span
            key={feature}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C8D7C8] bg-[#F0F6EF] px-2.5 py-1 text-[11px] font-semibold text-[#315638]"
          >
            <Check className="size-3" />
            {feature}
          </span>
        ))}
      </div>
    </article>
  );
}

function PlatformPlansContent() {
  const t = useTranslations("platform");
  const { locale } = useI18n();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const plansQuery = useQuery({
    queryKey: platformQueryKeys.plans(),
    queryFn: () => getPlatformPlans(accessToken ?? ""),
    enabled: Boolean(accessToken),
    staleTime: 60_000
  });

  if (plansQuery.isPending) {
    return <LoadingState label={L(locale, "Loading plans", "جارٍ تحميل الخطط")} />;
  }

  if (plansQuery.isError) {
    return (
      <EmptyState
        title={L(locale, "Plans could not load", "تعذر تحميل الخطط")}
        description={formatErrorMessage(plansQuery.error)}
        action={
          <button
            type="button"
            onClick={() => void plansQuery.refetch()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
          >
            <RefreshCw className="size-4" />
            {t("actions.retry")}
          </button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="rounded-lg border border-[#D9D9D4] bg-white p-5">
          <CircleDollarSign className="size-5 text-[#76634A]" />
          <h2 className="mt-3 text-sm font-semibold">
            {L(locale, "Internal plan and entitlement model", "نموذج الخطط والصلاحيات الداخلي")}
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-[#777771]">
            {L(
              locale,
              "These records control Balcona feature access and limits. They do not represent restaurant customer payments.",
              "هذه السجلات تتحكم في صلاحيات وحدود بلكونة. ولا تمثل مدفوعات عملاء المطعم."
            )}
          </p>
        </div>

        <div className="rounded-lg border border-[#E5D2AD] bg-[#FFF8E9] p-5">
          <ShieldCheck className="size-5 text-[#805C25]" />
          <h2 className="mt-3 text-sm font-semibold text-[#6E4C1C]">
            {L(locale, "Billing boundary", "حدود التحصيل")}
          </h2>
          <p className="mt-2 text-xs leading-6 text-[#805C25]">
            {L(
              locale,
              "A real recurring SaaS billing provider is not claimed here. Provider checkout, invoices and collections remain a separate billing program.",
              "لا يتم ادعاء وجود مزود تحصيل SaaS دوري حقيقي هنا. الدفع والفواتير والتحصيل تظل برنامجًا منفصلًا."
            )}
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {plansQuery.data.plans
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((plan) => (
            <PlanRow key={plan.id} plan={plan} />
          ))}
      </section>
    </div>
  );
}

export function PlatformPlansPage() {
  const { locale } = useI18n();

  return (
    <PlatformShell
      title={L(locale, "Plans & Subscriptions", "الخطط والاشتراكات")}
      description={L(
        locale,
        "Internal entitlement and subscription-state model — separate from restaurant customer money.",
        "نموذج الصلاحيات وحالة الاشتراك الداخلية — منفصل عن أموال عملاء المطعم."
      )}
    >
      <PlatformAuthGate>
        <PlatformPlansContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
