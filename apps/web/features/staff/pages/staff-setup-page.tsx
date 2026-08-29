"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
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
  bulkCreateOnboardingTables,
  createOnboardingFloor,
  getBranchLaunchChecklist,
  getBranchOnboarding,
  inviteOnboardingStaff,
  updateBranchOnboardingProfile,
  updateCompanyOnboardingProfile,
  updateOnboardingReadinessCheck
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
      label: "أساس الطباعة جاهز",
      ready: "محطات الطباعة البرمجية مهيأة.",
      pending: "دورة الطباعة البرمجية جاهزة جزئيًا؛ النقل للطابعة الفعلية يظل بوابة مكان."
    },
    bills_payment_ready: {
      label: "رحلة الفاتورة والدفع اليدوي جاهزة",
      ready: "عرض الفاتورة وتسجيل الدفع اليدوي متاحان.",
      pending: "أكمل متطلبات الكاشير قبل تسليم رحلة الفاتورة والدفع."
    },
    online_payment_provider_ready: {
      label: "أساس مزود الدفع الإلكتروني",
      ready: "مزود الدفع الإلكتروني مهيأ خارج وضع المحاكاة.",
      pending: "تفعيل التاجر أو المزود الخارجي ما زال مطلوبًا."
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
  const [floorForm, setFloorForm] = useState({ name: "", sortOrder: "0" });
  const [tableForm, setTableForm] = useState({
    floorLabel: "Main Floor",
    tablePrefix: "T",
    startNumber: "1",
    count: "8",
    seats: "2"
  });
  const [staffForm, setStaffForm] = useState<InviteOnboardingStaffPayload>({
    name: "",
    email: "",
    role: "cashier"
  });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [acknowledgedMessage, setAcknowledgedMessage] = useState<string | null>(null);

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
    if (!selectedBranchId) return;

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOnboarding(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchLaunchChecklist(selectedBranchId)
    });
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
  const floorMutation = useMutation({
    mutationFn: () =>
      createOnboardingFloor(
        selectedBranchId ?? "",
        {
          name: floorForm.name,
          sortOrder: Number.parseInt(floorForm.sortOrder, 10) || 0
        },
        accessToken
      ),
    onSuccess: () => {
      setFloorForm({ name: "", sortOrder: "0" });
      refresh();
    }
  });
  const tablesMutation = useMutation({
    mutationFn: () =>
      bulkCreateOnboardingTables(
        selectedBranchId ?? "",
        {
          floorLabel: tableForm.floorLabel,
          tablePrefix: tableForm.tablePrefix,
          startNumber: Math.max(1, Number.parseInt(tableForm.startNumber, 10) || 1),
          count: Math.max(1, Number.parseInt(tableForm.count, 10) || 1),
          seats: Math.max(1, Number.parseInt(tableForm.seats, 10) || 2)
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
  const readinessMutation = useMutation({
    mutationFn: (item: TenantOnboardingChecklistItem) =>
      updateOnboardingReadinessCheck(
        selectedBranchId ?? "",
        {
          key: item.key,
          status: item.status === "blocked" ? "blocked" : "pending",
          note: item.reason
        },
        accessToken
      ),
    onSuccess: (result) => {
      setAcknowledgedMessage(result.message);
      refresh();
    }
  });

  const mutationError =
    companyMutation.error ??
    branchMutation.error ??
    floorMutation.error ??
    tablesMutation.error ??
    staffMutation.error ??
    readinessMutation.error;

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
    return (
      <EmptyState
        title={L(locale, "No branch access", "لا يوجد وصول لفرع")}
        description={L(
          locale,
          "Setup is branch-scoped. Add branch access before opening launch setup.",
          "التجهيز مرتبط بالفرع. أضف صلاحية فرع قبل فتح تجهيز التشغيل."
        )}
      />
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

  function linkButton(href: string, label: string) {
    return (
      <Link href={href} className={secondaryButtonClass}>
        {label}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    );
  }

  function renderPhase(phase: SetupPhaseId) {
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
          <Panel
            eyebrow={L(locale, "LOCATION STRUCTURE", "هيكل الفرع")}
            title={L(locale, "Configured floors and areas", "الأدوار والمناطق المجهزة")}
            footer={linkButton("/staff/branches", L(locale, "Open Locations in Office", "افتح الفروع في Office"))}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {setup.tables.floors.map((floor) => (
                <div key={floor.id} className="rounded-lg border border-[#DDD6CD] bg-white p-4">
                  <p className="font-semibold">{floor.name}</p>
                  <p className="mt-1 text-xs text-[#81766C]">
                    {L(locale, "Sort order", "الترتيب")} {floor.sortOrder}
                  </p>
                </div>
              ))}
              {setup.tables.floors.length === 0 ? (
                <p className="text-sm text-[#766B61]">
                  {L(locale, "No floor or area exists yet.", "لا يوجد دور أو منطقة حتى الآن.")}
                </p>
              ) : null}
            </div>
          </Panel>
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
            footer={linkButton("/staff/menu", L(locale, "Open Catalog in Office", "افتح الكتالوج في Office"))}
          >
            <ReadinessRows locale={locale} items={items} />
          </Panel>
        </div>
      );
    }

    if (phase === "tables") {
      return (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            eyebrow={L(locale, "TABLE SERVICE", "خدمة الترابيزات")}
            title={L(locale, "Create the service map", "أنشئ خريطة الخدمة")}
            description={L(
              locale,
              "Floor and table writes use the real onboarding endpoints and deterministic QR tokens.",
              "إنشاء الأدوار والترابيزات يستخدم endpoints الحقيقية وQR حقيقي."
            )}
          >
            <div className="grid gap-5">
              <form
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  floorMutation.mutate();
                }}
              >
                <Field label={L(locale, "Floor / area", "الدور / المنطقة")}>
                  <input
                    className={inputClass}
                    value={floorForm.name}
                    placeholder={L(locale, "Terrace", "التراس")}
                    disabled={!canManageBranch}
                    onChange={(event) =>
                      setFloorForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </Field>
                <Field label={L(locale, "Sort order", "الترتيب")}>
                  <input
                    className={inputClass}
                    type="number"
                    value={floorForm.sortOrder}
                    disabled={!canManageBranch}
                    onChange={(event) =>
                      setFloorForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                  />
                </Field>
                <button
                  className={primaryButtonClass}
                  disabled={!canManageBranch || floorMutation.isPending || !floorForm.name.trim()}
                >
                  {L(locale, "Add floor", "أضف دور")}
                </button>
              </form>

              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  tablesMutation.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <Field label={L(locale, "Floor", "الدور")}>
                    <input className={inputClass} value={tableForm.floorLabel} onChange={(event) => setTableForm((current) => ({ ...current, floorLabel: event.target.value }))} />
                  </Field>
                  <Field label={L(locale, "Prefix", "البادئة")}>
                    <input className={inputClass} value={tableForm.tablePrefix} onChange={(event) => setTableForm((current) => ({ ...current, tablePrefix: event.target.value }))} />
                  </Field>
                  <Field label={L(locale, "Start", "البداية")}>
                    <input className={inputClass} type="number" value={tableForm.startNumber} onChange={(event) => setTableForm((current) => ({ ...current, startNumber: event.target.value }))} />
                  </Field>
                  <Field label={L(locale, "Count", "العدد")}>
                    <input className={inputClass} type="number" value={tableForm.count} onChange={(event) => setTableForm((current) => ({ ...current, count: event.target.value }))} />
                  </Field>
                  <Field label={L(locale, "Seats", "المقاعد")}>
                    <input className={inputClass} type="number" value={tableForm.seats} onChange={(event) => setTableForm((current) => ({ ...current, seats: event.target.value }))} />
                  </Field>
                </div>
                <button className={primaryButtonClass} disabled={!canManageBranch || tablesMutation.isPending}>
                  {tablesMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {L(locale, "Bulk create tables", "أنشئ الترابيزات")}
                </button>
              </form>
            </div>
          </Panel>

          <Panel
            eyebrow={L(locale, "QR PREVIEW", "معاينة QR")}
            title={L(locale, "Recent customer entry links", "أحدث روابط دخول العملاء")}
            footer={linkButton("/staff/branches", L(locale, "Manage Tables & QR in Office", "إدارة الترابيزات وQR في Office"))}
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
                      <ExternalLink className="size-4" />
                      {L(locale, "Open", "افتح")}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
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
      const items = phaseItems(checklist, ["kds_ready", "printer_foundation_ready"]);
      return (
        <Panel
          eyebrow={L(locale, "PRODUCTION READINESS", "جاهزية الإنتاج")}
          title={L(locale, "KDS software is real; venue hardware stays explicit.", "سوفتوير KDS حقيقي؛ هاردوير المكان يظل بوابة واضحة.")}
          description={L(
            locale,
            "Printer station records and software lifecycle are not presented as physical printer transport.",
            "محطات الطباعة ودورة السوفتوير لا يتم تقديمها كأنها ربط بطابعة فعلية."
          )}
          footer={linkButton("/staff/kitchen", L(locale, "Open Kitchen", "افتح المطبخ"))}
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
      return (
        <Panel
          eyebrow={L(locale, "EXTERNAL GATE", "بوابة خارجية")}
          title={L(locale, "Payment readiness without fake activation.", "جاهزية الدفع بدون ادعاء تفعيل غير حقيقي.")}
          description={L(
            locale,
            "Manual bill/payment flow is software truth. Merchant/provider activation remains an external gate when required.",
            "رحلة الفاتورة والدفع اليدوي حقيقة برمجية. تفعيل التاجر/المزود يظل بوابة خارجية عند الحاجة."
          )}
          footer={linkButton("/staff/cashier", L(locale, "Open payment operations", "افتح تشغيل الدفع"))}
        >
          <ReadinessRows locale={locale} items={items} />
        </Panel>
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
              footer={linkButton("/staff/owner#experience", L(locale, "Open Experience in Office", "افتح Experience في Office"))}
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
          footer={linkButton("/staff/owner#operations", L(locale, "Open Operations in Office", "افتح Operations في Office"))}
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
          eyebrow={L(locale, "FINAL READINESS", "الجاهزية النهائية")}
          title={
            launchSummary?.readyForPilot
              ? L(locale, "Ready for pilot rehearsal", "جاهز لتجربة Pilot")
              : launchSummary?.readyForDemo
                ? L(locale, "Demo ready — pilot gates remain", "جاهز للديمو — ما زالت بوابات Pilot")
                : L(locale, "Launch blockers remain", "ما زالت هناك عوائق تشغيل")
          }
          description={L(
            locale,
            "This result is computed from backend records; Setup does not manufacture completion.",
            "النتيجة محسوبة من سجلات الـbackend؛ Setup لا يصنع حالة اكتمال وهمية."
          )}
        >
          <ReadinessRows locale={locale} items={checklist} />
        </Panel>

        <div className="grid content-start gap-4">
          <Panel
            eyebrow={L(locale, "GO / NO-GO", "قرار التشغيل")}
            title={
              launchSummary?.readyForPilot
                ? L(locale, "Pilot ready", "جاهز للـPilot")
                : launchSummary?.readyForDemo
                  ? L(locale, "Demo ready", "جاهز للديمو")
                  : L(locale, "Blocked", "متوقف")
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
            eyebrow={L(locale, "ACKNOWLEDGEMENT", "تأكيد المراجعة")}
            title={L(locale, "Manual notes do not override live truth.", "الملاحظات اليدوية لا تتجاوز الحقيقة الحية.")}
            description={L(
              locale,
              "Acknowledging a signal records the review action only; readiness is still recomputed from production data.",
              "تأكيد الإشارة يسجل المراجعة فقط؛ الجاهزية تظل محسوبة من بيانات الإنتاج."
            )}
          >
            {acknowledgedMessage ? (
              <p className="mb-3 rounded-lg border border-[#CAD7C9] bg-[#F0F6EF] p-3 text-xs text-[#365B3B]">
                {acknowledgedMessage}
              </p>
            ) : null}
            {checklist.find((item) => item.status !== "ready") ? (
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={readinessMutation.isPending}
                onClick={() => {
                  const item = checklist.find((entry) => entry.status !== "ready");
                  if (item) readinessMutation.mutate(item);
                }}
              >
                <ClipboardCheck className="size-4" />
                {L(locale, "Acknowledge next attention", "أكد مراجعة أول نقطة")}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[#365B3B]">
                <ShieldCheck className="size-4" />
                {L(locale, "All current checks are ready.", "كل الفحوص الحالية جاهزة.")}
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
        disabled={branchQuery.isFetching || checklistQuery.isFetching}
      >
        <RefreshCw
          className={`size-4 ${branchQuery.isFetching || checklistQuery.isFetching ? "animate-spin" : ""}`}
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
      deniedTitle="Tenant setup access required"
      deniedDescription="This staff account can open its operational surfaces, but tenant launch setup requires owner or branch manager access."
    >
      <StaffSetupContent />
    </StaffAuthGate>
  );
}
