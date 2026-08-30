"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Plus,
  QrCode,
  ShieldCheck
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { bootstrapPlatformCompany, getPlatformPlans } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type { BootstrapCompanyInput, BootstrapCompanyResult } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { formatMoney } from "@/features/staff/staff-format";

const inputClass =
  "min-h-10 w-full rounded-md border border-[#D6D6D1] bg-white px-3 text-sm text-[#20201D] outline-none focus:border-[#AAA49B]";
const labelClass = "grid gap-1.5 text-xs font-semibold text-[#55554F]";
const panelClass = "rounded-lg border border-[#D9D9D4] bg-white";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function planLabel(planCode: string) {
  return planCode
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function SuccessPanel({ result }: { result: BootstrapCompanyResult }) {
  const { locale } = useI18n();

  return (
    <section className="rounded-lg border border-[#C8D7C8] bg-[#F0F6EF] p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#315638] text-white">
          <BadgeCheck className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {L(locale, "Tenant workspace created", "تم إنشاء مساحة عمل الشركة")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#55705A]">
            {L(
              locale,
              `${result.company.name} is created. Continue owner access and Setup from the company record.`,
              `تم إنشاء ${result.company.name}. أكمل وصول المالك وSetup من سجل الشركة.`
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          [L(locale, "Owner", "المالك"), result.passwordSetup.ownerEmail],
          [L(locale, "Plan", "الخطة"), result.plan.name],
          [L(locale, "Branch", "الفرع"), result.branch.name]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#C8D7C8] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6B7F6E]">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={result.setupUrl} className="inline-flex min-h-10 items-center rounded-md bg-[#292925] px-3 text-xs font-semibold !text-white">
          {L(locale, "Open Setup", "افتح Setup")}
        </Link>
        <Link href={`/platform/companies/${result.companyId}`} className="inline-flex min-h-10 items-center rounded-md border border-[#B7B7B1] bg-white px-3 text-xs font-semibold">
          {L(locale, "Company detail", "تفاصيل الشركة")}
        </Link>
      </div>

      {result.customerQrExamples.length > 0 ? (
        <div className="mt-4 border-t border-[#C8D7C8] pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <QrCode className="size-4" />
            {L(locale, "Starter QR examples", "أمثلة QR المبدئية")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.customerQrExamples.slice(0, 4).map((example) => (
              <span key={example.tableId} className="rounded-md border border-[#C8D7C8] bg-white px-2.5 py-1.5 text-[11px]">
                {example.code} · {example.qrToken}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PlatformNewCompanyContent() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const [createdResult, setCreatedResult] = useState<BootstrapCompanyResult | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchSlug, setBranchSlug] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [planCode, setPlanCode] = useState<BootstrapCompanyInput["subscription"]["planCode"]>("starter");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<NonNullable<BootstrapCompanyInput["subscription"]["status"]>>("trialing");
  const [starterEnabled, setStarterEnabled] = useState(true);
  const [floorLabel, setFloorLabel] = useState(L(locale, "Ground Floor", "الدور الأرضي"));
  const [tablePrefix, setTablePrefix] = useState("T");
  const [startNumber, setStartNumber] = useState(1);
  const [tableCount, setTableCount] = useState(6);
  const [seats, setSeats] = useState(4);

  const plansQuery = useQuery({
    queryKey: platformQueryKeys.plans(),
    queryFn: () => getPlatformPlans(accessToken ?? ""),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000
  });

  const availablePlans =
    plansQuery.data?.plans.filter((plan) => plan.status === "active") ?? [];

  useEffect(() => {
    if (
      availablePlans.length > 0 &&
      !availablePlans.some((plan) => plan.code === planCode)
    ) {
      setPlanCode(
        availablePlans[0].code as BootstrapCompanyInput["subscription"]["planCode"]
      );
    }
  }, [availablePlans, planCode]);

  const createMutation = useMutation({
    mutationFn: (payload: BootstrapCompanyInput) =>
      bootstrapPlatformCompany(payload, accessToken ?? ""),
    onSuccess: (result) => {
      setCreatedResult(result);
      queryClient.invalidateQueries({ queryKey: platformQueryKeys.companies() });
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedResult(null);
    createMutation.mutate({
      company: {
        name: companyName.trim(),
        slug: slugify(companySlug || companyName)
      },
      owner: {
        name: ownerName.trim(),
        email: ownerEmail.trim()
      },
      branch: {
        name: branchName.trim(),
        slug: slugify(branchSlug || branchName),
        address: branchAddress.trim() || null
      },
      subscription: {
        planCode,
        status: subscriptionStatus
      },
      starterTables: {
        enabled: starterEnabled,
        floorLabel: floorLabel.trim(),
        tablePrefix: tablePrefix.trim(),
        startNumber,
        count: tableCount,
        seats
      }
    });
  }

  return (
    <div className="grid gap-4">
      {createdResult ? <SuccessPanel result={createdResult} /> : null}

      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className={panelClass}>
          <div className="border-b border-[#E7E7E2] px-5 py-4">
            <span className="inline-flex rounded-full border border-[#D7D7D2] bg-[#F7F7F4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#62625C]">
              {L(locale, "NEW TENANT", "شركة جديدة")}
            </span>
            <h2 className="mt-3 text-xl font-semibold">
              {L(locale, "Create the tenant foundation", "أنشئ أساس الشركة")}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#777771]">
              {L(
                locale,
                "Create the company, first branch, owner access and optional starter tables in one controlled setup.",
                "أنشئ الشركة والفرع الأول ووصول المالك وترابيزات البداية الاختيارية في إعداد واحد مضبوط."
              )}
            </p>
          </div>

          <div className="grid gap-6 p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7A746D]">
                {L(locale, "COMPANY", "الشركة")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  {L(locale, "Company name", "اسم الشركة")}
                  <input
                    className={inputClass}
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    onBlur={() => setCompanySlug((value) => value || slugify(companyName))}
                    placeholder={L(locale, "Cafe Nile", "مقهى النيل")}
                    required
                  />
                </label>
                <label className={labelClass}>
                  Slug
                  <input
                    className={inputClass}
                    value={companySlug}
                    onChange={(event) => setCompanySlug(event.target.value)}
                    placeholder="cafe-nile"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-[#ECECE8] pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7A746D]">
                {L(locale, "OWNER ACCESS", "وصول المالك")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  {L(locale, "Owner name", "اسم المالك")}
                  <input
                    className={inputClass}
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder={L(locale, "Mona Hassan", "منى حسن")}
                    required
                  />
                </label>
                <label className={labelClass}>
                  {L(locale, "Owner email", "إيميل المالك")}
                  <input
                    className={inputClass}
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="owner@example.com"
                    required
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-[#ECECE8] pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7A746D]">
                {L(locale, "FIRST BRANCH", "الفرع الأول")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  {L(locale, "Branch name", "اسم الفرع")}
                  <input
                    className={inputClass}
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    onBlur={() => setBranchSlug((value) => value || slugify(branchName))}
                    placeholder={L(locale, "Main Branch", "الفرع الرئيسي")}
                    required
                  />
                </label>
                <label className={labelClass}>
                  Slug
                  <input
                    className={inputClass}
                    value={branchSlug}
                    onChange={(event) => setBranchSlug(event.target.value)}
                    placeholder="main"
                  />
                </label>
                <label className={labelClass + " sm:col-span-2"}>
                  {L(locale, "Address", "العنوان")}
                  <input
                    className={inputClass}
                    value={branchAddress}
                    onChange={(event) => setBranchAddress(event.target.value)}
                    placeholder={L(locale, "Street, city, country", "الشارع، المدينة، البلد")}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid h-fit gap-4">
          <section className={panelClass + " p-4"}>
            <Building2 className="size-5 text-[#76634A]" />
            <h2 className="mt-3 text-sm font-semibold">
              {L(locale, "Create tenant workspace", "أنشئ مساحة الكافيه")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#777771]">
              {L(
                locale,
                "Plan limits and tenant configuration are validated before the workspace is created.",
                "يتم التحقق من حدود الخطة وإعدادات الشركة قبل إنشاء مساحة العمل."
              )}
            </p>

            <div className="mt-4 grid gap-3">
              <label className={labelClass}>
                {L(locale, "Plan", "الخطة")}
                <select
                  className={inputClass}
                  value={planCode}
                  onChange={(event) =>
                    setPlanCode(event.target.value as BootstrapCompanyInput["subscription"]["planCode"])
                  }
                >
                  {availablePlans.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name} ·{" "}
                      {plan.monthlyPriceMinor === null || plan.monthlyPriceMinor === undefined
                        ? L(locale, "Custom", "مخصص")
                        : formatMoney(plan.monthlyPriceMinor, plan.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                {L(locale, "Subscription state", "حالة الاشتراك")}
                <select
                  className={inputClass}
                  value={subscriptionStatus}
                  onChange={(event) =>
                    setSubscriptionStatus(
                      event.target.value as NonNullable<BootstrapCompanyInput["subscription"]["status"]>
                    )
                  }
                >
                  <option value="trialing">{L(locale, "Trialing", "تجريبي")}</option>
                  <option value="active">{L(locale, "Active", "نشط")}</option>
                </select>
              </label>

              <label className="flex items-start gap-3 rounded-md border border-[#DADAD5] bg-[#F8F8F5] p-3 text-xs font-semibold">
                <input
                  checked={starterEnabled}
                  onChange={(event) => setStarterEnabled(event.target.checked)}
                  type="checkbox"
                  className="mt-0.5 size-4"
                />
                <span>
                  {L(locale, "Create starter floor, tables and QR", "أنشئ دور وترابيزات وQR كبداية")}
                </span>
              </label>

              {starterEnabled ? (
                <div className="grid gap-3 border-t border-[#ECECE8] pt-3">
                  <label className={labelClass}>
                    {L(locale, "Floor label", "اسم الدور")}
                    <input
                      className={inputClass}
                      value={floorLabel}
                      onChange={(event) => setFloorLabel(event.target.value)}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelClass}>
                      {L(locale, "Prefix", "البادئة")}
                      <input className={inputClass} value={tablePrefix} onChange={(event) => setTablePrefix(event.target.value)} />
                    </label>
                    <label className={labelClass}>
                      {L(locale, "Start", "البداية")}
                      <input className={inputClass} type="number" min={1} value={startNumber} onChange={(event) => setStartNumber(Number(event.target.value))} />
                    </label>
                    <label className={labelClass}>
                      {L(locale, "Count", "العدد")}
                      <input className={inputClass} type="number" min={1} max={100} value={tableCount} onChange={(event) => setTableCount(Number(event.target.value))} />
                    </label>
                    <label className={labelClass}>
                      {L(locale, "Seats", "المقاعد")}
                      <input className={inputClass} type="number" min={1} value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
                    </label>
                  </div>
                </div>
              ) : null}

              {plansQuery.isError ? (
                <p className="rounded-md border border-[#E4C5C1] bg-[#FBEEEE] p-3 text-xs text-[#8D3F37]">
                  {L(locale, "Plans could not load. Retry before creating a tenant.", "تعذر تحميل الخطط. أعد المحاولة قبل إنشاء الشركة.")}
                </p>
              ) : null}

              {!plansQuery.isPending && !plansQuery.isError && availablePlans.length === 0 ? (
                <p className="rounded-md border border-[#E5D2AD] bg-[#FFF8E9] p-3 text-xs text-[#805C25]">
                  {L(locale, "No active plan is available for tenant creation.", "لا توجد خطة نشطة متاحة لإنشاء شركة.")}
                </p>
              ) : null}

              {createMutation.isError ? (
                <p className="rounded-md border border-[#E4C5C1] bg-[#FBEEEE] p-3 text-xs text-[#8D3F37]">
                  {formatErrorMessage(createMutation.error)}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  plansQuery.isPending ||
                  plansQuery.isError ||
                  availablePlans.length === 0
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#292925] px-4 text-sm font-semibold !text-white disabled:opacity-50"
              >
                <Plus className="size-4" />
                {createMutation.isPending
                  ? L(locale, "Creating…", "جارٍ الإنشاء…")
                  : L(locale, "Create cafe workspace", "أنشئ مساحة الكافيه")}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-[#E5D2AD] bg-[#FFF8E9] p-4">
            <ShieldCheck className="size-5 text-[#805C25]" />
            <h3 className="mt-3 text-sm font-semibold text-[#6E4C1C]">
              {L(locale, "Boundaries", "الحدود")}
            </h3>
            <p className="mt-2 text-xs leading-6 text-[#805C25]">
              {L(
                locale,
                "This flow does not create public signup, payment-provider credentials, menu imports or staff sessions.",
                "هذه العملية لا تنشئ تسجيلًا عامًا أو بيانات مزود دفع أو استيراد منيو أو جلسات موظفين."
              )}
            </p>
          </section>
        </aside>
      </form>
    </div>
  );
}

export function PlatformNewCompanyPage() {
  const { locale } = useI18n();

  return (
    <PlatformShell
      title={L(locale, "New Cafe / Tenant Setup", "كافيه جديد / إعداد الشركة")}
      description={L(
        locale,
        "Create the company, first branch, plan and initial owner access in one controlled flow.",
        "أنشئ الشركة والفرع الأول والخطة ووصول المالك الأول في عملية واحدة مضبوطة."
      )}
      actions={
        <Link
          href="/platform"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {L(locale, "Platform dashboard", "لوحة Platform")}
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformNewCompanyContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
