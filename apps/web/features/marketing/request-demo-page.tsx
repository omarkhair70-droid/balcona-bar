"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createDemoRequest } from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import type { CreateDemoRequestResult } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { MarketingShell, ML } from "./marketing-shell";

type FormState = {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  locationCount: string;
  message: string;
  consent: boolean;
  website: string;
};

const initialForm: FormState = {
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  city: "",
  locationCount: "1",
  message: "",
  consent: false,
  website: "",
};

export function RequestDemoPage() {
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [confirmation, setConfirmation] = useState<CreateDemoRequestResult>();
  const mutation = useMutation({
    mutationFn: createDemoRequest,
    onSuccess: (result) => {
      setConfirmation(result);
      setForm(initialForm);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({
      fullName: form.fullName,
      businessName: form.businessName,
      email: form.email,
      phone: form.phone || undefined,
      city: form.city || undefined,
      locationCount: Number(form.locationCount),
      message: form.message || undefined,
      consent: form.consent,
      website: form.website,
      source: "marketing-site",
      utmSource: searchParams.get("utm_source") ?? undefined,
      utmMedium: searchParams.get("utm_medium") ?? undefined,
      utmCampaign: searchParams.get("utm_campaign") ?? undefined,
    });
  }

  const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-[#CFC6B8] bg-white px-3 text-sm outline-none focus:border-[#8C512D] focus:ring-2 focus:ring-[#8C512D]/15";

  return (
    <MarketingShell>
      <main className="mx-auto grid max-w-[1100px] gap-10 px-5 py-14 lg:grid-cols-[.7fr_1.3fr] lg:px-8 lg:py-20">
        <section>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">{ML("A working session, not a sales deck", "جلسة تشغيل، مش عرض مبيعات", locale)}</p>
          <h1 className="mt-4 font-serif text-6xl font-semibold leading-[.9] tracking-[-.055em]">{ML("Map Balcona to your café.", "خلّي بلكونة على مقاس كافيهك.", locale)}</h1>
          <p className="mt-6 text-base leading-8 text-[#655E56]">{ML("Tell us how your operation works. We’ll walk through the guest, floor, kitchen and office flow around one real branch.", "احكيلنا تشغيلك ماشي إزاي، ونراجع مسار الضيف والصالة والمطبخ والإدارة على فرع حقيقي.", locale)}</p>
        </section>

        <section className="rounded-[24px] border border-[#D4CCBF] bg-[#FBF8F1] p-5 shadow-[0_24px_60px_rgba(57,42,30,.09)] sm:p-8">
          {confirmation ? (
            <div className="grid min-h-[460px] place-items-center text-center">
              <div>
                <CheckCircle2 className="mx-auto size-12 text-[#426B43]" />
                <h2 className="mt-5 font-serif text-4xl font-semibold">{ML("Request received.", "استلمنا طلبك.", locale)}</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#655E56]">{ML("Your request is stored in Balcona Platform. We’ll use the contact details you provided to arrange the session.", "طلبك اتحفظ داخل Balcona Platform، وهنستخدم بيانات التواصل اللي قدمتها لترتيب الجلسة.", locale)}</p>
                <p className="mt-5 rounded-lg bg-[#E9E3D8] px-3 py-2 font-mono text-xs">{ML("Reference", "رقم المرجع", locale)}: {confirmation.id}</p>
                <button type="button" onClick={() => setConfirmation(undefined)} className="mt-6 text-sm font-black text-[#8C512D]">{ML("Send another request", "أرسل طلبًا آخر", locale)}</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} aria-busy={mutation.isPending} className="grid gap-5 sm:grid-cols-2">
              <label className="text-xs font-bold">{ML("Your name", "اسمك", locale)}<input required minLength={2} maxLength={120} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold">{ML("Business name", "اسم النشاط", locale)}<input required minLength={2} maxLength={160} autoComplete="organization" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold">{ML("Work email", "إيميل العمل", locale)}<input required type="email" maxLength={255} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold">{ML("Phone", "الموبايل", locale)}<input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold">{ML("City", "المدينة", locale)}<input maxLength={100} autoComplete="address-level2" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold">{ML("Number of locations", "عدد الفروع", locale)}<input required type="number" min={1} max={500} value={form.locationCount} onChange={(event) => setForm({ ...form, locationCount: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold sm:col-span-2">{ML("What should we understand before the demo?", "إيه أهم حاجة نفهمها قبل العرض؟", locale)}<textarea rows={5} maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className={`${fieldClass} py-3`} /></label>
              <label className="absolute -left-[10000px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
              <label className="flex gap-3 text-xs leading-5 text-[#655E56] sm:col-span-2"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} className="mt-0.5 size-4 accent-[#8C512D]" />{ML("I agree that Balcona may contact me about this demo request. My details will be used only to follow up on this request.", "أوافق إن بلكونة تتواصل معايا بخصوص طلب العرض ده، وتستخدم بياناتي لمتابعة الطلب فقط.", locale)}</label>
              {mutation.isError ? <p role="alert" className="rounded-lg border border-[#E0B9B3] bg-[#FFF1EF] p-3 text-xs text-[#8B332A] sm:col-span-2">{formatErrorMessage(mutation.error)}</p> : null}
              <button disabled={mutation.isPending} type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white disabled:opacity-60 sm:col-span-2">{mutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}{ML(mutation.isPending ? "Sending…" : "Request the demo", mutation.isPending ? "جارٍ الإرسال…" : "اطلب العرض", locale)}</button>
            </form>
          )}
        </section>
      </main>
    </MarketingShell>
  );
}
