"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MapPin, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getPlatformDemoRequests, updatePlatformDemoRequest } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type { DemoRequest, DemoRequestStatus } from "@/lib/api/types";
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
  ["closed", "Closed", "مغلق"],
];

function LeadCard({ lead, token }: { lead: DemoRequest; token: string }) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(lead.internalNotes ?? "");
  const mutation = useMutation({
    mutationFn: (status: DemoRequestStatus) =>
      updatePlatformDemoRequest(
        lead.id,
        {
          status,
          internalNotes: notes || null,
          lastContactedAt: status === "contacted" ? new Date().toISOString() : undefined,
        },
        token,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "demo-requests"] }),
  });

  return (
    <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#7A746D]">{lead.businessName}</p>
          <h2 className="mt-1 text-base font-semibold">{lead.fullName}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#686862]">
            <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>
            {lead.phone ? <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a> : null}
            {lead.city ? <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{lead.city}</span> : null}
            <span>{lead.locationCount} {L(locale, "location(s)", "فرع")}</span>
          </div>
        </div>
        <span className="rounded-full border border-[#D7D7D2] bg-[#F7F7F4] px-2.5 py-1 text-[11px] font-semibold">{lead.status}</span>
      </div>
      {lead.message ? <p className="mt-4 rounded-md bg-[#F7F7F4] p-3 text-xs leading-6 text-[#575752]">{lead.message}</p> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#74746E]">{L(locale, "Internal notes", "ملاحظات داخلية")}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={4000} className="mt-1.5 w-full rounded-md border border-[#D6D6D1] bg-white p-2 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#76634A]" /></label>
        <div className="flex flex-wrap gap-1.5">
          {statuses.slice(1).map(([status, en, ar]) => (
            <button key={status} disabled={mutation.isPending || lead.status === status} onClick={() => mutation.mutate(status as DemoRequestStatus)} type="button" className="min-h-9 rounded-md border border-[#D6D6D1] bg-[#F7F7F4] px-2.5 text-[11px] font-semibold disabled:opacity-45">{L(locale, en, ar)}</button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10px] text-[#8A8A84]">{new Date(lead.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</p>
      {mutation.isError ? <p className="mt-2 text-xs text-[#8D3F37]">{formatErrorMessage(mutation.error)}</p> : null}
    </article>
  );
}

function LeadsContent() {
  const { locale } = useI18n();
  const token = usePlatformAuthStore((state) => state.accessToken) ?? "";
  const [status, setStatus] = useState<DemoRequestStatus | "">("");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: platformQueryKeys.demoRequests(status, search),
    queryFn: () => getPlatformDemoRequests(token, { status: status || undefined, search: search || undefined, limit: 100 }),
    enabled: Boolean(token),
  });

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-[#D9D9D4] bg-white p-4 md:flex-row md:items-center">
        <label className="relative flex-1"><Search className="absolute start-3 top-3 size-4 text-[#8A8A84]" /><input aria-label={L(locale, "Search leads", "ابحث في الطلبات")} placeholder={L(locale, "Search name, business or email", "ابحث بالاسم أو النشاط أو الإيميل")} value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-10 w-full rounded-md border border-[#D6D6D1] bg-[#FAFAF8] ps-9 pe-3 text-xs outline-none focus:border-[#76634A]" /></label>
        <div className="flex flex-wrap gap-1.5">{statuses.map(([value, en, ar]) => <button key={value || "all"} onClick={() => setStatus(value)} type="button" className={`min-h-9 rounded-md border px-3 text-[11px] font-semibold ${status === value ? "border-[#76634A] bg-[#76634A] text-white" : "border-[#D6D6D1] bg-[#F7F7F4]"}`}>{L(locale, en, ar)}</button>)}</div>
      </section>
      {query.isPending ? <LoadingState label={L(locale, "Loading demo requests", "جارٍ تحميل طلبات العرض")} /> : null}
      {query.isError ? <EmptyState title={L(locale, "Requests could not load", "تعذر تحميل الطلبات")} description={formatErrorMessage(query.error)} action={<button type="button" onClick={() => void query.refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"><RefreshCw className="size-4" />{L(locale, "Retry", "إعادة المحاولة")}</button>} /> : null}
      {query.data && query.data.requests.length === 0 ? <EmptyState title={L(locale, "No demo requests", "لا توجد طلبات عرض")} description={L(locale, "New requests submitted from the public site will appear here.", "طلبات العرض الجديدة من الموقع العام ستظهر هنا.")} /> : null}
      {query.data ? <div className="grid gap-3">{query.data.requests.map((lead) => <LeadCard key={lead.id} lead={lead} token={token} />)}</div> : null}
    </div>
  );
}

export function PlatformLeadsPage() {
  const { locale } = useI18n();
  return <PlatformShell title={L(locale, "Demo Requests", "طلبات العرض")} description={L(locale, "A persisted inbox for public demo requests and follow-up state.", "صندوق محفوظ لطلبات العرض العامة وحالة المتابعة.")} supporting={<div className="flex items-center gap-3"><Mail className="size-5 text-[#76634A]" /><p className="text-xs leading-5 text-[#64645E]">{L(locale, "This is the canonical handoff from the public site to Balcona Platform.", "ده مسار التسليم الرسمي من الموقع العام إلى Balcona Platform.")}</p></div>}><PlatformAuthGate><LeadsContent /></PlatformAuthGate></PlatformShell>;
}
