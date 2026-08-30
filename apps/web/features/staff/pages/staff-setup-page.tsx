"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck
} from "lucide-react";
import {
  useMemo,
  useState
} from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  SetupReadinessFrame,
  type SetupPhaseId
} from "@/features/staff/setup-readiness-frame";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  getBranchLaunchChecklist,
  getBranchOnboarding,
  getCompanyOnboarding,
  getMerchantPaymentIntegrations,
  inviteOnboardingStaff,
  updateBranchOnboardingProfile,
  updateCompanyOnboardingProfile
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  InviteOnboardingStaffPayload,
  TenantOnboardingChecklistItem,
  TenantOnboardingReadinessStatus,
  TenantOnboardingStaffRole
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import {
  hasCompanyStaffPermission,
  hasStaffPermission
} from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";

const inputClass =
  "min-h-11 w-full rounded-md border border-[#D8D1C8] bg-white px-3 text-sm text-[#2B2520] outline-none transition focus:border-[#B17A3D] focus:ring-2 focus:ring-[#B17A3D]/20 disabled:cursor-not-allowed disabled:opacity-55";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#2D2823] px-4 text-sm font-semibold text-white transition hover:bg-[#3A332D] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#D8D1C8] bg-white px-3 text-xs font-semibold text-[#4C433B] transition hover:bg-[#F8F4EE] disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-xl border border-[#D8D2C9] bg-[#FFFDF9]";

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function statusLabel(
  locale: "en" | "ar",
  status: TenantOnboardingReadinessStatus
) {
  if (status === "ready") return L(locale, "Ready", "جاهز");
  if (status === "blocked") return L(locale, "Blocked", "متوقف");
  if (status === "needs_attention") {
    return L(locale, "Needs attention", "يحتاج انتباه");
  }
  return L(locale, "Missing", "ناقص");
}

function readinessText(
  locale: "en" | "ar",
  item: TenantOnboardingChecklistItem
) {
  if (locale === "en") {
    return { label: item.label, reason: item.reason };
  }

  const ready = item.status === "ready";
  const copy: Record<string, { label: string; ready: string; pending: string }> = {
    company_profile: {
      label: "ملف الشركة مكتمل",
      ready: "اسم الشركة والمعرف والحالة النشطة جاهزة.",
      pending: "أكمل اسم الشركة والمعرف والحالة قبل التشغيل."
    },
    branch_profile: {
      label: "ملف الفرع مكتمل",
      ready: "اسم الفرع والمعرف والعنوان والحالة جاهزة.",
      pending: "أكمل بيانات الفرع والعنوان والحالة قبل التشغيل."
    },
    branches_created: {
      label: "تم إنشاء فرع",
      ready: "يوجد فرع واحد على الأقل داخل الشركة.",
      pending: "أنشئ أول فرع للانتقال من تجهيز الشركة إلى تجهيز التشغيل."
    },
    active_branch_ready: {
      label: "يوجد فرع نشط",
      ready: "يوجد فرع نشط يمكن استكمال تجهيزه.",
      pending: "فعّل أول فرع قبل تشغيل QR واستكمال الجاهزية."
    },
    floors_created: {
      label: "تم إنشاء الأدوار أو المناطق",
      ready: "يوجد دور أو منطقة خدمة واحدة على الأقل.",
      pending: "أنشئ دورًا أو منطقة خدمة واحدة على الأقل."
    },
    tables_created: {
      label: "الترابيزات النشطة جاهزة",
      ready: "يوجد ترابيزات نشطة جاهزة لاستقبال العملاء.",
      pending: "أنشئ ترابيزات نشطة قبل تشغيل QR للعملاء."
    },
    qr_links_ready: {
      label: "روابط QR جاهزة",
      ready: "كل ترابيزة نشطة لها QR token.",
      pending: "بعض الترابيزات النشطة ما زالت تحتاج QR token."
    },
    owner_staff_ready: {
      label: "المالك أو المدير جاهز",
      ready: "يوجد مالك أو مدير فرع مخصص للتشغيل.",
      pending: "أضف مالكًا أو مدير فرع قبل التشغيل."
    },
    cashier_staff_ready: {
      label: "الكاشير جاهز",
      ready: "يوجد كاشير مخصص للفرع.",
      pending: "أضف كاشير قبل التشغيل."
    },
    kitchen_staff_ready: {
      label: "المطبخ أو الباريستا جاهز",
      ready: "يوجد دور مطبخ أو باريستا مخصص للفرع.",
      pending: "أضف موظف مطبخ أو باريستا قبل التشغيل."
    },
    waiter_staff_ready: {
      label: "الويتر جاهز",
      ready: "يوجد ويتر مخصص للفرع.",
      pending: "أضف ويتر قبل التشغيل."
    },
    menu_categories_ready: {
      label: "أقسام المنيو جاهزة",
      ready: "يوجد أقسام منيو نشطة.",
      pending: "أضف أقسام منيو نشطة."
    },
    menu_items_ready: {
      label: "منتجات المنيو النشطة جاهزة",
      ready: "يوجد منتجات نشطة ومتاحة داخل الفرع.",
      pending: "أضف منتجات نشطة ومتاحة قبل استقبال الطلبات."
    },
    modifiers_ready: {
      label: "هيكل الإضافات متراجع",
      ready: "مجموعات الإضافات مرتبطة بالمنتجات.",
      pending: "راجع الإضافات وربطها بالمنتجات قبل تشغيل منيو يعتمد عليها."
    },
    ai_waiter_menu_grounding_ready: {
      label: "منيو AI Waiter جاهزة",
      ready: "المنيو تحتوي منتجات متاحة ومسعرة كفاية للاقتراحات.",
      pending: "AI Waiter يحتاج منتجات متاحة ومسعرة كفاية داخل الفرع."
    },
    inventory_foundation_ready: {
      label: "أساس المخزون جاهز",
      ready: "عناصر المخزون وأرصدة الفرع موجودة.",
      pending: "أضف عناصر المخزون والأرصدة الافتتاحية للفرع."
    },
    saas_subscription_active: {
      label: "اشتراك الخطة نشط",
      ready: "اشتراك الشركة لا يحتوي مانع تشغيل.",
      pending: "راجع خطة الشركة وحالة الاشتراك قبل اكتمال التجهيز."
    },
    saas_setup_enabled: {
      label: "صلاحية Setup مفعلة",
      ready: "الخطة الحالية تشمل أدوات تجهيز الفرع.",
      pending: "الخطة الحالية لا تتيح أدوات Setup."
    },
    saas_limits_within_plan: {
      label: "الاستخدام داخل حدود الخطة",
      ready: "استخدام الشركة داخل حدود الخطة الحالية.",
      pending: "راجع حدود الخطة والاستخدام قبل استكمال التجهيز."
    },
    cashier_shift_ready: {
      label: "شِفت الكاشير قابل للفتح",
      ready: "دور الكاشير والترابيزات النشطة جاهزان لبدء الشِفت.",
      pending: "جهّز الكاشير والترابيزات قبل بدء الشِفت."
    },
    printer_foundation_ready: {
      label: "مسار الطباعة البرمجي جاهز",
      ready: "محطات الطباعة مهيأة لمسار السوفتوير؛ نجاح الطابعة الفعلية غير مُثبت هنا.",
      pending: "جهّز مسار الطباعة البرمجي قبل اختبار هاردوير المكان."
    },
    physical_printer_hardware_ready: {
      label: "اختبار الطابعة الفعلية",
      ready: "تم التحقق من الطابعة الفعلية.",
      pending: "توصيل الطابعة والكابلات ونجاح النقل الفعلي يحتاج تحققًا داخل المكان."
    },
    bills_payment_ready: {
      label: "رحلة الفاتورة والدفع اليدوي جاهزة",
      ready: "عرض الفاتورة وتسجيل الدفع اليدوي متاحان.",
      pending: "أكمل متطلبات الكاشير قبل تسليم رحلة الفاتورة والدفع."
    },
    online_payment_provider_ready: {
      label: "اعتماد الدفع الإلكتروني الحي",
      ready: "تم التحقق من اعتماد مزود الدفع الحي.",
      pending: "اختيار المزود في السوفتوير لا يثبت اعتماد التاجر؛ التحقق الخارجي ما زال مطلوبًا."
    },
    kds_ready: {
      label: "نظام KDS جاهز",
      ready: "فريق المطبخ يمكنه تشغيل المهام والتذاكر.",
      pending: "أضف مطبخًا أو باريستا قبل تشغيل KDS."
    },
    analytics_ready: {
      label: "تحليلات المالك جاهزة",
      ready: "يوجد وصول مالك أو مدير لتحليلات الفرع.",
      pending: "أضف وصول مالك أو مدير قبل مراجعة التحليلات."
    }
  };

  const entry = copy[item.key];
  if (!entry) {
    return { label: item.label, reason: item.reason };
  }

  return {
    label: entry.label,
    reason: ready ? entry.ready : entry.pending
  };
}

function StatusPill({
  locale,
  status
}: {
  locale: "en" | "ar";
  status: TenantOnboardingReadinessStatus;
}) {
  const classes =
    status === "ready"
      ? "border-[#CAD7C9] bg-[#F0F6EF] text-[#365B3B]"
      : status === "blocked"
        ? "border-[#E0C5C1] bg-[#FAEEEE] text-[#8B4038]"
        : "border-[#E4D2AF] bg-[#FFF8EB] text-[#79561D]";

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}
    >
      {statusLabel(locale, status)}
    </span>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
  footer
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className={panelClass}>
      <div className="border-b border-[#E9E3DB] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B765F]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#2D2823]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#766B61]">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="p-5">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap gap-2 border-t border-[#E9E3DB] px-5 py-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#74685D]">
      {label}
      {children}
    </label>
  );
}

function ReadinessRows({
  locale,
  items
}: {
  locale: "en" | "ar";
  items: TenantOnboardingChecklistItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[#766B61]">
        {L(locale, "No readiness signal is available yet.", "لا توجد إشارة جاهزية متاحة بعد.")}
      </p>
    );
  }

  return (
    <div className="divide-y divide-[#EEE8E0]">
      {items.map((item) => {
        const copy = readinessText(locale, item);

        return (
          <div
            key={item.key}
            className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="flex gap-3">
              {item.status === "ready" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#365B3B]" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9A6928]" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-semibold text-[#302A25]">{copy.label}</p>
                <p className="mt-1 text-xs leading-5 text-[#80756B]">{copy.reason}</p>
              </div>
            </div>
            <StatusPill locale={locale} status={item.status} />
          </div>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#DDD6CD] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#81756B]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2D2823]">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-[#81766C]">{detail}</p>
    </div>
  );
}

function phaseItems(
  checklist: TenantOnboardingChecklistItem[],
  keys: string[]
) {
  return keys
    .map((key) => checklist.find((item) => item.key === key))
    .filter((item): item is TenantOnboardingChecklistItem => Boolean(item));
}

function getRoleLabel(locale: "en" | "ar", role: string) {
  const labels: Record<string, [string, string]> = {
    owner: ["Owner", "مالك"],
    branch_manager: ["Branch manager", "مدير فرع"],
    cashier: ["Cashier", "كاشير"],
    waiter: ["Waiter", "ويتر"],
    kitchen: ["Kitchen", "مطبخ"],
    barista: ["Barista", "باريستا"],
    menu_admin: ["Menu admin", "مسؤول منيو"]
  };

  const label = labels[role] ?? [role, role];
  return L(locale, label[0], label[1]);
}

function StaffSetupContent() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore((state) => state.setSelectedBranchId);

  const selectedAccessBranch = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedCompanyId =
    selectedAccessBranch?.company.id ??
    effectiveAccess?.branches[0]?.company.id ??
    effectiveAccess?.companies[0]?.company.id;

  const canManageCompany = hasCompanyStaffPermission(
    effectiveAccess,
    "tenant_onboarding.manage",
    selectedCompanyId
  );
  const canManageBranch = hasStaffPermission(
    effectiveAccess,
    "tenant_onboarding.manage",
    selectedBranchId
  );
  const canInviteStaff = hasStaffPermission(
    effectiveAccess,
    "staff.manage",
    selectedBranchId
  );

  const companyQuery = useQuery({
    queryKey: staffQueryKeys.companyOnboarding(selectedCompanyId),
    queryFn: () => getCompanyOnboarding(selectedCompanyId ?? "", accessToken),
    enabled: Boolean(
      accessToken &&
      selectedCompanyId &&
      effectiveAccess?.branches.length === 0
    ),
    staleTime: 30_000
  });
  const branchQuery = useQuery({
    queryKey: staffQueryKeys.branchOnboarding(selectedBranchId),
    queryFn: () => getBranchOnboarding(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const checklistQuery = useQuery({
    queryKey: staffQueryKeys.branchLaunchChecklist(selectedBranchId),
    queryFn: () => getBranchLaunchChecklist(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const paymentIntegrationsQuery = useQuery({
    queryKey: ["staff", "merchant-payment-integrations", selectedBranchId],
    queryFn: () =>
      getMerchantPaymentIntegrations(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000,
    retry: false
  });

  const onboarding = branchQuery.data;
  const launchSummary = checklistQuery.data?.launchSummary ?? onboarding?.launchSummary;

  const [companyDraft, setCompanyDraft] = useState<Partial<{
    name: string;
    slug: string;
    status: string;
  }>>({});
  const [branchDraft, setBranchDraft] = useState<Partial<{
    name: string;
    slug: string;
    address: string;
    status: string;
  }>>({});
  const [staffForm, setStaffForm] = useState<InviteOnboardingStaffPayload>({
    name: "",
    email: "",
    role: "cashier"
  });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const companyForm = {
    name: onboarding?.company.name ?? "",
    slug: onboarding?.company.slug ?? "",
    status: onboarding?.company.status === "inactive" ? "inactive" : "active",
    ...companyDraft
  };
  const branchForm = {
    name: onboarding?.branch.name ?? "",
    slug: onboarding?.branch.slug ?? "",
    address: onboarding?.branch.address ?? "",
    status: onboarding?.branch.status === "inactive" ? "inactive" : "active",
    ...branchDraft
  };

  function refresh() {
    if (selectedCompanyId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.companyOnboarding(selectedCompanyId)
      });
    }
    if (selectedBranchId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOnboarding(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchLaunchChecklist(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: ["staff", "merchant-payment-integrations", selectedBranchId]
      });
    }
    void queryClient.invalidateQueries({ queryKey: staffQueryKeys.me() });
  }

  const companyMutation = useMutation({
    mutationFn: () =>
      updateCompanyOnboardingProfile(
        selectedCompanyId ?? "",
        {
          name: companyForm.name,
          slug: companyForm.slug,
          status: companyForm.status as "active" | "inactive"
        },
        accessToken
      ),
    onSuccess: refresh
  });
  const branchMutation = useMutation({
    mutationFn: () =>
      updateBranchOnboardingProfile(
        selectedBranchId ?? "",
        {
          name: branchForm.name,
          slug: branchForm.slug,
          address: branchForm.address || null,
          status: branchForm.status as "active" | "inactive"
        },
        accessToken
      ),
    onSuccess: refresh
  });
  const staffMutation = useMutation({
    mutationFn: () =>
      inviteOnboardingStaff(selectedBranchId ?? "", staffForm, accessToken),
    onSuccess: (result) => {
      setLastInviteUrl(
        typeof window === "undefined"
          ? result.invitePath
          : new URL(result.invitePath, window.location.origin).toString()
      );
      setStaffForm({ name: "", email: "", role: "cashier" });
      setCopied(false);
      refresh();
    }
  });
  const mutationError =
    companyMutation.error ??
    branchMutation.error ??
    staffMutation.error;

  const roleCounts = useMemo(() => onboarding?.staff.roleCounts ?? {}, [onboarding]);
  const staffRoles: TenantOnboardingStaffRole[] = [
    "owner",
    "branch_manager",
    "cashier",
    "waiter",
    "kitchen",
    "barista",
    "menu_admin"
  ];

  if (effectiveAccess?.branches.length === 0) {
    if (companyQuery.isPending) {
      return <LoadingState label={L(locale, "Loading Setup Home", "جارٍ تحميل الرئيسية")} />;
    }

    if (companyQuery.isError || !companyQuery.data) {
      return (
        <EmptyState
          title={L(locale, "Setup Home could not load", "تعذر تحميل الرئيسية")}
          description={formatErrorMessage(companyQuery.error)}
        />
      );
    }

    const companySetup = companyQuery.data;
    const companyChecklist = companySetup.sections.flatMap((section) => section.items);
    const nextItem = companyChecklist.find((item) => item.status !== "ready");

    return (
      <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#F4F0EA] text-[#2B2520]">
        <header className="border-b border-[#D8D1C8] bg-[#F8F5F0]">
          <div className="mx-auto flex min-h-16 max-w-[1100px] items-center gap-3 px-4 sm:px-6">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#2D2823] text-xs font-black text-white">B</div>
            <div>
              <p className="text-sm font-semibold">Balcona Setup</p>
              <p className="text-[10px] text-[#82776D]">{L(locale, "Setup Home · company readiness", "الرئيسية · جاهزية الشركة")}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto grid max-w-[1100px] gap-4 px-4 py-6 sm:px-6">
          <Panel
            eyebrow={L(locale, "SETUP HOME", "الرئيسية")}
            title={L(locale, "Create the first operating location.", "أنشئ أول فرع للتشغيل.")}
            description={L(
              locale,
              "Company readiness is available before a branch exists. Setup will become branch-scoped after the first location is created.",
              "جاهزية الشركة متاحة قبل وجود فرع. بعد إنشاء أول فرع تتحول الرحلة إلى جاهزية تشغيل خاصة بالفرع."
            )}
            footer={
              <Link href="/office/locations" className={secondaryButtonClass}>
                {L(locale, "Create first location in Office", "أنشئ أول فرع في Office")}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <Metric label={L(locale, "Company", "الشركة")} value={companySetup.company.name} detail={L(locale, "Foundation exists", "الأساس موجود")} />
              <Metric label={L(locale, "Locations", "الفروع")} value={String(companySetup.branches.length)} detail={L(locale, "Create one to continue", "أنشئ فرعًا للمتابعة")} />
              <Metric label={L(locale, "Menu items", "منتجات المنيو")} value={String(companySetup.menu.activeItemCount)} detail={L(locale, "Company catalog truth", "بيانات كتالوج الشركة")} />
            </div>
            <ReadinessRows locale={locale} items={companyChecklist} />
          </Panel>
          <Panel
            eyebrow={L(locale, "RECOMMENDED NEXT ACTION", "الخطوة التالية")}
            title={nextItem ? readinessText(locale, nextItem).label : L(locale, "Company foundation is ready", "أساس الشركة جاهز")}
            description={nextItem ? readinessText(locale, nextItem).reason : L(locale, "Create the first location to continue the finite launch journey.", "أنشئ أول فرع لاستكمال رحلة التجهيز المحددة.")}
            footer={
              <Link href={nextItem?.actionHref ?? "/office/locations"} className={secondaryButtonClass}>
                {L(locale, "Continue in the owning surface", "تابع في الجزء المسؤول")}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  if (branchQuery.isPending) {
    return <LoadingState label={L(locale, "Loading Setup", "جارٍ تحميل Setup")} />;
  }

  if (branchQuery.isError || !onboarding) {
    return (
      <EmptyState
        title={L(locale, "Setup could not load", "تعذر تحميل Setup")}
        description={formatErrorMessage(branchQuery.error)}
      />
    );
  }

  const setup = onboarding;
  const checklist = checklistQuery.data?.launchChecklist ?? setup.launchChecklist;
  const unresolvedItems = checklist.filter((item) => item.status !== "ready");
  const nextItem = unresolvedItems[0];
  const readyCheckCount = checklist.length - unresolvedItems.length;
  const blockedCheckCount = checklist.filter((item) => item.status === "blocked").length;
  const attentionCheckCount = checklist.filter((item) => item.status === "needs_attention" || item.status === "missing").length;

  function actionHrefFor(item?: TenantOnboardingChecklistItem) {
    if (!item) return "/setup#final";
    if (item.actionHref && item.actionHref !== "/setup") return item.actionHref;

    const setupPhaseByKey: Record<string, SetupPhaseId> = {
      company_profile: "business",
      branch_profile: "business",
      floors_created: "locations",
      tables_created: "locations",
      qr_links_ready: "locations",
      owner_staff_ready: "team",
      cashier_staff_ready: "team",
      kitchen_staff_ready: "team",
      waiter_staff_ready: "team"
    };

    return `/setup#${setupPhaseByKey[item.key] ?? "final"}`;
  }

  function linkButton(href: string, label: string) {
    return (
      <Link href={href} className={secondaryButtonClass}>
        {label}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    );
  }

  function renderPhase(phase: SetupPhaseId) {
    if (phase === "home") {
      return (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            eyebrow={L(locale, "SETUP HOME", "الرئيسية")}
            title={
              launchSummary?.readyForPilot
                ? unresolvedItems.length > 0
                  ? L(locale, "Software pilot ready — go-live gates remain.", "الـPilot البرمجي جاهز — ما زالت بوابات التشغيل الحي.")
                  : L(locale, "Ready for final go-live rehearsal.", "جاهز لتجربة التشغيل النهائية.")
                : launchSummary?.readyForDemo
                  ? L(locale, "Demo ready — continue launch readiness.", "جاهز للديمو — أكمل جاهزية التشغيل.")
                  : L(locale, "Continue the highest-impact readiness work.", "كمّل أهم خطوة ناقصة في الجاهزية.")
            }
            description={L(
              locale,
              "This is a finite launch project. Readiness comes from persisted product records; the last viewed step is only a resume preference on this device.",
              "دي رحلة تجهيز محددة. الجاهزية محسوبة من سجلات المنتج المحفوظة؛ آخر خطوة مفتوحة مجرد تفضيل Resume على الجهاز."
            )}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label={L(locale, "Live checks ready", "فحوص جاهزة")}
                value={`${readyCheckCount}/${checklist.length}`}
                detail={L(locale, "Backend-derived", "محسوبة من الـbackend")}
              />
              <Metric
                label={L(locale, "Needs attention", "يحتاج انتباه")}
                value={String(attentionCheckCount)}
                detail={L(locale, "Recommended work", "شغل موصى به")}
              />
              <Metric
                label={L(locale, "Blocked", "متوقف")}
                value={String(blockedCheckCount)}
                detail={L(locale, "Explicit gates", "بوابات صريحة")}
              />
            </div>
          </Panel>

          <Panel
            eyebrow={L(locale, "RECOMMENDED NEXT ACTION", "الخطوة التالية")}
            title={
              nextItem
                ? readinessText(locale, nextItem).label
                : L(locale, "All current readiness checks are satisfied.", "كل فحوص الجاهزية الحالية مكتملة.")
            }
            description={
              nextItem
                ? readinessText(locale, nextItem).reason
                : L(locale, "Move to final rehearsal and operational handoff.", "انتقل للتجربة النهائية وتسليم التشغيل.")
            }
            footer={linkButton(
              nextItem ? actionHrefFor(nextItem) : "/setup#final",
              nextItem
                ? L(locale, "Continue recommended action", "كمّل الخطوة المقترحة")
                : L(locale, "Open final readiness", "افتح الجاهزية النهائية")
            )}
          >
            {nextItem ? (
              <ReadinessRows locale={locale} items={[nextItem]} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-[#365B3B]">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {L(locale, "No unresolved readiness signal remains.", "لا توجد إشارة جاهزية غير محسومة.")}
              </div>
            )}
          </Panel>
        </div>
      );
    }

    if (phase === "business") {
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            eyebrow={L(locale, "FOUNDATION", "الأساس")}
            title={L(locale, "Business identity", "هوية الشركة")}
            description={L(
              locale,
              "Company identity is owner-controlled and feeds every operating surface.",
              "هوية الشركة يتحكم فيها المالك وتغذي كل أسطح التشغيل."
            )}
          >
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                companyMutation.mutate();
              }}
            >
              <Field label={L(locale, "Company name", "اسم الشركة")}>
                <input
                  className={inputClass}
                  value={companyForm.name}
                  disabled={!canManageCompany}
                  onChange={(event) =>
                    setCompanyDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Slug">
                  <input
                    className={inputClass}
                    value={companyForm.slug}
                    disabled={!canManageCompany}
                    onChange={(event) =>
                      setCompanyDraft((current) => ({ ...current, slug: event.target.value }))
                    }
                  />
                </Field>
                <Field label={L(locale, "Status", "الحالة")}>
                  <select
                    className={inputClass}
                    value={companyForm.status}
                    disabled={!canManageCompany}
                    onChange={(event) =>
                      setCompanyDraft((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="active">{L(locale, "Active", "نشط")}</option>
                    <option value="inactive">{L(locale, "Inactive", "غير نشط")}</option>
                  </select>
                </Field>
              </div>
              <button className={primaryButtonClass} disabled={!canManageCompany || companyMutation.isPending}>
                {companyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {L(locale, "Save company", "حفظ الشركة")}
              </button>
            </form>
          </Panel>

          <Panel
            eyebrow={L(locale, "LOCATION", "الفرع")}
            title={setup.branch.name}
            description={L(
              locale,
              "The selected branch is the operating context for QR, staff and readiness.",
              "الفرع المحدد هو سياق تشغيل QR والفريق والجاهزية."
            )}
          >
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                branchMutation.mutate();
              }}
            >
              <Field label={L(locale, "Branch name", "اسم الفرع")}>
                <input
                  className={inputClass}
                  value={branchForm.name}
                  disabled={!canManageBranch}
                  onChange={(event) =>
                    setBranchDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field label={L(locale, "Address", "العنوان")}>
                <input
                  className={inputClass}
                  value={branchForm.address}
                  disabled={!canManageBranch}
                  onChange={(event) =>
                    setBranchDraft((current) => ({ ...current, address: event.target.value }))
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Slug">
                  <input
                    className={inputClass}
                    value={branchForm.slug}
                    disabled={!canManageBranch}
                    onChange={(event) =>
                      setBranchDraft((current) => ({ ...current, slug: event.target.value }))
                    }
                  />
                </Field>
                <Field label={L(locale, "Status", "الحالة")}>
                  <select
                    className={inputClass}
                    value={branchForm.status}
                    disabled={!canManageBranch}
                    onChange={(event) =>
                      setBranchDraft((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="active">{L(locale, "Active", "نشط")}</option>
                    <option value="inactive">{L(locale, "Inactive", "غير نشط")}</option>
                  </select>
                </Field>
              </div>
              <button className={primaryButtonClass} disabled={!canManageBranch || branchMutation.isPending}>
                {branchMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {L(locale, "Save branch", "حفظ الفرع")}
              </button>
            </form>
          </Panel>
        </div>
      );
    }

    if (phase === "locations") {
      const items = phaseItems(checklist, [
        "floors_created",
        "tables_created",
        "qr_links_ready"
      ]);
      return (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={L(locale, "Floors / areas", "الأدوار / المناطق")}
              value={String(setup.tables.floorCount)}
              detail={L(locale, "Real branch structure", "هيكل الفرع الحقيقي")}
            />
            <Metric
              label={L(locale, "Active tables", "الترابيزات النشطة")}
              value={String(setup.tables.activeTableCount)}
              detail={L(locale, "Across this branch", "داخل هذا الفرع")}
            />
            <Metric
              label={L(locale, "QR ready", "QR جاهز")}
              value={`${setup.tables.qrReadyTableCount}/${setup.tables.activeTableCount}`}
              detail={L(locale, "Customer entry readiness", "جاهزية دخول العميل")}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel
              eyebrow={L(locale, "LOCATIONS / TABLES / QR", "الفروع / الترابيزات / QR")}
              title={L(locale, "Verify the service map, then manage it in Office.", "راجع خريطة الخدمة ثم أدِرها من Office.")}
              description={L(
                locale,
                "Setup owns readiness and handoff. Ongoing floor, table, and QR administration belongs to the Locations surface.",
                "Setup مسؤول عن الجاهزية والتسليم. الإدارة المستمرة للأدوار والترابيزات وQR مكانها Locations."
              )}
              footer={linkButton("/office/locations", L(locale, "Open Locations in Office", "افتح Locations في Office"))}
            >
              <ReadinessRows locale={locale} items={items} />
            </Panel>

            <Panel
              eyebrow={L(locale, "QR ENTRY PROOF", "إثبات دخول QR")}
              title={L(locale, "Recent customer entry links", "أحدث روابط دخول العملاء")}
              footer={linkButton("/office/locations", L(locale, "Manage Tables & QR in Office", "إدارة الترابيزات وQR في Office"))}
            >
              <div className="grid gap-2">
                {setup.tables.recentTables.slice(0, 8).map((table) => (
                  <div key={table.id} className="grid gap-2 rounded-lg border border-[#DDD6CD] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{table.displayName}</p>
                      <p className="truncate text-[11px] text-[#81766C]">{table.qrToken ?? L(locale, "QR pending", "QR غير جاهز")}</p>
                    </div>
                    {table.customerPreviewPath ? (
                      <Link href={table.customerPreviewPath} className={secondaryButtonClass}>
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {L(locale, "Open guest entry", "افتح دخول الضيف")}
                      </Link>
                    ) : null}
                  </div>
                ))}
                {setup.tables.recentTables.length === 0 ? (
                  <p className="text-sm text-[#766B61]">
                    {L(locale, "No customer table entry exists yet.", "لا يوجد دخول عميل عبر ترابيزة حتى الآن.")}
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      );
    }

    if (phase === "menu") {
      const items = phaseItems(checklist, [
        "menu_categories_ready",
        "menu_items_ready",
        "modifiers_ready",
        "ai_waiter_menu_grounding_ready",
        "inventory_foundation_ready"
      ]);
      return (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label={L(locale, "Categories", "الأقسام")} value={String(setup.menu.activeCategoryCount)} detail={L(locale, "Active", "نشطة")} />
            <Metric label={L(locale, "Available items", "المنتجات المتاحة")} value={String(setup.menu.availableItemCount)} detail={`${setup.menu.activeItemCount} ${L(locale, "active", "نشط")}`} />
            <Metric label={L(locale, "Modifier groups", "مجموعات الإضافات")} value={String(setup.menu.activeModifierGroupCount)} detail={L(locale, "Active groups", "مجموعات نشطة")} />
            <Metric label={L(locale, "Inventory tracked", "مخزون متتبع")} value={String(setup.menu.trackedInventoryLevelCount ?? 0)} detail={L(locale, "Branch stock levels", "أرصدة مخزون الفرع")} />
          </div>
          <Panel
            eyebrow={L(locale, "CATALOG READINESS", "جاهزية المنيو")}
            title={L(locale, "Menu readiness is computed from live catalog truth.", "جاهزية المنيو محسوبة من بيانات الكتالوج الحقيقية.")}
            footer={linkButton("/office/catalog", L(locale, "Open Catalog in Office", "افتح الكتالوج في Office"))}
          >
            <ReadinessRows locale={locale} items={items} />
          </Panel>
        </div>
      );
    }

    if (phase === "team") {
      return (
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel
            eyebrow={L(locale, "ROLE COVERAGE", "تغطية الأدوار")}
            title={L(locale, "Launch team coverage", "تغطية فريق التشغيل")}
            description={L(
              locale,
              "Setup checks whether launch roles exist. Ongoing access administration belongs in Office.",
              "Setup يتأكد من وجود أدوار التشغيل. الإدارة المستمرة للصلاحيات مكانها Office."
            )}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {staffRoles.map((role) => (
                <div key={role} className="rounded-lg border border-[#DDD6CD] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#81756B]">
                    {getRoleLabel(locale, role)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {roleCounts[role] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow={L(locale, "STAFF HANDOFF", "تسليم الفريق")}
            title={L(locale, "Invite an operator", "ادعُ موظف تشغيل")}
          >
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                staffMutation.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={L(locale, "Name", "الاسم")}>
                  <input className={inputClass} value={staffForm.name} disabled={!canInviteStaff} onChange={(event) => setStaffForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label={L(locale, "Email", "الإيميل")}>
                  <input className={inputClass} type="email" value={staffForm.email} disabled={!canInviteStaff} onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))} />
                </Field>
              </div>
              <Field label={L(locale, "Role", "الدور")}>
                <select className={inputClass} value={staffForm.role} disabled={!canInviteStaff} onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value as TenantOnboardingStaffRole }))}>
                  {staffRoles.map((role) => (
                    <option key={role} value={role}>{getRoleLabel(locale, role)}</option>
                  ))}
                </select>
              </Field>
              <button className={primaryButtonClass} disabled={!canInviteStaff || staffMutation.isPending || !staffForm.name.trim() || !staffForm.email.trim()}>
                {staffMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {L(locale, "Create invite", "أنشئ دعوة")}
              </button>
            </form>

            {lastInviteUrl ? (
              <div className="mt-4 rounded-lg border border-[#DDD6CD] bg-white p-3">
                <p className="break-all text-xs text-[#766B61]">{lastInviteUrl}</p>
                <button
                  type="button"
                  className={secondaryButtonClass + " mt-3"}
                  onClick={async () => {
                    await navigator.clipboard.writeText(lastInviteUrl);
                    setCopied(true);
                  }}
                >
                  <Copy className="size-4" />
                  {copied ? L(locale, "Copied", "تم النسخ") : L(locale, "Copy invite", "انسخ الدعوة")}
                </button>
              </div>
            ) : null}
          </Panel>
        </div>
      );
    }

    if (phase === "kitchen") {
      const items = phaseItems(checklist, [
        "kds_ready",
        "printer_foundation_ready",
        "physical_printer_hardware_ready"
      ]);
      return (
        <Panel
          eyebrow={L(locale, "PRODUCTION READINESS", "جاهزية الإنتاج")}
          title={L(locale, "KDS software is real; venue hardware stays explicit.", "سوفتوير KDS حقيقي؛ هاردوير المكان يظل بوابة واضحة.")}
          description={L(
            locale,
            "Printer station records and software lifecycle are not presented as physical printer transport.",
            "محطات الطباعة ودورة السوفتوير لا يتم تقديمها كأنها ربط بطابعة فعلية."
          )}
          footer={linkButton("/kitchen", L(locale, "Open Kitchen", "افتح المطبخ"))}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Metric label={L(locale, "Printer stations", "محطات الطباعة")} value={String(setup.operations.printerStationCount)} detail={L(locale, "Configured", "مجهزة")} />
            <Metric label={L(locale, "Active stations", "المحطات النشطة")} value={String(setup.operations.activePrinterStationCount)} detail={L(locale, "Software-side readiness", "جاهزية جانب السوفتوير")} />
          </div>
          <ReadinessRows locale={locale} items={items} />
        </Panel>
      );
    }

    if (phase === "payments") {
      const items = phaseItems(checklist, [
        "bills_payment_ready",
        "online_payment_provider_ready"
      ]);
      const integrations = paymentIntegrationsQuery.data?.integrations ?? [];
      const activeIntegration =
        integrations.find(
          (integration) =>
            integration.status === "ready" && integration.environment === "live"
        ) ??
        integrations.find((integration) => integration.status === "ready") ??
        integrations[0];
      const liveVerified = Boolean(activeIntegration?.liveVerifiedAt);

      return (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            eyebrow={L(locale, "PAYMENT READINESS", "جاهزية الدفع")}
            title={L(locale, "Payment readiness without fake activation.", "جاهزية الدفع بدون ادعاء تفعيل غير حقيقي.")}
            description={L(
              locale,
              "Setup shows the real merchant/provider state for this branch. Manual collection can be software-ready while live online acceptance remains externally blocked.",
              "Setup يعرض حالة التاجر ومزود الدفع الحقيقية للفرع. التحصيل اليدوي قد يكون جاهزًا برمجيًا بينما يظل قبول الدفع الأونلاين الحي متوقفًا على بوابة خارجية."
            )}
            footer={
              <div className="flex flex-wrap gap-2">
                {linkButton("/office/money", L(locale, "Configure in Office Money", "اضبط الدفع في Office Money"))}
                {linkButton("/service/cashier#bills", L(locale, "Open Bills in Service", "افتح الحسابات في Service"))}
              </div>
            }
          >
            <ReadinessRows locale={locale} items={items} />
          </Panel>

          <Panel
            eyebrow={L(locale, "MERCHANT CONNECTION", "ربط التاجر")}
            title={
              activeIntegration
                ? `${activeIntegration.provider.toUpperCase()} · ${activeIntegration.environment}`
                : L(locale, "No merchant integration configured", "لا يوجد ربط تاجر مُجهز")
            }
            description={
              paymentIntegrationsQuery.isPending
                ? L(locale, "Checking the effective provider for this branch.", "جارٍ فحص مزود الدفع الفعلي لهذا الفرع.")
                : paymentIntegrationsQuery.isError
                  ? L(locale, "Merchant readiness could not be loaded. Office Money remains the owning configuration surface.", "تعذر تحميل جاهزية التاجر. يظل Office Money هو سطح الإعداد المسؤول.")
                  : activeIntegration
                    ? activeIntegration.readinessMessage ??
                      L(locale, "Provider configuration is persisted without exposing runtime secrets.", "إعداد المزود محفوظ بدون إظهار أسرار التشغيل.")
                    : L(locale, "Configure a company-level provider or a branch override before enabling online checkout.", "جهز مزودًا على مستوى الشركة أو Override للفرع قبل تفعيل الدفع الأونلاين.")
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label={L(locale, "Connection", "الاتصال")}
                value={
                  activeIntegration
                    ? statusLabel(
                        locale,
                        activeIntegration.status === "ready"
                          ? "ready"
                          : activeIntegration.status === "blocked"
                            ? "blocked"
                            : "needs_attention"
                      )
                    : L(locale, "Needs setup", "يحتاج إعداد")
                }
                detail={activeIntegration?.merchantAccountReference ?? L(locale, "No merchant reference", "لا يوجد مرجع تاجر")}
              />
              <Metric
                label={L(locale, "Live verification", "التحقق الحي")}
                value={liveVerified ? L(locale, "Verified", "تم التحقق") : L(locale, "Not verified", "غير متحقق")}
                detail={
                  activeIntegration?.environment === "live"
                    ? L(locale, "Real-money evidence is still required until verified.", "يلزم إثبات معاملة حقيقية حتى يتم التحقق.")
                    : L(locale, "Sandbox/test configuration does not certify live payments.", "إعداد Sandbox/Test لا يثبت الدفع الحي.")
                }
              />
              <Metric
                label={L(locale, "Webhook", "Webhook")}
                value={activeIntegration?.webhookConfigured ? L(locale, "Configured", "مُجهز") : L(locale, "Not configured", "غير مُجهز")}
                detail={
                  activeIntegration?.webhookVerifiedAt
                    ? L(locale, "Verified callback evidence present", "يوجد إثبات Callback متحقق")
                    : L(locale, "No verified callback evidence yet", "لا يوجد إثبات Callback متحقق بعد")
                }
              />
              <Metric
                label={L(locale, "Recovery / settlement", "الاسترجاع / التسوية")}
                value={
                  activeIntegration?.recoveryReady && activeIntegration?.settlementConfigured
                    ? L(locale, "Ready", "جاهز")
                    : L(locale, "Needs attention", "يحتاج انتباه")
                }
                detail={L(
                  locale,
                  `Recovery ${activeIntegration?.recoveryReady ? "ready" : "pending"} · Settlement ${activeIntegration?.settlementConfigured ? "ready" : "pending"}`,
                  `الاسترجاع ${activeIntegration?.recoveryReady ? "جاهز" : "معلق"} · التسوية ${activeIntegration?.settlementConfigured ? "جاهزة" : "معلقة"}`
                )}
              />
            </div>
          </Panel>
        </div>
      );
    }

    if (phase === "experience") {
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            label={L(locale, "AI grounding", "جاهزية AI")}
            value={setup.menu.aiWaiterMenuGroundingReady ? L(locale, "Ready", "جاهز") : L(locale, "Attention", "يحتاج مراجعة")}
            detail={L(locale, "Based on live menu truth", "مبني على بيانات المنيو الحقيقية")}
          />
          <Metric
            label={L(locale, "Operating profile", "إعدادات التشغيل")}
            value={setup.operations.operatingSettings ? L(locale, "Configured", "مجهزة") : L(locale, "Missing", "ناقصة")}
            detail={L(locale, "Branch operating settings", "إعدادات تشغيل الفرع")}
          />
          <Metric
            label={L(locale, "Feature flags", "خصائص الفرع")}
            value={String(Object.values(setup.operations.featureFlags).filter(Boolean).length)}
            detail={L(locale, "Enabled capabilities", "خصائص مفعلة")}
          />
          <div className="sm:col-span-3">
            <Panel
              eyebrow={L(locale, "EXPERIENCE HANDOFF", "تسليم التجربة")}
              title={L(locale, "Setup verifies experience readiness; Office owns ongoing tuning.", "Setup يتحقق من جاهزية التجربة؛ Office يدير التعديل المستمر.")}
              footer={linkButton("/office#experience", L(locale, "Open Experience in Office", "افتح Experience في Office"))}
            />
          </div>
        </div>
      );
    }

    if (phase === "operations") {
      const items = phaseItems(checklist, [
        "cashier_shift_ready",
        "kds_ready",
        "analytics_ready"
      ]);
      return (
        <Panel
          eyebrow={L(locale, "OPERATING REHEARSAL", "تجربة التشغيل")}
          title={L(locale, "Operational foundations are checked before handoff.", "أساسات التشغيل يتم فحصها قبل التسليم.")}
          footer={linkButton("/office#operations", L(locale, "Open Operations in Office", "افتح Operations في Office"))}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Metric
              label={L(locale, "Cashier shift", "شِفت الكاشير")}
              value={setup.operations.currentOpenShift ? L(locale, "Open", "مفتوح") : setup.operations.cashierShiftCanOpen ? L(locale, "Can open", "يمكن فتحه") : L(locale, "Blocked", "متوقف")}
              detail={L(locale, "Live branch signal", "إشارة حقيقية من الفرع")}
            />
            <Metric
              label="KDS"
              value={(roleCounts.kitchen ?? 0) + (roleCounts.barista ?? 0) > 0 ? L(locale, "Covered", "مغطى") : L(locale, "Missing role", "دور ناقص")}
              detail={L(locale, "Kitchen/barista coverage", "تغطية المطبخ/الباريستا")}
            />
            <Metric
              label={L(locale, "Analytics", "التحليلات")}
              value={(roleCounts.owner ?? 0) + (roleCounts.branch_manager ?? 0) > 0 ? L(locale, "Accessible", "متاحة") : L(locale, "No owner access", "لا يوجد وصول مالك")}
              detail={L(locale, "Owner-level branch visibility", "رؤية الفرع للمالك")}
            />
          </div>
          <ReadinessRows locale={locale} items={items} />
        </Panel>
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          eyebrow={L(locale, "FINAL READINESS / GO LIVE", "الجاهزية النهائية / التشغيل")}
          title={
            launchSummary?.readyForPilot
              ? unresolvedItems.length > 0
                ? L(locale, "Software pilot ready — live gates remain", "الـPilot البرمجي جاهز — ما زالت بوابات التشغيل الحي")
                : L(locale, "Ready for final go-live rehearsal", "جاهز لتجربة التشغيل النهائية")
              : launchSummary?.readyForDemo
                ? L(locale, "Demo ready — pilot gates remain", "جاهز للديمو — ما زالت بوابات Pilot")
                : L(locale, "Launch blockers remain", "ما زالت هناك عوائق تشغيل")
          }
          description={L(
            locale,
            "This result is computed from backend records. Provider certification and physical device success stay explicit until externally verified.",
            "النتيجة محسوبة من سجلات الـbackend. اعتماد مزود الدفع ونجاح الأجهزة الفعلية يظلان واضحين حتى يتم التحقق خارجيًا."
          )}
        >
          <ReadinessRows locale={locale} items={checklist} />
        </Panel>

        <div className="grid content-start gap-4">
          <Panel
            eyebrow={L(locale, "GO / NO-GO", "قرار التشغيل")}
            title={
              launchSummary?.readyForPilot
                ? L(locale, "Pilot path is available", "مسار الـPilot متاح")
                : launchSummary?.readyForDemo
                  ? L(locale, "Demo path is available", "مسار الديمو متاح")
                  : L(locale, "Critical setup is blocked", "التجهيز الحرج متوقف")
            }
          >
            <div className="grid gap-3">
              <Metric
                label={L(locale, "Critical checks", "الفحوص الحرجة")}
                value={launchSummary ? `${launchSummary.totalCriticalCount - launchSummary.missingCriticalCount}/${launchSummary.totalCriticalCount}` : "—"}
                detail={L(locale, "Computed by onboarding service", "محسوبة من خدمة onboarding")}
              />
              {launchSummary?.blockedReasons.map((item) => (
                <div key={item.key} className="rounded-lg border border-[#E0C5C1] bg-[#FAEEEE] p-4">
                  <p className="text-sm font-semibold text-[#7A3A34]">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#815B57]">{item.reason}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow={L(locale, "NEXT HANDOFF", "التسليم التالي")}
            title={
              nextItem
                ? readinessText(locale, nextItem).label
                : L(locale, "Hand off to live operations", "سلّم للتشغيل الحي")
            }
            description={
              nextItem
                ? readinessText(locale, nextItem).reason
                : L(locale, "All current readiness signals are satisfied. Run the final service rehearsal.", "كل إشارات الجاهزية الحالية مكتملة. شغّل تجربة الخدمة النهائية.")
            }
            footer={linkButton(
              nextItem ? actionHrefFor(nextItem) : "/service/cashier",
              nextItem
                ? L(locale, "Resolve next readiness gate", "اقفل بوابة الجاهزية التالية")
                : L(locale, "Open service rehearsal", "افتح تجربة الخدمة")
            )}
          >
            {nextItem ? (
              <ReadinessRows locale={locale} items={[nextItem]} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-[#365B3B]">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {L(locale, "No unresolved readiness signal remains.", "لا توجد إشارة جاهزية غير محسومة.")}
              </div>
            )}
          </Panel>
        </div>
      </div>
    );
  }

  const controls = (
    <>
      <select
        aria-label={L(locale, "Branch", "الفرع")}
        className="hidden min-h-10 max-w-56 rounded-md border border-[#D8D1C8] bg-white px-3 text-xs font-semibold text-[#4C433B] outline-none sm:block"
        value={selectedBranchId ?? ""}
        onChange={(event) => setSelectedBranchId(event.target.value)}
      >
        {effectiveAccess?.branches.map((entry) => (
          <option key={entry.branch.id} value={entry.branch.id}>
            {entry.branch.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={secondaryButtonClass}
        onClick={refresh}
        disabled={companyQuery.isFetching || branchQuery.isFetching || checklistQuery.isFetching}
      >
        <RefreshCw
          className={`size-4 ${companyQuery.isFetching || branchQuery.isFetching || checklistQuery.isFetching ? "animate-spin" : ""}`}
        />
        <span className="hidden sm:inline">{L(locale, "Refresh", "تحديث")}</span>
      </button>
    </>
  );

  return (
    <>
      {mutationError ? (
        <div className="mx-auto mb-3 max-w-[1500px] rounded-lg border border-[#E0C5C1] bg-[#FAEEEE] px-4 py-3 text-sm text-[#7A3A34]">
          {formatErrorMessage(mutationError)}
        </div>
      ) : null}
      <SetupReadinessFrame
        onboarding={setup}
        launchSummary={launchSummary}
        controls={controls}
      >
        {renderPhase}
      </SetupReadinessFrame>
    </>
  );
}

export function StaffSetupPage() {
  return (
    <StaffAuthGate
      requiredPermissions={["tenant_onboarding.read"]}
      branchScoped
      allowUnscopedWhenNoBranch
      deniedTitle="Tenant setup access required"
      deniedDescription="This staff account can open its operational surfaces, but tenant launch setup requires owner or branch manager access."
    >
      <StaffSetupContent />
    </StaffAuthGate>
  );
}
