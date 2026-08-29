"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Server,
  ShieldCheck
} from "lucide-react";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getSystemInfo } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import { env, getApiBaseUrlSafety } from "@/lib/config/env";
import { useI18n } from "@/lib/i18n/i18n-provider";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function apiOriginFromBaseUrl(value: string) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/api\/v1\/?$/i, "") || "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function DetailRow({
  label,
  value,
  fallback
}: {
  label: string;
  value?: string | null;
  fallback: string;
}) {
  return (
    <div className="grid gap-1 border-b border-[#ECECE8] py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#777771]">
        {label}
      </dt>
      <dd className="break-words text-xs font-medium text-[#292925]">
        {value || fallback}
      </dd>
    </div>
  );
}

function StatePill({
  kind,
  children
}: {
  kind: "ok" | "warn" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const cls = {
    ok: "border-[#C8D7C8] bg-[#F0F6EF] text-[#315638]",
    warn: "border-[#E5D2AD] bg-[#FFF8E9] text-[#7D591F]",
    danger: "border-[#E4C5C1] bg-[#FBEEEE] text-[#8D3F37]",
    neutral: "border-[#D7D7D2] bg-[#F7F7F4] text-[#62625C]"
  }[kind];

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function PlatformStatusContent() {
  const { locale } = useI18n();
  const apiBaseUrl = env.NEXT_PUBLIC_API_BASE_URL;
  const apiOrigin = apiOriginFromBaseUrl(apiBaseUrl);
  const apiSafety = getApiBaseUrlSafety(apiBaseUrl);
  const systemInfoQuery = useQuery({
    queryKey: platformQueryKeys.systemInfo(),
    queryFn: getSystemInfo,
    retry: 1,
    staleTime: 30_000
  });

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-[#D9D9D4] bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-[#E7E7E2] p-5">
            <div>
              <Server className="size-5 text-[#76634A]" />
              <h2 className="mt-3 text-sm font-semibold">
                {L(locale, "Web API target", "هدف API للويب")}
              </h2>
              <p className="mt-1 max-w-lg text-xs leading-5 text-[#777771]">
                {apiSafety.reason}
              </p>
            </div>
            <StatePill kind={apiSafety.status === "permanent" ? "ok" : "warn"}>
              {apiSafety.status}
            </StatePill>
          </div>

          <dl className="px-5">
            <DetailRow label={L(locale, "Base URL", "الرابط الأساسي")} value={apiBaseUrl} fallback="—" />
            <DetailRow label={L(locale, "Host", "المضيف")} value={apiSafety.host} fallback="—" />
            <DetailRow label={L(locale, "Web app env", "بيئة الويب")} value={env.NEXT_PUBLIC_APP_ENV} fallback="—" />
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-[#E7E7E2] px-5 py-4">
            <a
              href={`${apiOrigin}/health`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
            >
              <ExternalLink className="size-4" />
              {L(locale, "Health", "الصحة")}
            </a>
            <a
              href={`${apiBaseUrl.replace(/\/$/, "")}/system/info`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
            >
              <ExternalLink className="size-4" />
              {L(locale, "System info", "معلومات النظام")}
            </a>
          </div>
        </article>

        <article className="rounded-lg border border-[#D9D9D4] bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-[#E7E7E2] p-5">
            <div>
              {systemInfoQuery.isError ? (
                <AlertTriangle className="size-5 text-[#8D3F37]" />
              ) : (
                <Activity className="size-5 text-[#4F7655]" />
              )}
              <h2 className="mt-3 text-sm font-semibold">
                {L(locale, "Live API metadata", "بيانات API الحية")}
              </h2>
              <p className="mt-1 text-xs text-[#777771]">
                {systemInfoQuery.data?.timestamp ??
                  L(locale, "Waiting for API response", "في انتظار استجابة API")}
              </p>
            </div>

            <StatePill
              kind={
                systemInfoQuery.isError
                  ? "danger"
                  : systemInfoQuery.data
                    ? "ok"
                    : "neutral"
              }
            >
              {systemInfoQuery.isError
                ? L(locale, "Unreachable", "غير متاح")
                : systemInfoQuery.data
                  ? L(locale, "Online", "متصل")
                  : L(locale, "Checking", "جارٍ التحقق")}
            </StatePill>
          </div>

          {systemInfoQuery.isPending ? (
            <div className="p-5 text-xs text-[#777771]">
              {L(locale, "Checking API metadata…", "جارٍ فحص بيانات API…")}
            </div>
          ) : null}

          {systemInfoQuery.isError ? (
            <div className="p-5">
              <p className="text-sm font-semibold text-[#8D3F37]">
                {L(locale, "API metadata could not load", "تعذر تحميل بيانات API")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8D3F37]">
                {formatErrorMessage(systemInfoQuery.error)}
              </p>
              <button
                type="button"
                onClick={() => void systemInfoQuery.refetch()}
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
              >
                <RefreshCw className="size-4" />
                {L(locale, "Retry", "أعد المحاولة")}
              </button>
            </div>
          ) : null}

          {systemInfoQuery.data ? (
            <dl className="px-5">
              <DetailRow label={L(locale, "Service", "الخدمة")} value={systemInfoQuery.data.name} fallback="—" />
              <DetailRow label={L(locale, "Version", "الإصدار")} value={systemInfoQuery.data.version} fallback="—" />
              <DetailRow
                label="APP_ENV"
                value={systemInfoQuery.data.appEnvironment ?? systemInfoQuery.data.environment}
                fallback="—"
              />
              <DetailRow label="NODE_ENV" value={systemInfoQuery.data.nodeEnvironment} fallback="—" />
              <DetailRow label={L(locale, "API prefix", "بادئة API")} value={systemInfoQuery.data.apiPrefix} fallback="—" />
              <DetailRow label="Git SHA" value={systemInfoQuery.data.gitSha} fallback="—" />
            </dl>
          ) : null}
        </article>
      </section>

      <section
        className={`rounded-lg border p-5 ${
          apiSafety.status === "permanent"
            ? "border-[#C8D7C8] bg-[#F0F6EF]"
            : "border-[#E5D2AD] bg-[#FFF8E9]"
        }`}
      >
        <ShieldCheck
          className={`size-5 ${
            apiSafety.status === "permanent" ? "text-[#315638]" : "text-[#805C25]"
          }`}
        />
        <h2 className="mt-3 text-sm font-semibold">
          {apiSafety.status === "permanent"
            ? L(locale, "Runtime target is production-shaped", "هدف التشغيل له شكل Production")
            : L(locale, "Production target still needs closure", "هدف Production ما زال يحتاج إغلاق")}
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-[#777771]">
          {apiSafety.status === "permanent"
            ? L(
                locale,
                "Platform sees a permanent API target. Final Oracle QA still verifies the deployed Web resource, CORS and end-to-end routes.",
                "Platform يرى هدف API دائمًا. فحص Oracle النهائي ما زال يتحقق من Web المنشور وCORS والرحلات الكاملة."
              )
            : L(
                locale,
                "The Web resource must point to the final Oracle/Coolify API target before production QA can close.",
                "يجب أن يشير Web إلى هدف Oracle/Coolify النهائي قبل إغلاق فحص Production."
              )}
        </p>
      </section>
    </div>
  );
}

export function PlatformStatusPage() {
  const { locale } = useI18n();

  return (
    <PlatformShell
      title={L(locale, "System Status", "حالة النظام")}
      description={L(
        locale,
        "Safe runtime metadata and the Web → API target for the current environment.",
        "بيانات التشغيل الآمنة وهدف Web → API للبيئة الحالية."
      )}
      actions={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
        >
          <RefreshCw className="size-4" />
          {L(locale, "Refresh", "تحديث")}
        </button>
      }
    >
      <PlatformAuthGate>
        <PlatformStatusContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
