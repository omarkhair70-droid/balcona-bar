"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  MapPin,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  getPlatformDemoRequests,
  updatePlatformDemoRequest
} from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type {
  DemoRequest,
  DemoRequestStatus,
  UpdateDemoRequestPayload
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

const statuses: Array<[DemoRequestStatus | "", string, string]> = [
  ["", "All", "الكل"],
  ["new", "New", "جديد"],
  ["contacted", "Contacted", "تم التواصل"],
  ["qualified", "Qualified", "مؤهل"],
  ["closed", "Closed", "مغلق"]
];

function statusLabel(locale: "en" | "ar", status: DemoRequestStatus) {
  return statuses.find(([value]) => value === status)?.[locale === "ar" ? 2 : 1] ?? status;
}

function LeadDetail({
  lead,
  token,
  onClose
}: {
  lead: DemoRequest;
  token: string;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(lead.internalNotes ?? "");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNotes(lead.internalNotes ?? "");
    setNotice("");
  }, [lead.id, lead.internalNotes]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateDemoRequestPayload) =>
      updatePlatformDemoRequest(lead.id, payload, token),
    onSuccess: async () => {
      setNotice(L(locale, "Saved", "تم الحفظ"));
      await queryClient.invalidateQueries({
        queryKey: ["platform", "demo-requests"]
      });
    }
  });

  const saveNotes = () => {
    setNotice("");
    mutation.mutate({ internalNotes: notes || "" });
  };

  const setStatus = (status: DemoRequestStatus) => {
    setNotice("");
    mutation.mutate({
      status,
      internalNotes: notes || "",
      lastContactedAt:
        status === "contacted" ? new Date().toISOString() : undefined
    });
  };

  const sourceDetails = [
    lead.source ? [L(locale, "Source", "المصدر"), lead.source] : null,
    lead.utmSource ? ["UTM source", lead.utmSource] : null,
    lead.utmMedium ? ["UTM medium", lead.utmMedium] : null,
    lead.utmCampaign ? ["UTM campaign", lead.utmCampaign] : null
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <>
      <button
        type="button"
        aria-label={L(locale, "Close request detail", "إغلاق تفاصيل الطلب")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/15"
      />
      <aside className="fixed inset-y-0 end-0 z-50 w-full max-w-xl overflow-y-auto border-s border-[#D5D5D0] bg-[#FBFBF8] shadow-[-18px_0_50px_rgba(0,0,0,.12)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#DEDED9] bg-[#FBFBF8]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#7A746D]">
              {L(locale, "DEMO REQUEST", "طلب عرض")}
            </p>
            <h2 className="mt-1.5 truncate text-xl font-semibold">{lead.businessName}</h2>
            <p className="mt-1 text-xs text-[#777771]">{lead.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#D5D5D0] bg-white"
            aria-label={L(locale, "Close", "إغلاق")}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">{L(locale, "Contact", "بيانات التواصل")}</p>
                <div className="mt-2 grid gap-1 text-xs text-[#62625C]">
                  <a href={`mailto:${lead.email}`} className="font-medium hover:underline">{lead.email}</a>
                  {lead.phone ? <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a> : null}
                  {lead.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {lead.city}
                    </span>
                  ) : null}
                  <span>
                    {lead.locationCount} {L(locale, "location(s)", "فرع")}
                  </span>
                </div>
              </div>
              <span className="rounded-full border border-[#D7D7D2] bg-[#F7F7F4] px-2.5 py-1 text-[11px] font-semibold">
                {statusLabel(locale, lead.status)}
              </span>
            </div>
          </section>

          {lead.message ? (
            <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
              <p className="text-xs font-semibold">{L(locale, "Request context", "تفاصيل الطلب")}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#575752]">{lead.message}</p>
            </section>
          ) : null}

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#526E57]" />
              <p className="text-xs font-semibold">{L(locale, "Consent & provenance", "الموافقة والمصدر")}</p>
            </div>
            <dl className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-4 border-b border-[#EEEEEA] pb-2">
                <dt className="text-[#777771]">{L(locale, "Contact consent", "موافقة التواصل")}</dt>
                <dd className="font-semibold">
                  {lead.consent ? L(locale, "Confirmed", "مؤكدة") : L(locale, "Not confirmed", "غير مؤكدة")}
                </dd>
              </div>
              {sourceDetails.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-[#EEEEEA] pb-2">
                  <dt className="text-[#777771]">{label}</dt>
                  <dd className="break-all text-end font-medium">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-b border-[#EEEEEA] pb-2">
                <dt className="text-[#777771]">{L(locale, "Received", "تاريخ الاستلام")}</dt>
                <dd className="text-end font-medium">
                  {new Date(lead.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#EEEEEA] pb-2">
                <dt className="text-[#777771]">{L(locale, "Updated", "آخر تحديث")}</dt>
                <dd className="text-end font-medium">
                  {new Date(lead.updatedAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#777771]">{L(locale, "Last contacted", "آخر تواصل")}</dt>
                <dd className="text-end font-medium">
                  {lead.lastContactedAt
                    ? new Date(lead.lastContactedAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <label className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#74746E]">
              {L(locale, "Internal notes", "ملاحظات داخلية")}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                maxLength={4000}
                className="mt-2 w-full rounded-md border border-[#D6D6D1] bg-white p-3 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#76634A]"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={saveNotes}
                className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#292925] px-3 text-xs font-semibold !text-white disabled:opacity-50"
              >
                <Save className="size-4" />
                {L(locale, "Save notes", "حفظ الملاحظات")}
              </button>
              {notice ? <span className="text-xs font-semibold text-[#315638]">{notice}</span> : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <p className="text-xs font-semibold">{L(locale, "Follow-up state", "حالة المتابعة")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {statuses.slice(1).map(([status, en, ar]) => (
                <button
                  key={status}
                  disabled={mutation.isPending || lead.status === status}
                  onClick={() => setStatus(status as DemoRequestStatus)}
                  type="button"
                  className="min-h-9 rounded-md border border-[#D6D6D1] bg-[#F7F7F4] px-3 text-[11px] font-semibold disabled:opacity-45"
                >
                  {L(locale, en, ar)}
                </button>
              ))}
            </div>
            {mutation.isError ? (
              <p className="mt-3 text-xs text-[#8D3F37]">{formatErrorMessage(mutation.error)}</p>
            ) : null}
          </section>
        </div>
      </aside>
    </>
  );
}

function LeadsContent() {
  const { locale } = useI18n();
  const token = usePlatformAuthStore((state) => state.accessToken) ?? "";
  const [status, setStatus] = useState<DemoRequestStatus | "">("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: platformQueryKeys.demoRequests(status, search),
    queryFn: () =>
      getPlatformDemoRequests(token, {
        status: status || undefined,
        search: search || undefined,
        limit: 100
      }),
    enabled: Boolean(token)
  });
  const selected = useMemo(
    () => query.data?.requests.find((lead) => lead.id === selectedId) ?? null,
    [query.data, selectedId]
  );

  return (
    <>
      <div className="grid gap-4">
        <section className="flex flex-col gap-3 rounded-lg border border-[#D9D9D4] bg-white p-4 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="absolute start-3 top-3 size-4 text-[#8A8A84]" />
            <input
              aria-label={L(locale, "Search demo requests", "ابحث في طلبات العرض")}
              placeholder={L(locale, "Search name, business or email", "ابحث بالاسم أو النشاط أو الإيميل")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 w-full rounded-md border border-[#D6D6D1] bg-[#FAFAF8] ps-9 pe-3 text-xs outline-none focus:border-[#76634A]"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map(([value, en, ar]) => (
              <button
                key={value || "all"}
                onClick={() => setStatus(value)}
                type="button"
                className={`min-h-9 rounded-md border px-3 text-[11px] font-semibold ${
                  status === value
                    ? "border-[#76634A] bg-[#76634A] text-white"
                    : "border-[#D6D6D1] bg-[#F7F7F4]"
                }`}
              >
                {L(locale, en, ar)}
              </button>
            ))}
          </div>
        </section>

        {query.data ? (
          <section className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-[#777771]">
              {L(locale, "Matching requests", "الطلبات المطابقة")}:{" "}
              <span className="font-semibold text-[#292925]">{query.data.total}</span>
            </p>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[#85857F]">
              <Clock3 className="size-3.5" />
              {L(locale, "Newest first", "الأحدث أولًا")}
            </p>
          </section>
        ) : null}

        {query.isPending ? (
          <LoadingState label={L(locale, "Loading demo requests", "جارٍ تحميل طلبات العرض")} />
        ) : null}

        {query.isError ? (
          <EmptyState
            title={L(locale, "Requests could not load", "تعذر تحميل الطلبات")}
            description={formatErrorMessage(query.error)}
            action={
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
              >
                <RefreshCw className="size-4" />
                {L(locale, "Retry", "إعادة المحاولة")}
              </button>
            }
          />
        ) : null}

        {query.data && query.data.requests.length === 0 ? (
          <EmptyState
            title={L(locale, "No demo requests", "لا توجد طلبات عرض")}
            description={L(
              locale,
              "No requests match the current search and follow-up filters.",
              "لا توجد طلبات مطابقة للبحث وفلاتر المتابعة الحالية."
            )}
          />
        ) : null}

        {query.data ? (
          <div className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
            <div className="divide-y divide-[#ECECE8]">
              {query.data.requests.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className="grid w-full gap-3 px-4 py-4 text-start hover:bg-[#FAFAF8] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px_120px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lead.businessName}</p>
                    <p className="mt-1 truncate text-xs text-[#777771]">{lead.fullName} · {lead.email}</p>
                  </div>
                  <div className="text-xs text-[#62625C]">
                    {lead.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {lead.city}
                      </span>
                    ) : (
                      "—"
                    )}
                    <p className="mt-1">{lead.locationCount} {L(locale, "location(s)", "فرع")}</p>
                  </div>
                  <span className="w-fit rounded-full border border-[#D7D7D2] bg-[#F7F7F4] px-2.5 py-1 text-[11px] font-semibold">
                    {statusLabel(locale, lead.status)}
                  </span>
                  <time className="text-xs text-[#777771]">
                    {new Date(lead.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                  </time>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <LeadDetail lead={selected} token={token} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}

export function PlatformLeadsPage() {
  const { locale } = useI18n();

  return (
    <PlatformShell
      title={L(locale, "Demo Requests", "طلبات العرض")}
      description={L(
        locale,
        "Internal inbox for demo requests, qualification and follow-up.",
        "صندوق داخلي لطلبات العرض والتأهيل والمتابعة."
      )}
      supporting={
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#526E57]" />
          <p className="text-xs leading-5 text-[#64645E]">
            {L(
              locale,
              "Requests originate from the public demo form, but contact details, notes and campaign context are restricted to authenticated Platform admins. Public submissions are rate-limited.",
              "الطلبات تأتي من نموذج العرض العام، لكن بيانات التواصل والملاحظات وسياق الحملات متاحة فقط لمسؤولي Platform الموثقين. الإرسال العام عليه حدود معدل."
            )}
          </p>
        </div>
      }
    >
      <PlatformAuthGate>
        <LeadsContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
