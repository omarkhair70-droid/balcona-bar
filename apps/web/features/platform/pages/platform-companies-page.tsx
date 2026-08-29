"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  Plus,
  RefreshCw,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getPlatformCompanies } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type { PlatformCompanySummary } from "@/lib/api/types";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { humanizeStatus } from "@/features/staff/staff-format";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function badgeClass(status?: string | null) {
  if (status === "active") {
    return "border-[#C8D7C8] bg-[#F0F6EF] text-[#315638]";
  }
  if (status === "trialing" || status === "past_due") {
    return "border-[#E5D2AD] bg-[#FFF8E9] text-[#7D591F]";
  }
  if (status === "suspended" || status === "cancelled") {
    return "border-[#E4C5C1] bg-[#FBEEEE] text-[#8D3F37]";
  }
  return "border-[#D7D7D2] bg-[#F7F7F4] text-[#62625C]";
}

function RegistryRow({ company }: { company: PlatformCompanySummary }) {
  const { locale } = useI18n();
  const status = company.subscription?.status ?? "unconfigured";

  return (
    <Link
      href={`/platform/companies/${company.id}`}
      className="grid gap-3 px-4 py-4 text-start transition hover:bg-[#FAFAF8] md:grid-cols-[minmax(0,1.35fr)_130px_130px_100px_100px_auto] md:items-center"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{company.name}</p>
        <p className="mt-1 truncate text-xs text-[#777771]">{company.slug}</p>
      </div>
      <span className="text-xs">
        {company.subscription?.plan?.name ?? L(locale, "No plan", "لا توجد خطة")}
      </span>
      <span
        className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass(status)}`}
      >
        {humanizeStatus(status)}
      </span>
      <span className="text-xs">
        {company.branchCount} {L(locale, "branch", "فرع")}
      </span>
      <span className="text-xs">
        {company.staffMembershipCount} {L(locale, "staff", "موظف")}
      </span>
      <ChevronRight className="size-4 text-[#999993] rtl:rotate-180" />
    </Link>
  );
}

function PlatformCompaniesContent() {
  const t = useTranslations("platform");
  const { locale } = useI18n();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const [query, setQuery] = useState("");
  const companiesQuery = useQuery({
    queryKey: platformQueryKeys.companies(),
    queryFn: () => getPlatformCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !companiesQuery.data) {
      return companiesQuery.data?.companies ?? [];
    }

    return companiesQuery.data.companies.filter(
      (company) =>
        company.name.toLowerCase().includes(needle) ||
        company.slug.toLowerCase().includes(needle) ||
        company.subscription?.plan?.name.toLowerCase().includes(needle) ||
        company.subscription?.status.toLowerCase().includes(needle)
    );
  }, [companiesQuery.data, query]);

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

  return (
    <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E7E7E2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A746D]">
            TENANT REGISTRY
          </p>
          <h2 className="mt-1.5 text-sm font-semibold">
            {L(locale, "All companies", "كل الشركات")}
          </h2>
          <p className="mt-1 text-xs text-[#777771]">
            {L(
              locale,
              "Internal tenant registry, plan state and operating footprint.",
              "سجل الشركات الداخلي وحالة الخطة وحجم التشغيل."
            )}
          </p>
        </div>

        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#8A8A84]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={L(locale, "Search company or slug…", "ابحث بالاسم أو slug…")}
            className="min-h-10 w-full rounded-md border border-[#D6D6D1] bg-white ps-9 pe-3 text-xs outline-none focus:border-[#AAA49B]"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Building2 className="mx-auto size-6 text-[#999993]" />
          <p className="mt-3 text-sm font-semibold">
            {L(locale, "No matching companies", "لا توجد شركات مطابقة")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#ECECE8]">
          {filtered.map((company) => (
            <RegistryRow key={company.id} company={company} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PlatformCompaniesPage() {
  const t = useTranslations("platform");
  const { locale } = useI18n();

  return (
    <PlatformShell
      title={t("navigation.companies")}
      description={L(
        locale,
        "Tenant registry, plans, branch counts and internal access state.",
        "سجل الشركات والخطط وعدد الفروع وحالة الوصول الداخلية."
      )}
      actions={
        <Link
          href="/platform/companies/new"
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#292925] px-3 text-xs font-semibold text-white"
        >
          <Plus className="size-4" />
          {t("actions.addCafe")}
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformCompaniesContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
