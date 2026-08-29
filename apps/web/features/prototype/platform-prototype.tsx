"use client";

import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Languages,
  LayoutDashboard,
  Plus,
  Server,
  ShieldCheck,
  UsersRound,
  X
} from "lucide-react";
import { useState, type ReactNode } from "react";

type Locale = "en" | "ar";
type View = "dashboard" | "companies" | "new" | "plans" | "status";
type Tone = "ok" | "warn" | "danger" | "neutral";

type Company = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription: string;
  branches: number;
  staff: number;
  usage: string;
  tone: Tone;
};

const companies: Company[] = [
  { id:"cmp-01", name:"Balkona", slug:"balkona", plan:"Pilot", subscription:"active", branches:1, staff:7, usage:"42% AI usage", tone:"ok" },
  { id:"cmp-02", name:"Nile Corner", slug:"nile-corner", plan:"Growth", subscription:"trialing", branches:3, staff:22, usage:"63% table limit", tone:"warn" },
  { id:"cmp-03", name:"Roast House", slug:"roast-house", plan:"Starter", subscription:"past_due", branches:1, staff:9, usage:"92% staff limit", tone:"warn" },
  { id:"cmp-04", name:"Terrace Lab", slug:"terrace-lab", plan:"Starter", subscription:"suspended", branches:1, staff:4, usage:"Access restricted", tone:"danger" }
];

function L(locale:Locale,en:string,ar:string){return locale==="ar"?ar:en;}

function Pill({tone="neutral",children}:{tone?:Tone;children:ReactNode}){
  const cls={
    ok:"border-[#C8D7C8] bg-[#F0F6EF] text-[#315638]",
    warn:"border-[#E5D2AD] bg-[#FFF8E9] text-[#7D591F]",
    danger:"border-[#E4C5C1] bg-[#FBEEEE] text-[#8D3F37]",
    neutral:"border-[#D7D7D2] bg-[#F7F7F4] text-[#62625C]"
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function Metric({label,value,hint,tone="neutral"}:{label:string;value:string;hint:string;tone?:Tone}){
  return (
    <div className="border-e border-[#E2E2DD] p-4 last:border-e-0 rtl:border-e-0 rtl:border-s rtl:last:border-s-0">
      <p className="text-[11px] text-[#777771]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{value}</p>
      <p className={`mt-1 text-[11px] ${tone==="danger"?"text-[#8D3F37]":tone==="warn"?"text-[#805C25]":"text-[#85857F]"}`}>{hint}</p>
    </div>
  );
}

function CompanyDrawer({company,locale,onClose}:{company:Company|null;locale:Locale;onClose:()=>void}){
  if(!company)return null;
  return (
    <>
      <button type="button" aria-label={L(locale,"Close company detail","إغلاق تفاصيل الشركة")} onClick={onClose} className="fixed inset-0 z-40 bg-black/15"/>
      <aside className="fixed inset-y-0 end-0 z-50 w-full max-w-lg overflow-y-auto border-s border-[#D5D5D0] bg-[#FBFBF8] shadow-[-18px_0_50px_rgba(0,0,0,.12)]">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[#DEDED9] bg-[#FBFBF8]/96 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A746D]">BALCONA PLATFORM · TENANT</p>
            <h2 className="mt-1.5 text-xl font-semibold">{company.name}</h2>
            <p className="mt-1 text-xs text-[#777771]">{company.slug}</p>
          </div>
          <button type="button" aria-label={L(locale,"Close company detail","إغلاق تفاصيل الشركة")} onClick={onClose} className="flex size-9 items-center justify-center rounded-md border border-[#D5D5D0] bg-white"><X className="size-4"/></button>
        </div>
        <div className="grid gap-4 p-5">
          <section className="overflow-hidden rounded-lg border border-[#DADAD5] bg-white">
            <div className="border-b border-[#E7E7E2] px-4 py-3"><h3 className="text-xs font-semibold">{L(locale,"Tenant summary","ملخص الشركة")}</h3></div>
            {[
              [L(locale,"Plan","الخطة"),company.plan],
              [L(locale,"Subscription","الاشتراك"),company.subscription],
              [L(locale,"Branches","الفروع"),String(company.branches)],
              [L(locale,"Staff memberships","عضويات الفريق"),String(company.staff)],
              [L(locale,"Usage signal","إشارة الاستخدام"),company.usage]
            ].map(([a,b])=><div key={a} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-[#EEEEEA] px-4 py-3 text-xs last:border-0"><span className="text-[#797973]">{a}</span><span className="font-semibold">{b}</span></div>)}
          </section>

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">{L(locale,"Staff handoff","تسليم الفريق")}</p>
                <p className="mt-1 text-xs leading-5 text-[#777771]">{L(locale,"Owner access is handed off through the existing invite flow. Platform does not impersonate restaurant staff.","وصول المالك يتم عبر نظام الدعوات الحالي. Platform لا ينتحل دور موظفي المطعم.")}</p>
              </div>
              <UsersRound className="size-5 text-[#76634A]"/>
            </div>
          </section>

          <section className="rounded-lg border border-[#DADAD5] bg-white p-4">
            <p className="text-xs font-semibold">{L(locale,"Subscription control","إدارة الاشتراك")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" className="min-h-10 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold">{L(locale,"Change plan","تغيير الخطة")}</button>
              <button type="button" className="min-h-10 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold">{L(locale,"Update status","تغيير الحالة")}</button>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#85857F]">{L(locale,"This controls Balcona access state only. It is not a recurring-billing provider workflow.","ده يتحكم في حالة الوصول لبلكونة فقط، وليس نظام تحصيل اشتراك دوري من مزود دفع.")}</p>
          </section>

          <button type="button" className="min-h-11 rounded-md bg-[#292925] px-4 text-sm font-semibold text-white">{L(locale,"Open full company","افتح الشركة كاملة")}</button>
        </div>
      </aside>
    </>
  );
}

function Dashboard({locale,onCompany}:{locale:Locale;onCompany:(c:Company)=>void}){
  return (
    <div className="grid gap-4">
      <section className="grid overflow-hidden rounded-lg border border-[#D9D9D4] bg-white sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={L(locale,"Companies","الشركات")} value="4" hint={L(locale,"4 tenant workspaces","4 مساحات عمل")}/>
        <Metric label={L(locale,"Active","نشط")} value="1" hint={L(locale,"verified internal state","حالة داخلية مؤكدة")}/>
        <Metric label={L(locale,"Trialing","تجريبي")} value="1" hint={L(locale,"onboarding in progress","التجهيز مستمر")} tone="warn"/>
        <Metric label={L(locale,"Needs action","يحتاج تدخل")} value="2" hint={L(locale,"past due / suspended","متأخر / موقوف")} tone="danger"/>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
        <div className="flex items-center justify-between border-b border-[#E7E7E2] px-4 py-3">
          <div><h2 className="text-sm font-semibold">{L(locale,"Tenant attention","تنبيهات الشركات")}</h2><p className="mt-1 text-xs text-[#777771]">{L(locale,"Subscription and onboarding states requiring platform review.","حالات الاشتراك والتجهيز التي تحتاج مراجعة Platform.")}</p></div>
          <Pill tone="danger">2</Pill>
        </div>
        <div className="divide-y divide-[#ECECE8]">
          {companies.filter(c=>c.tone!=="ok").map(c=>(
            <button key={c.id} onClick={()=>onCompany(c)} className="grid w-full gap-3 px-4 py-3 text-start hover:bg-[#FAFAF8] sm:grid-cols-[minmax(0,1fr)_140px_120px_auto] sm:items-center">
              <div><p className="text-sm font-semibold">{c.name}</p><p className="mt-1 text-xs text-[#777771]">{c.slug}</p></div>
              <span className="text-xs">{c.plan}</span>
              <Pill tone={c.tone}>{c.subscription}</Pill>
              <ChevronRight className="size-4 text-[#999993] rtl:rotate-180"/>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
          <div className="border-b border-[#E7E7E2] px-4 py-3"><h2 className="text-sm font-semibold">{L(locale,"Companies","الشركات")}</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-[#E8E8E4] bg-[#F7F7F4] text-[11px] text-[#6F6F69]">
                {[L(locale,"Company","الشركة"),L(locale,"Plan","الخطة"),L(locale,"Subscription","الاشتراك"),L(locale,"Branches","الفروع"),L(locale,"Staff","الفريق"),L(locale,"Usage","الاستخدام")].map(h=><th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#ECECE8]">
                {companies.map(c=><tr key={c.id} onClick={()=>onCompany(c)} className="cursor-pointer hover:bg-[#FAFAF8]">
                  <td className="px-4 py-3.5"><p className="font-semibold">{c.name}</p><p className="text-xs text-[#777771]">{c.slug}</p></td>
                  <td className="px-4 py-3.5">{c.plan}</td><td className="px-4 py-3.5"><Pill tone={c.tone}>{c.subscription}</Pill></td>
                  <td className="px-4 py-3.5">{c.branches}</td><td className="px-4 py-3.5">{c.staff}</td><td className="px-4 py-3.5">{c.usage}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
            <div className="flex items-start justify-between"><div><h3 className="text-sm font-semibold">{L(locale,"System status","حالة النظام")}</h3><p className="mt-1 text-xs leading-5 text-[#777771]">{L(locale,"API metadata reachable · production-shaped runtime","API متاح · بيئة تشغيل production-shaped")}</p></div><Activity className="size-4 text-[#4F7655]"/></div>
            <div className="mt-3"><Pill tone="ok">{L(locale,"Online","متصل")}</Pill></div>
          </article>
          <article className="rounded-lg border border-[#D9D9D4] bg-white p-4">
            <div className="flex items-start justify-between"><div><h3 className="text-sm font-semibold">{L(locale,"Bootstrap queue","قائمة التجهيز")}</h3><p className="mt-1 text-xs leading-5 text-[#777771]">{L(locale,"1 cafe still in onboarding handoff.","كافيه واحد ما زال في مرحلة التسليم.")}</p></div><Building2 className="size-4 text-[#76634A]"/></div>
          </article>
        </div>
      </section>
    </div>
  );
}

function Companies({locale,onCompany}:{locale:Locale;onCompany:(c:Company)=>void}){
  return (
    <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E7E7E2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-semibold">{L(locale,"All companies","كل الشركات")}</h2><p className="mt-1 text-xs text-[#777771]">{L(locale,"Internal tenant registry and subscription state.","سجل الشركات وحالة الاشتراك الداخلية.")}</p></div>
        <input aria-label={L(locale,"Search companies","ابحث عن شركة")} placeholder={L(locale,"Search company or slug…","ابحث بالاسم أو slug…")} className="min-h-10 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs outline-none"/>
      </div>
      <div className="divide-y divide-[#ECECE8]">
        {companies.map(c=><button key={c.id} onClick={()=>onCompany(c)} className="grid w-full gap-3 px-4 py-4 text-start hover:bg-[#FAFAF8] md:grid-cols-[minmax(0,1.4fr)_120px_120px_90px_90px_auto] md:items-center">
          <div><p className="font-semibold">{c.name}</p><p className="mt-1 text-xs text-[#777771]">{c.slug}</p></div>
          <span className="text-xs">{c.plan}</span><Pill tone={c.tone}>{c.subscription}</Pill><span className="text-xs">{c.branches} {L(locale,"branch","فرع")}</span><span className="text-xs">{c.staff} {L(locale,"staff","موظف")}</span><ChevronRight className="size-4 text-[#999993] rtl:rotate-180"/>
        </button>)}
      </div>
    </section>
  );
}

function NewCafe({locale}:{locale:Locale}){
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-lg border border-[#D9D9D4] bg-white">
        <div className="border-b border-[#E7E7E2] px-5 py-4">
          <Pill>{L(locale,"BOOTSTRAP","تجهيز جديد")}</Pill>
          <h2 className="mt-3 text-xl font-semibold">{L(locale,"Create the tenant foundation","أنشئ أساس الشركة")}</h2>
          <p className="mt-1 text-xs leading-5 text-[#777771]">{L(locale,"Company, first branch, owner handoff and optional starter tables in one bounded transaction.","الشركة والفرع الأول وتسليم المالك وترابيزات البداية في عملية واحدة محددة.")}</p>
        </div>
        <div className="grid gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [L(locale,"Company name","اسم الشركة"),"Nile Cafe"],
              ["Slug","nile-cafe"],
              [L(locale,"First branch","الفرع الأول"),"Nile Cafe Main"],
              [L(locale,"Owner email","إيميل المالك"),"owner@example.com"]
            ].map(([label,value])=><label key={label} className="grid gap-1.5 text-xs font-semibold text-[#55554F]">{label}<input defaultValue={value} className="min-h-10 rounded-md border border-[#D6D6D1] bg-white px-3 text-sm font-normal outline-none"/></label>)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold text-[#55554F]">{L(locale,"Plan","الخطة")}<select className="min-h-10 rounded-md border border-[#D6D6D1] bg-white px-3 text-sm font-normal"><option>Pilot</option><option>Starter</option><option>Growth</option><option>Enterprise</option></select></label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#55554F]">{L(locale,"Subscription state","حالة الاشتراك")}<select className="min-h-10 rounded-md border border-[#D6D6D1] bg-white px-3 text-sm font-normal"><option>trialing</option><option>active</option></select></label>
          </div>
          <label className="flex items-start gap-3 rounded-md border border-[#DADAD5] bg-[#F8F8F5] p-4">
            <input type="checkbox" defaultChecked className="mt-1 size-4"/>
            <span><span className="block text-sm font-semibold">{L(locale,"Create starter floor, tables and QR","أنشئ دور وترابيزات وQR كبداية")}</span><span className="mt-1 block text-xs leading-5 text-[#777771]">{L(locale,"Uses the existing bootstrap contract; this is not a menu seed or production data import.","يستخدم عقد الـbootstrap الحالي؛ وليس استيراد منيو أو بيانات production.")}</span></span>
          </label>
          <button type="button" className="min-h-11 justify-self-start rounded-md bg-[#292925] px-4 text-sm font-semibold text-white">{L(locale,"Create cafe workspace","أنشئ مساحة الكافيه")}</button>
        </div>
      </section>
      <aside className="grid content-start gap-4">
        <article className="rounded-lg border border-[#D9D9D4] bg-white p-4"><ShieldCheck className="size-5 text-[#526E57]"/><h3 className="mt-3 text-sm font-semibold">{L(locale,"What this creates","ما الذي يتم إنشاؤه")}</h3><p className="mt-2 text-xs leading-6 text-[#777771]">{L(locale,"Company · subscription state · first branch · owner staff identity · optional starter floor/tables/QR · audit event.","شركة · حالة اشتراك · أول فرع · هوية المالك · دور/ترابيزات/QR اختيارية · audit event.")}</p></article>
        <article className="rounded-lg border border-[#D9D9D4] bg-white p-4"><AlertTriangle className="size-5 text-[#8A6331]"/><h3 className="mt-3 text-sm font-semibold">{L(locale,"Not created here","لا يتم إنشاؤه هنا")}</h3><p className="mt-2 text-xs leading-6 text-[#777771]">{L(locale,"Public signup, real subscription checkout, merchant payment credentials, production menu import or staff impersonation.","تسجيل عام أو دفع اشتراك حقيقي أو بيانات مزود دفع أو استيراد منيو production أو انتحال موظف.")}</p></article>
      </aside>
    </div>
  );
}

function Plans({locale}:{locale:Locale}){
  const plans=[
    ["Pilot","Internal / pilot","Generous pilot entitlements","ok"],
    ["Starter","EGP configured","Single-location baseline","neutral"],
    ["Growth","EGP configured","Multi-location capability","neutral"],
    ["Enterprise","Custom","Negotiated limits","neutral"]
  ] as const;
  return <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
    <div className="border-b border-[#E7E7E2] px-4 py-4"><h2 className="text-sm font-semibold">{L(locale,"Plans & subscription state","الخطط وحالة الاشتراك")}</h2><p className="mt-1 text-xs text-[#777771]">{L(locale,"Internal entitlement model. Real recurring billing remains a separate billing program.","نموذج صلاحيات داخلي. التحصيل الدوري الحقيقي برنامج منفصل.")}</p></div>
    <div className="divide-y divide-[#ECECE8]">{plans.map(([name,price,desc,tone])=><div key={name} className="grid gap-2 px-4 py-4 sm:grid-cols-[140px_150px_minmax(0,1fr)_auto] sm:items-center"><strong>{name}</strong><span className="text-xs">{price}</span><span className="text-xs text-[#777771]">{desc}</span><Pill tone={tone}>{L(locale,"Available","متاح")}</Pill></div>)}</div>
  </section>;
}

function Status({locale}:{locale:Locale}){
  return <div className="grid gap-4 lg:grid-cols-2">
    {[
      [Server,L(locale,"API target","هدف API"),"https://api…/api/v1",L(locale,"Permanent host shape","عنوان دائم"),"ok"],
      [Activity,L(locale,"API metadata","بيانات API"),"balcona-api · v0.1",L(locale,"Reachable in prototype state","متاح في حالة النموذج"),"ok"],
      [ShieldCheck,L(locale,"Environment","البيئة"),"staging / production-shaped",L(locale,"No dev bootstrap exposed","بدون dev bootstrap ظاهر"),"ok"],
      [CircleDollarSign,L(locale,"Billing provider","مزود الاشتراكات"),L(locale,"Not connected","غير متصل"),L(locale,"BILL-1 external program","برنامج BILL-1 منفصل"),"warn"]
    ].map(([Icon,title,value,hint,tone])=>{
      const I=Icon as typeof Server;
      return <article key={String(title)} className="rounded-lg border border-[#D9D9D4] bg-white p-5"><div className="flex items-start justify-between gap-4"><I className="size-5 text-[#71624F]"/><Pill tone={tone as Tone}>{tone==="ok"?L(locale,"Healthy","سليم"):L(locale,"Not configured","غير متصل")}</Pill></div><h3 className="mt-4 text-sm font-semibold">{String(title)}</h3><p className="mt-2 break-words text-lg font-semibold">{String(value)}</p><p className="mt-1 text-xs text-[#777771]">{String(hint)}</p></article>;
    })}
  </div>;
}

export function PlatformPrototype(){
  const [locale,setLocale]=useState<Locale>("en");
  const [view,setView]=useState<View>("dashboard");
  const [selected,setSelected]=useState<Company|null>(null);

  const nav=[
    ["dashboard",LayoutDashboard,L(locale,"Dashboard","الرئيسية")],
    ["companies",Building2,L(locale,"Companies","الشركات")],
    ["new",Plus,L(locale,"New Cafe","كافيه جديد")],
    ["plans",CircleDollarSign,L(locale,"Plans","الخطط")],
    ["status",Activity,L(locale,"System Status","حالة النظام")]
  ] as const;

  const titles:Record<View,[string,string]>={
    dashboard:[L(locale,"Platform Dashboard","لوحة Platform"),L(locale,"Tenant attention, onboarding handoff and internal SaaS state.","تنبيهات الشركات وتسليم التجهيز وحالة SaaS الداخلية.")],
    companies:[L(locale,"Companies","الشركات"),L(locale,"Tenant registry, plans, branch counts and access state.","سجل الشركات والخطط والفروع وحالة الوصول.")],
    new:[L(locale,"New Cafe / Bootstrap","كافيه جديد / Bootstrap"),L(locale,"Create the minimum tenant foundation through the existing platform contract.","أنشئ الحد الأدنى للشركة من خلال عقد Platform الحالي.")],
    plans:[L(locale,"Plans & Subscriptions","الخطط والاشتراكات"),L(locale,"Internal entitlement and subscription-state model — separate from restaurant customer money.","نموذج الصلاحيات وحالة الاشتراك الداخلي — منفصل عن فلوس عملاء المطعم.")],
    status:[L(locale,"System Status","حالة النظام"),L(locale,"Safe runtime metadata for the internal platform team.","بيانات تشغيل آمنة لفريق Platform الداخلي.")]
  };

  return (
    <div dir={locale==="ar"?"rtl":"ltr"} className="min-h-screen bg-[#F3F3F0] text-[#20201D]">
      <div className="grid min-h-screen min-w-0 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-b border-[#D6D6D1] bg-[#EAEAE6] px-3 py-3 lg:overflow-visible lg:border-b-0 lg:border-e lg:py-4">
          <div className="flex items-center gap-3 px-2"><div className="flex size-8 items-center justify-center rounded-md bg-[#292925] text-xs font-black text-white">B</div><div><p className="text-sm font-semibold">Balcona</p><p className="text-[10px] text-[#777771]">Platform</p></div></div>
          <nav className="mt-3 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 lg:mt-7 lg:grid lg:gap-0.5 lg:overflow-visible lg:pb-0" aria-label="Platform">
            {nav.map(([id,Icon,label])=><button key={id} type="button" onClick={()=>{setView(id);setSelected(null)}} className={`flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs font-medium lg:shrink lg:text-sm ${view===id?"bg-white font-semibold":"text-[#64645E] hover:bg-[#E1E1DC]"}`}><Icon className="size-4"/><span className="whitespace-nowrap">{label}</span></button>)}
          </nav>
          <div className="mt-7 hidden border-t border-[#D1D1CC] pt-4 lg:block"><p className="px-2 text-[9px] font-semibold uppercase tracking-[.14em] text-[#868680]">{L(locale,"INTERNAL ADMIN ONLY","إدارة داخلية فقط")}</p></div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-[#DADAD5] bg-[#F8F8F5]/96 px-4 backdrop-blur sm:px-6">
            <span className="hidden text-xs font-semibold text-[#74746E] sm:inline">{L(locale,"Platform scope · all tenants","نطاق Platform · كل الشركات")}</span>
            <div className="ms-auto flex items-center gap-2"><Pill tone="neutral">{L(locale,"Internal","داخلي")}</Pill><button type="button" onClick={()=>setLocale(v=>v==="en"?"ar":"en")} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#D5D5D0] bg-white px-3 text-xs font-semibold"><Languages className="size-3.5"/>{locale==="en"?"العربية":"EN"}</button></div>
          </header>

          <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7">
            <section className="mb-4 border-b border-[#D7D7D2] pb-4"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#796D5E]">BALCONA PLATFORM</p><h1 className="mt-1.5 text-2xl font-semibold tracking-[-.03em]">{titles[view][0]}</h1><p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#74746E]">{titles[view][1]}</p></section>
            {view==="dashboard"?<Dashboard locale={locale} onCompany={setSelected}/>:null}
            {view==="companies"?<Companies locale={locale} onCompany={setSelected}/>:null}
            {view==="new"?<NewCafe locale={locale}/>:null}
            {view==="plans"?<Plans locale={locale}/>:null}
            {view==="status"?<Status locale={locale}/>:null}

            <CompanyDrawer company={selected} locale={locale} onClose={()=>setSelected(null)}/>
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#DADAD5] pt-3 text-[10px] text-[#85857F]"><span>{L(locale,"Platform prototype · Office visual system","نموذج Platform · مبني على نظام Office")}</span><span>{L(locale,"Tenant operations only · no cafe-floor impersonation","إدارة شركات فقط · بدون انتحال تشغيل الكافيه")}</span></footer>
          </main>
        </div>
      </div>
    </div>
  );
}
