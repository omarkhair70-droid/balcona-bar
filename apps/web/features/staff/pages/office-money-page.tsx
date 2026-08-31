"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  FileCheck2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
import {
  OfficeControlSection,
  OfficeFact,
  OfficeInlineNotice,
  OfficeStatusBadge,
  asRecord,
  formatMinor,
  formatOfficeDate,
  numberValue,
  textValue,
} from "@/features/staff/office-control-ui";
import {
  acknowledgeOfficeReconciliationIssue,
  captureOfficePayment,
  getOfficeReconciliationIssues,
  getOfficeReconciliationRuns,
  importOfficeSettlement,
  recoverOfficePayment,
  refundOfficePayment,
  resolveOfficeReconciliationIssue,
  runOfficeProviderReconciliation,
  voidOfficePayment,
  type OfficeRecord,
} from "@/features/staff/office-control-data";
import {
  getBranchBills,
  getBranchOnlinePayments,
  getBranchPaymentTerminals,
  getMerchantPaymentIntegrations,
  upsertBranchPaymentTerminal,
  upsertMerchantPaymentIntegration,
} from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import { canAccessStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

function randomKey(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `office:${prefix}:${suffix}`;
}

type SettlementLineDraft = {
  providerTransactionId: string;
  movementType: "sale" | "refund" | "void";
  amount: string;
  fee: string;
  net: string;
  settlementReference: string;
  settledAt: string;
};

type SettlementDraft = {
  provider: "paymob" | "fawry";
  externalReference: string;
  payoutReference: string;
  periodStart: string;
  periodEnd: string;
  settledAt: string;
  currency: string;
  lines: SettlementLineDraft[];
};

function blankSettlementLine(): SettlementLineDraft {
  return {
    providerTransactionId: "",
    movementType: "sale",
    amount: "",
    fee: "0",
    net: "",
    settlementReference: "",
    settledAt: "",
  };
}

function toMinor(value: string, label: string, allowNegative = false) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (!allowNegative && amount < 0)) {
    throw new Error(`${label} must be a valid amount`);
  }
  return Math.round(amount * 100);
}

function StructuredSettlementEditor({
  draft,
  setDraft,
  preview,
}: {
  draft: SettlementDraft;
  setDraft: Dispatch<SetStateAction<SettlementDraft>>;
  preview: {
    grossMinor: number;
    adjustmentMinor: number;
    feeMinor: number;
    netMinor: number;
  };
}) {
  const updateLine = (index: number, patch: Partial<SettlementLineDraft>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));

  return (
    <div className="mt-3 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          Provider
          <select
            className="mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3"
            value={draft.provider}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                provider: event.target.value as "paymob" | "fawry",
              }))
            }
          >
            <option value="paymob">Paymob</option>
            <option value="fawry">Fawry</option>
          </select>
        </label>
        {(["externalReference", "payoutReference", "currency"] as const).map(
          (field) => (
            <label key={field} className="text-xs font-medium">
              {field === "externalReference"
                ? "External reference"
                : field === "payoutReference"
                  ? "Payout reference"
                  : "Currency"}
              <Input
                className="mt-1.5"
                value={draft[field]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
              />
            </label>
          ),
        )}
        {(["periodStart", "periodEnd", "settledAt"] as const).map((field) => (
          <label key={field} className="text-xs font-medium">
            {field === "periodStart"
              ? "Period start"
              : field === "periodEnd"
                ? "Period end"
                : "Settled date (optional)"}
            <Input
              className="mt-1.5"
              type="date"
              value={draft[field]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>

      {draft.lines.map((line, index) => (
        <div key={index} className="rounded-md border border-[#E4E4DF] p-3">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-xs">Line {index + 1}</strong>
            {draft.lines.length > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    lines: current.lines.filter(
                      (_, lineIndex) => lineIndex !== index,
                    ),
                  }))
                }
              >
                Remove
              </Button>
            ) : null}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-medium sm:col-span-2">
              Provider transaction reference
              <Input
                className="mt-1"
                value={line.providerTransactionId}
                onChange={(event) =>
                  updateLine(index, {
                    providerTransactionId: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-[11px] font-medium">
              Movement
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
                value={line.movementType}
                onChange={(event) =>
                  updateLine(index, {
                    movementType: event.target.value as
                      | "sale"
                      | "refund"
                      | "void",
                  })
                }
              >
                <option value="sale">Sale</option>
                <option value="refund">Refund</option>
                <option value="void">Void</option>
              </select>
            </label>
            {(["amount", "fee", "net"] as const).map((field) => (
              <label key={field} className="text-[11px] font-medium capitalize">
                {field}
                <Input
                  className="mt-1"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={line[field]}
                  onChange={(event) =>
                    updateLine(index, { [field]: event.target.value })
                  }
                />
              </label>
            ))}
            <label className="text-[11px] font-medium">
              Line settlement reference
              <Input
                className="mt-1"
                value={line.settlementReference}
                onChange={(event) =>
                  updateLine(index, {
                    settlementReference: event.target.value,
                  })
                }
              />
            </label>
          </div>
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          setDraft((current) => ({
            ...current,
            lines: [...current.lines, blankSettlementLine()],
          }))
        }
      >
        Add settlement line
      </Button>

      <div className="grid gap-2 sm:grid-cols-2">
        <OfficeFact
          label="Lines"
          value={draft.lines.length}
          hint={`${draft.periodStart || "Start"} → ${draft.periodEnd || "End"}`}
        />
        <OfficeFact
          label="Gross / adjustments"
          value={`${formatMinor(preview.grossMinor, draft.currency)} / ${formatMinor(preview.adjustmentMinor, draft.currency)}`}
          hint={`Fees ${formatMinor(preview.feeMinor, draft.currency)} · Net ${formatMinor(preview.netMinor, draft.currency)}`}
        />
      </div>
    </div>
  );
}

function providerTruth(intent: OfficeRecord) {
  const provider = textValue(intent.provider, "unknown").toLowerCase();
  const metadata = asRecord(intent.metadata);
  const providerMetadata = asRecord(
    metadata.providerMetadata ?? metadata.provider ?? metadata.checkout,
  );
  const expectedLive =
    typeof metadata.expectedLive === "boolean"
      ? metadata.expectedLive
      : typeof providerMetadata.expectedLive === "boolean"
        ? providerMetadata.expectedLive
        : undefined;
  const observedLive =
    typeof metadata.isLive === "boolean"
      ? metadata.isLive
      : typeof providerMetadata.isLive === "boolean"
        ? providerMetadata.isLive
        : undefined;

  if (provider === "mock") {
    return "test / mock";
  }

  if (expectedLive === false || observedLive === false) {
    return "sandbox / test evidence";
  }

  if (expectedLive === true && observedLive === true) {
    return "live evidence on this transaction";
  }

  if (provider === "paymob" || provider === "fawry") {
    return "provider recorded · live certification unverified";
  }

  return "provider state unavailable";
}

function MoneyContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId,
  );
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const [selectedIntent, setSelectedIntent] = useState<OfficeRecord>();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [settlementDraft, setSettlementDraft] = useState({
    provider: "paymob" as "paymob" | "fawry",
    externalReference: "",
    payoutReference: "",
    periodStart: "",
    periodEnd: "",
    settledAt: "",
    currency: "EGP",
    lines: [blankSettlementLine()],
  });
  const [integrationDraft, setIntegrationDraft] = useState({
    scope: "company" as "company" | "branch",
    provider: "paymob" as "paymob" | "fawry" | "maestr",
    environment: "sandbox" as "sandbox" | "test" | "live",
    merchantAccountReference: "",
    enabledChannels: ["card"],
    secretKeyReference: "",
    apiKeyReference: "",
    hmacSecretReference: "",
    publicKey: "",
    integrationIds: "",
    notificationUrl: "",
    returnUrl: "",
    webhookConfigured: false,
    recoveryReady: false,
    settlementConfigured: false,
  });
  const [terminalDraft, setTerminalDraft] = useState({
    provider: "paymob" as "paymob" | "fawry" | "geidea" | "external",
    environment: "test" as "test" | "live",
    displayName: "",
    providerTerminalReference: "",
    deviceReference: "",
    merchantReference: "",
    secretReference: "",
  });
  const [issueNote, setIssueNote] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [pendingIssueActions, setPendingIssueActions] = useState<
    Record<string, "acknowledge" | "resolve">
  >({});

  const canManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["online_payments.manage"],
    branchId: selectedBranchId,
    branchScoped: true,
  });

  const billsQuery = useQuery({
    queryKey: ["office-control", "money", "bills", selectedBranchId],
    queryFn: () =>
      getBranchBills(
        selectedBranchId ?? "",
        { status: "all", limit: 100 },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["office-control", "money", "payments", selectedBranchId],
    queryFn: () =>
      getBranchOnlinePayments(
        selectedBranchId ?? "",
        { status: "all", provider: "all", limit: 100 },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const integrationsQuery = useQuery({
    queryKey: [
      "office-control",
      "money",
      "merchant-integrations",
      selectedBranchId,
    ],
    queryFn: () =>
      getMerchantPaymentIntegrations(selectedBranchId ?? "", accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const terminalsQuery = useQuery({
    queryKey: [
      "office-control",
      "money",
      "payment-terminals",
      selectedBranchId,
    ],
    queryFn: () =>
      getBranchPaymentTerminals(selectedBranchId ?? "", accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const runsQuery = useQuery({
    queryKey: [
      "office-control",
      "money",
      "reconciliation-runs",
      selectedBranchId,
    ],
    queryFn: () =>
      getOfficeReconciliationRuns(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const issuesQuery = useQuery({
    queryKey: [
      "office-control",
      "money",
      "reconciliation-issues",
      selectedBranchId,
    ],
    queryFn: () =>
      getOfficeReconciliationIssues(selectedBranchId ?? "", accessToken ?? ""),
    enabled: Boolean(selectedBranchId && accessToken),
    retry: false,
  });

  const invalidateMoney = () =>
    queryClient.invalidateQueries({
      queryKey: ["office-control", "money"],
    });

  const operationMutation = useMutation({
    mutationFn: async (action: "refund" | "void" | "capture" | "recover") => {
      const intentId = textValue(selectedIntent?.id, "");
      const amountMinor = Math.round(Number(amount) * 100);

      if (!intentId) {
        throw new Error("Select a payment first");
      }

      if ((action === "refund" || action === "capture") && amountMinor <= 0) {
        throw new Error("Enter a positive amount");
      }

      if (action === "refund") {
        return refundOfficePayment(
          intentId,
          {
            amountMinor,
            idempotencyKey: randomKey(`refund:${intentId}`),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
          accessToken ?? "",
        );
      }

      if (action === "capture") {
        return captureOfficePayment(
          intentId,
          {
            amountMinor,
            idempotencyKey: randomKey(`capture:${intentId}`),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
          accessToken ?? "",
        );
      }

      if (action === "void") {
        return voidOfficePayment(
          intentId,
          {
            idempotencyKey: randomKey(`void:${intentId}`),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
          accessToken ?? "",
        );
      }

      return recoverOfficePayment(intentId, accessToken ?? "");
    },
    onMutate: () => setActionNotice(""),
    onSuccess: (_result, action) => {
      void invalidateMoney();
      setReason("");
      setActionNotice(
        action === "recover"
          ? "Provider inquiry completed. Payment state was refreshed from the server."
          : `${action[0]?.toUpperCase()}${action.slice(1)} completed and confirmed by the server.`,
      );
    },
  });

  const reconciliationMutation = useMutation({
    mutationFn: () =>
      runOfficeProviderReconciliation(
        selectedBranchId ?? "",
        {
          periodStart: new Date(`${periodStart}T00:00:00.000Z`).toISOString(),
          periodEnd: new Date(`${periodEnd}T23:59:59.999Z`).toISOString(),
          currency: currency.trim().toUpperCase(),
          idempotencyKey: randomKey("provider-reconciliation"),
        },
        accessToken ?? "",
      ),
    onMutate: () => setActionNotice(""),
    onSuccess: () => {
      void invalidateMoney();
      setActionNotice(
        "Provider reconciliation completed. Results were refreshed from the server.",
      );
    },
  });

  const settlementMutation = useMutation({
    mutationFn: () => {
      if (
        !settlementDraft.externalReference.trim() ||
        !settlementDraft.periodStart ||
        !settlementDraft.periodEnd ||
        settlementDraft.lines.length === 0
      ) {
        throw new Error(
          "Complete the settlement header and add at least one line",
        );
      }
      const statementCurrency = settlementDraft.currency.trim().toUpperCase();
      const lines = settlementDraft.lines.map((line, index) => ({
        providerTransactionId:
          line.providerTransactionId.trim() ||
          (() => {
            throw new Error(
              `Line ${index + 1} needs a provider transaction reference`,
            );
          })(),
        movementType: line.movementType,
        amountMinor: toMinor(line.amount, `Line ${index + 1} amount`),
        feeMinor: toMinor(line.fee, `Line ${index + 1} fee`),
        netMinor: toMinor(line.net, `Line ${index + 1} net`, true),
        currency: statementCurrency,
        ...(line.settlementReference.trim()
          ? { settlementReference: line.settlementReference.trim() }
          : {}),
        ...(line.settledAt
          ? {
              settledAt: new Date(
                `${line.settledAt}T12:00:00.000Z`,
              ).toISOString(),
            }
          : {}),
      }));
      const payload = {
        provider: settlementDraft.provider,
        externalReference: settlementDraft.externalReference.trim(),
        ...(settlementDraft.payoutReference.trim()
          ? { payoutReference: settlementDraft.payoutReference.trim() }
          : {}),
        periodStart: new Date(
          `${settlementDraft.periodStart}T00:00:00.000Z`,
        ).toISOString(),
        periodEnd: new Date(
          `${settlementDraft.periodEnd}T23:59:59.999Z`,
        ).toISOString(),
        ...(settlementDraft.settledAt
          ? {
              settledAt: new Date(
                `${settlementDraft.settledAt}T12:00:00.000Z`,
              ).toISOString(),
            }
          : {}),
        currency: statementCurrency,
        grossMinor: lines
          .filter((line) => line.movementType === "sale")
          .reduce((sum, line) => sum + line.amountMinor, 0),
        adjustmentMinor: lines
          .filter((line) => line.movementType !== "sale")
          .reduce((sum, line) => sum + line.amountMinor, 0),
        feeMinor: lines.reduce((sum, line) => sum + line.feeMinor, 0),
        netMinor: lines.reduce((sum, line) => sum + line.netMinor, 0),
        lines,
      };

      return importOfficeSettlement(
        selectedBranchId ?? "",
        payload,
        accessToken ?? "",
      );
    },
    onMutate: () => setActionNotice(""),
    onSuccess: () => {
      void invalidateMoney();
      setActionNotice(
        "Settlement statement imported and reconciliation results refreshed.",
      );
      setSettlementDraft((current) => ({
        ...current,
        externalReference: "",
        payoutReference: "",
        lines: [blankSettlementLine()],
      }));
    },
  });

  const integrationMutation = useMutation({
    mutationFn: (status: "needs_setup" | "ready") => {
      const isPaymob = integrationDraft.provider === "paymob";
      const secretReferences: Record<string, string> = isPaymob
        ? {
            secretKey: integrationDraft.secretKeyReference.trim(),
            apiKey: integrationDraft.apiKeyReference.trim(),
            hmacSecret: integrationDraft.hmacSecretReference.trim(),
          }
        : integrationDraft.provider === "fawry"
          ? { secureKey: integrationDraft.secretKeyReference.trim() }
          : {};
      const configurationMetadata: Record<string, unknown> = isPaymob
        ? {
            publicKey: integrationDraft.publicKey.trim(),
            integrationIds: integrationDraft.integrationIds
              .split(",")
              .map((value) => Number(value.trim()))
              .filter(Number.isInteger),
            notificationUrl: integrationDraft.notificationUrl.trim(),
          }
        : integrationDraft.provider === "fawry"
          ? {
              notificationUrl: integrationDraft.notificationUrl.trim(),
              returnUrl: integrationDraft.returnUrl.trim(),
            }
          : {};

      return upsertMerchantPaymentIntegration(
        selectedBranchId ?? "",
        {
          scope: integrationDraft.scope,
          provider: integrationDraft.provider,
          environment: integrationDraft.environment,
          status,
          merchantAccountReference:
            integrationDraft.merchantAccountReference.trim(),
          enabledChannels: integrationDraft.enabledChannels,
          configurationMetadata,
          secretReferences,
          webhookConfigured: integrationDraft.webhookConfigured,
          recoveryReady: integrationDraft.recoveryReady,
          settlementConfigured: integrationDraft.settlementConfigured,
        },
        accessToken,
      );
    },
    onMutate: () => setActionNotice(""),
    onSuccess: (_result, status) => {
      void invalidateMoney();
      setActionNotice(
        status === "ready"
          ? "Merchant integration validated and activated."
          : "Merchant integration setup state saved.",
      );
    },
  });

  const terminalMutation = useMutation({
    mutationFn: () =>
      upsertBranchPaymentTerminal(
        selectedBranchId ?? "",
        {
          provider: terminalDraft.provider,
          environment: terminalDraft.environment,
          displayName: terminalDraft.displayName.trim(),
          ...(terminalDraft.providerTerminalReference.trim()
            ? {
                providerTerminalReference:
                  terminalDraft.providerTerminalReference.trim(),
              }
            : {}),
          ...(terminalDraft.deviceReference.trim()
            ? { deviceReference: terminalDraft.deviceReference.trim() }
            : {}),
          ...(terminalDraft.merchantReference.trim()
            ? { merchantReference: terminalDraft.merchantReference.trim() }
            : {}),
          ...(terminalDraft.secretReference.trim()
            ? { secretReference: terminalDraft.secretReference.trim() }
            : {}),
        },
        accessToken,
      ),
    onMutate: () => setActionNotice(""),
    onSuccess: () => {
      void invalidateMoney();
      setActionNotice("Terminal readiness metadata saved.");
      setTerminalDraft((current) => ({
        ...current,
        displayName: "",
        providerTerminalReference: "",
        deviceReference: "",
        merchantReference: "",
        secretReference: "",
      }));
    },
  });

  const issueMutation = useMutation({
    mutationFn: ({
      issueId,
      action,
    }: {
      issueId: string;
      action: "acknowledge" | "resolve";
    }) =>
      action === "acknowledge"
        ? acknowledgeOfficeReconciliationIssue(
            issueId,
            issueNote,
            accessToken ?? "",
          )
        : resolveOfficeReconciliationIssue(
            issueId,
            issueNote,
            accessToken ?? "",
          ),
    onMutate: (variables) => {
      setActionNotice("");
      setPendingIssueActions((current) => ({
        ...current,
        [variables.issueId]: variables.action,
      }));
    },
    onSuccess: (_result, variables) => {
      void invalidateMoney();
      setIssueNote("");
      setActionNotice(
        variables.action === "acknowledge"
          ? "Reconciliation issue acknowledged."
          : "Reconciliation issue resolved.",
      );
    },
    onSettled: (_result, _error, variables) => {
      setPendingIssueActions((current) => {
        const next = { ...current };
        delete next[variables.issueId];
        return next;
      });
    },
  });

  if (billsQuery.isPending && paymentsQuery.isPending) {
    return <LoadingState label="Loading money operations…" />;
  }

  const firstError = billsQuery.error ?? paymentsQuery.error;

  if (firstError) {
    return (
      <EmptyState
        title="Money data could not be loaded"
        description={formatErrorMessage(firstError)}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void billsQuery.refetch();
              void paymentsQuery.refetch();
              void runsQuery.refetch();
              void issuesQuery.refetch();
              void integrationsQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const bills = (billsQuery.data?.bills ?? []).map(asRecord);
  const intents = (paymentsQuery.data?.onlinePaymentIntents ?? []).map(
    asRecord,
  );
  const runs = runsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const integrations = integrationsQuery.data?.integrations ?? [];
  const effectiveIntegration = asRecord(integrationsQuery.data?.effective);
  const succeeded = intents.filter(
    (intent) => textValue(intent.status, "").toLowerCase() === "succeeded",
  );
  const active = intents.filter((intent) =>
    ["pending", "requires_action"].includes(
      textValue(intent.status, "").toLowerCase(),
    ),
  );
  const openIssues = issues.filter(
    (issue) => textValue(issue.status, "").toLowerCase() !== "resolved",
  );
  const selectedProvider = textValue(
    selectedIntent?.provider,
    "",
  ).toLowerCase();
  const canVoidOrCapture = selectedProvider === "paymob";
  const canRefund =
    selectedProvider === "paymob" || selectedProvider === "fawry";
  const settlementPreview = settlementDraft.lines.reduce(
    (totals, line) => {
      const amountMinor = Math.round((Number(line.amount) || 0) * 100);
      const feeMinor = Math.round((Number(line.fee) || 0) * 100);
      const netMinor = Math.round((Number(line.net) || 0) * 100);
      if (line.movementType === "sale") {
        totals.grossMinor += amountMinor;
      } else {
        totals.adjustmentMinor += amountMinor;
      }
      totals.feeMinor += feeMinor;
      totals.netMinor += netMinor;
      return totals;
    },
    { grossMinor: 0, adjustmentMinor: 0, feeMinor: 0, netMinor: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StaffBranchSelector
          access={effectiveAccess}
          selectedBranchId={selectedBranchId}
          onChange={setSelectedBranchId}
        />
        <OfficeInlineNotice title="Money scope">
          Restaurant/customer money only. Balcona subscription plan and tenant
          limits live under Account.
        </OfficeInlineNotice>
      </div>

      {actionNotice ? (
        <div role="status" aria-live="polite">
          <OfficeInlineNotice title="Completed">
            {actionNotice}
          </OfficeInlineNotice>
        </div>
      ) : null}

      {runsQuery.error || issuesQuery.error || integrationsQuery.error ? (
        <div role="alert">
          <OfficeInlineNotice title="Some money data is unavailable">
            {formatErrorMessage(
              runsQuery.error ?? issuesQuery.error ?? integrationsQuery.error,
            )}
          </OfficeInlineNotice>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <OfficeFact label="Bills" value={bills.length} />
        <OfficeFact label="Payment intents" value={intents.length} />
        <OfficeFact label="Succeeded" value={succeeded.length} />
        <OfficeFact
          label="Financial exceptions"
          value={openIssues.length}
          hint={
            openIssues.length
              ? "Requires reconciliation attention."
              : "No open reconciliation issue returned."
          }
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,.75fr)]">
        <OfficeControlSection
          title="Transactions"
          description="Provider intents for the selected branch. Provider environment labels are evidence-based and never infer live certification from code presence."
        >
          {intents.length === 0 ? (
            <EmptyState
              title="No online transactions"
              description="No online payment intent exists in the selected branch."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="text-[#777770]">
                  <tr className="border-b border-[#E4E4DF]">
                    <th className="px-2 py-2 text-start font-medium">
                      Created
                    </th>
                    <th className="px-2 py-2 text-start font-medium">
                      Provider
                    </th>
                    <th className="px-2 py-2 text-start font-medium">
                      Environment truth
                    </th>
                    <th className="px-2 py-2 text-start font-medium">Amount</th>
                    <th className="px-2 py-2 text-start font-medium">Status</th>
                    <th className="px-2 py-2 text-end font-medium">
                      Operations
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {intents.map((intent) => (
                    <tr
                      key={textValue(intent.id)}
                      className="border-b border-[#EFEFEA] last:border-0"
                    >
                      <td className="px-2 py-3">
                        {formatOfficeDate(intent.createdAt)}
                      </td>
                      <td className="px-2 py-3 font-semibold">
                        {textValue(intent.provider)}
                      </td>
                      <td className="px-2 py-3 text-[#6D6D66]">
                        {providerTruth(intent)}
                      </td>
                      <td className="px-2 py-3">
                        {formatMinor(
                          intent.amountMinor ?? intent.totalMinor,
                          textValue(intent.currency, "EGP"),
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <OfficeStatusBadge value={intent.status} />
                      </td>
                      <td className="px-2 py-3 text-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedIntent(intent);
                            const minor = numberValue(
                              intent.amountMinor ?? intent.totalMinor,
                            );
                            setAmount(minor ? String(minor / 100) : "");
                          }}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </OfficeControlSection>

        <OfficeControlSection
          title="Payment operation"
          description="Refund, void, capture, and provider recovery call the real scoped API. Provider/state validation remains authoritative on the server."
          action={
            <ShieldCheck className="size-4 text-[#777770]" aria-hidden="true" />
          }
        >
          {!selectedIntent ? (
            <OfficeInlineNotice title="Select a transaction">
              Choose Manage on a transaction to inspect supported operations.
            </OfficeInlineNotice>
          ) : !canManage ? (
            <OfficeInlineNotice title="Read-only access">
              online_payments.manage is required for financial mutations.
            </OfficeInlineNotice>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <OfficeFact
                  label="Intent"
                  value={textValue(selectedIntent.id).slice(0, 18)}
                />
                <OfficeFact
                  label="Provider"
                  value={textValue(selectedIntent.provider)}
                  hint={providerTruth(selectedIntent)}
                />
              </div>
              <label className="block text-xs font-medium">
                Amount
                <Input
                  className="mt-1.5"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="block text-xs font-medium">
                Reason / note
                <Input
                  className="mt-1.5"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Optional operational reason"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {canRefund ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={operationMutation.isPending}
                    aria-busy={
                      operationMutation.isPending &&
                      operationMutation.variables === "refund"
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          "Submit a refund to the configured provider for this amount?",
                        )
                      ) {
                        operationMutation.mutate("refund");
                      }
                    }}
                  >
                    {operationMutation.isPending &&
                    operationMutation.variables === "refund"
                      ? "Refunding…"
                      : "Refund"}
                  </Button>
                ) : null}
                {canVoidOrCapture ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={operationMutation.isPending}
                      aria-busy={
                        operationMutation.isPending &&
                        operationMutation.variables === "void"
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            "Void this provider payment? The provider will decide whether the current state allows it.",
                          )
                        ) {
                          operationMutation.mutate("void");
                        }
                      }}
                    >
                      {operationMutation.isPending &&
                      operationMutation.variables === "void"
                        ? "Voiding…"
                        : "Void"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={operationMutation.isPending}
                      aria-busy={
                        operationMutation.isPending &&
                        operationMutation.variables === "capture"
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            "Capture this amount? The provider will reject unsupported payment states.",
                          )
                        ) {
                          operationMutation.mutate("capture");
                        }
                      }}
                    >
                      {operationMutation.isPending &&
                      operationMutation.variables === "capture"
                        ? "Capturing…"
                        : "Capture"}
                    </Button>
                  </>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={operationMutation.isPending}
                  aria-busy={
                    operationMutation.isPending &&
                    operationMutation.variables === "recover"
                  }
                  onClick={() => operationMutation.mutate("recover")}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {operationMutation.isPending &&
                  operationMutation.variables === "recover"
                    ? "Checking provider…"
                    : "Recover / inquire"}
                </Button>
              </div>
              {operationMutation.isError ? (
                <OfficeInlineNotice title="Operation failed">
                  {formatErrorMessage(operationMutation.error)}
                </OfficeInlineNotice>
              ) : null}
              {selectedProvider === "mock" ? (
                <OfficeInlineNotice title="Test provider">
                  Mock transactions are labelled test-only. This Office surface
                  does not expose mock succeed/fail controls.
                </OfficeInlineNotice>
              ) : null}
            </div>
          )}
        </OfficeControlSection>
      </div>

      <OfficeControlSection
        title="Bills"
        description="Restaurant bills are shown separately from provider transactions so cash/POS/manual tender state is not confused with online processing."
      >
        {bills.length === 0 ? (
          <EmptyState
            title="No bills"
            description="No bill exists in the selected branch for this query."
          />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {bills.slice(0, 24).map((bill) => (
              <div
                key={textValue(bill.id)}
                className="grid gap-2 rounded-md border border-[#E4E4DF] p-3 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold">
                    Bill {textValue(bill.id).slice(0, 10)}
                  </p>
                  <p className="mt-1 text-xs text-[#74746E]">
                    {formatOfficeDate(bill.createdAt)}
                  </p>
                </div>
                <div className="text-end">
                  <OfficeStatusBadge value={bill.status} />
                  <p className="mt-1 text-xs font-semibold">
                    {formatMinor(
                      bill.totalMinor ?? bill.amountMinor,
                      textValue(bill.currency, "EGP"),
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </OfficeControlSection>

      <OfficeControlSection
        title="Payment methods & merchant readiness"
        description="The selected branch resolves a branch override first, then the company default. Secret values stay in runtime configuration; this surface stores references only."
        action={
          <ShieldCheck className="size-4 text-[#777770]" aria-hidden="true" />
        }
      >
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-2">
            <OfficeFact
              label="Effective provider"
              value={textValue(effectiveIntegration.provider, "Not configured")}
              hint={
                textValue(effectiveIntegration.environment, "") ||
                "Payments fail closed until a merchant integration is ready."
              }
            />
            {integrationsQuery.isPending ? (
              <p role="status" className="text-xs text-[#777770]">
                Checking merchant readiness…
              </p>
            ) : integrations.length === 0 ? (
              <OfficeInlineNotice title="Merchant setup required">
                No company or branch merchant integration is recorded. Real
                online checkout remains unavailable for this venue.
              </OfficeInlineNotice>
            ) : (
              integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="rounded-md border border-[#E4E4DF] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="capitalize">
                      {integration.provider}
                    </strong>
                    <OfficeStatusBadge value={integration.status} />
                  </div>
                  <p className="mt-1 text-[#707069]">
                    {integration.branchId
                      ? "Branch override"
                      : "Company default"}
                    {" · "}
                    {integration.environment}
                  </p>
                  <p className="mt-1 text-[#707069]">
                    Methods: {integration.enabledChannels.join(", ") || "none"}
                  </p>
                  <p className="mt-1 text-[#707069]">
                    Webhook{" "}
                    {integration.webhookConfigured
                      ? "configured"
                      : "not configured"}
                    {" · "}Recovery{" "}
                    {integration.recoveryReady ? "ready" : "blocked"}
                    {" · "}Settlement{" "}
                    {integration.settlementConfigured
                      ? "configured"
                      : "not configured"}
                  </p>
                  {integration.readinessMessage ? (
                    <p className="mt-2 text-[#8A6A2C]">
                      {integration.readinessMessage}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {canManage ? (
            <details className="rounded-md border border-[#E4E4DF] p-3">
              <summary className="cursor-pointer text-xs font-semibold">
                Configure merchant connection
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Scope
                  <select
                    className="mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3"
                    value={integrationDraft.scope}
                    onChange={(event) =>
                      setIntegrationDraft((current) => ({
                        ...current,
                        scope: event.target.value as "company" | "branch",
                      }))
                    }
                  >
                    <option value="company">Company default</option>
                    <option value="branch">Selected branch override</option>
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Provider
                  <select
                    className="mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3"
                    value={integrationDraft.provider}
                    onChange={(event) => {
                      const provider = event.target.value as
                        | "paymob"
                        | "fawry"
                        | "maestr";
                      setIntegrationDraft((current) => ({
                        ...current,
                        provider,
                        enabledChannels:
                          provider === "paymob"
                            ? ["card"]
                            : provider === "fawry"
                              ? ["card", "wallet", "reference_code"]
                              : [],
                      }));
                    }}
                  >
                    <option value="paymob">Paymob</option>
                    <option value="fawry">Fawry</option>
                    <option value="maestr">
                      Commercial IPN / Maestr (blocked)
                    </option>
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Environment
                  <select
                    className="mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3"
                    value={integrationDraft.environment}
                    onChange={(event) =>
                      setIntegrationDraft((current) => ({
                        ...current,
                        environment: event.target.value as
                          | "sandbox"
                          | "test"
                          | "live",
                      }))
                    }
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Merchant account reference
                  <Input
                    className="mt-1.5"
                    value={integrationDraft.merchantAccountReference}
                    onChange={(event) =>
                      setIntegrationDraft((current) => ({
                        ...current,
                        merchantAccountReference: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              {integrationDraft.provider !== "maestr" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium">
                    {integrationDraft.provider === "paymob"
                      ? "Secret key environment variable"
                      : "Secure key environment variable"}
                    <Input
                      className="mt-1.5 font-mono"
                      placeholder="BALCONA_PROVIDER_SECRET"
                      value={integrationDraft.secretKeyReference}
                      onChange={(event) =>
                        setIntegrationDraft((current) => ({
                          ...current,
                          secretKeyReference: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {integrationDraft.provider === "paymob" ? (
                    <>
                      <label className="text-xs font-medium">
                        API key environment variable
                        <Input
                          className="mt-1.5 font-mono"
                          value={integrationDraft.apiKeyReference}
                          onChange={(event) =>
                            setIntegrationDraft((current) => ({
                              ...current,
                              apiKeyReference: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="text-xs font-medium">
                        HMAC environment variable
                        <Input
                          className="mt-1.5 font-mono"
                          value={integrationDraft.hmacSecretReference}
                          onChange={(event) =>
                            setIntegrationDraft((current) => ({
                              ...current,
                              hmacSecretReference: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="text-xs font-medium">
                        Public key
                        <Input
                          className="mt-1.5 font-mono"
                          value={integrationDraft.publicKey}
                          onChange={(event) =>
                            setIntegrationDraft((current) => ({
                              ...current,
                              publicKey: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="text-xs font-medium sm:col-span-2">
                        Integration IDs (comma separated)
                        <Input
                          className="mt-1.5 font-mono"
                          value={integrationDraft.integrationIds}
                          onChange={(event) =>
                            setIntegrationDraft((current) => ({
                              ...current,
                              integrationIds: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <label className="text-xs font-medium">
                      Return URL
                      <Input
                        className="mt-1.5"
                        value={integrationDraft.returnUrl}
                        onChange={(event) =>
                          setIntegrationDraft((current) => ({
                            ...current,
                            returnUrl: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  <label className="text-xs font-medium sm:col-span-2">
                    Provider webhook URL
                    <Input
                      className="mt-1.5"
                      value={integrationDraft.notificationUrl}
                      onChange={(event) =>
                        setIntegrationDraft((current) => ({
                          ...current,
                          notificationUrl: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <OfficeInlineNotice title="External contract blocker">
                  Maestr/IPN execution stays disabled until the exact merchant
                  API, signature, amount-unit, inquiry, and settlement contract
                  is available for Balcona&apos;s account.
                </OfficeInlineNotice>
              )}

              {integrationDraft.provider === "fawry" ? (
                <fieldset className="mt-3">
                  <legend className="text-xs font-medium">
                    Enabled checkout methods
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {[
                      ["card", "Card"],
                      ["wallet", "Mobile wallet"],
                      ["reference_code", "Fawry reference code"],
                    ].map(([channel, label]) => (
                      <label key={channel} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={integrationDraft.enabledChannels.includes(
                            channel,
                          )}
                          onChange={(event) =>
                            setIntegrationDraft((current) => ({
                              ...current,
                              enabledChannels: event.target.checked
                                ? Array.from(
                                    new Set([
                                      ...current.enabledChannels,
                                      channel,
                                    ]),
                                  )
                                : current.enabledChannels.filter(
                                    (value) => value !== channel,
                                  ),
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {[
                  ["webhookConfigured", "Webhook configured"],
                  ["recoveryReady", "Inquiry/recovery ready"],
                  ["settlementConfigured", "Settlement configured"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        integrationDraft[
                          key as
                            | "webhookConfigured"
                            | "recoveryReady"
                            | "settlementConfigured"
                        ],
                      )}
                      onChange={(event) =>
                        setIntegrationDraft((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={integrationMutation.isPending}
                  aria-busy={
                    integrationMutation.isPending &&
                    integrationMutation.variables === "needs_setup"
                  }
                  onClick={() => integrationMutation.mutate("needs_setup")}
                >
                  {integrationMutation.isPending &&
                  integrationMutation.variables === "needs_setup"
                    ? "Saving setup…"
                    : "Save setup state"}
                </Button>
                <Button
                  size="sm"
                  disabled={
                    integrationMutation.isPending ||
                    integrationDraft.provider === "maestr"
                  }
                  aria-busy={
                    integrationMutation.isPending &&
                    integrationMutation.variables === "ready"
                  }
                  onClick={() => integrationMutation.mutate("ready")}
                >
                  {integrationMutation.isPending &&
                  integrationMutation.variables === "ready"
                    ? "Validating…"
                    : "Validate & activate"}
                </Button>
              </div>
              {integrationMutation.isError ? (
                <div className="mt-3">
                  <OfficeInlineNotice title="Merchant connection not ready">
                    {formatErrorMessage(integrationMutation.error)}
                  </OfficeInlineNotice>
                </div>
              ) : null}
            </details>
          ) : (
            <OfficeInlineNotice title="Read-only access">
              online_payments.manage is required to configure merchant payment
              readiness.
            </OfficeInlineNotice>
          )}
        </div>
      </OfficeControlSection>

      <OfficeControlSection
        title="Direct terminal / SoftPOS readiness"
        description="Terminal/device identities can be recorded per branch, but provider execution stays fail-closed until Balcona has an exact merchant terminal API contract, callback/inquiry behavior, and a verified test device. Manual card_pos is still only an external tender record."
        action={
          <CreditCard className="size-4 text-[#777770]" aria-hidden="true" />
        }
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2">
            {terminalsQuery.isPending ? (
              <p className="text-xs text-[#777770]">
                Checking terminal readiness…
              </p>
            ) : terminalsQuery.isError ? (
              <OfficeInlineNotice title="Terminal readiness unavailable">
                {formatErrorMessage(terminalsQuery.error)}
              </OfficeInlineNotice>
            ) : (terminalsQuery.data?.terminals ?? []).length === 0 ? (
              <OfficeInlineNotice title="No direct terminal connected">
                No branch terminal metadata is recorded. Card POS can still be
                recorded manually after an external terminal approves, but
                Balcona is not controlling that device.
              </OfficeInlineNotice>
            ) : (
              (terminalsQuery.data?.terminals ?? []).map((terminal) => (
                <div
                  key={terminal.id}
                  className="rounded-md border border-[#E4E4DF] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{terminal.displayName}</strong>
                    <OfficeStatusBadge value={terminal.status} />
                  </div>
                  <p className="mt-1 text-[#707069]">
                    {terminal.provider} · {terminal.environment}
                  </p>
                  <p className="mt-1 text-[#707069]">
                    Terminal ref:{" "}
                    {terminal.providerTerminalReference ?? "not assigned"}
                  </p>
                  <p className="mt-2 text-[#8A6A2C]">
                    {terminal.readinessMessage ??
                      "Provider execution is not available."}
                  </p>
                </div>
              ))
            )}
          </div>

          {canManage ? (
            <details className="rounded-md border border-[#E4E4DF] p-3">
              <summary className="cursor-pointer text-xs font-semibold">
                Record terminal/device metadata
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Provider
                  <select
                    className="mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3"
                    value={terminalDraft.provider}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        provider: event.target.value as
                          | "paymob"
                          | "fawry"
                          | "geidea"
                          | "external",
                      }))
                    }
                  >
                    <option value="paymob">Paymob</option>
                    <option value="fawry">Fawry</option>
                    <option value="geidea">Geidea</option>
                    <option value="external">Other licensed provider</option>
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Environment
                  <select
                    className="mt-1.5 min-h-11 w-full rounded-md border border-input bg-background px-3"
                    value={terminalDraft.environment}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        environment: event.target.value as "test" | "live",
                      }))
                    }
                  >
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Display name
                  <Input
                    className="mt-1.5"
                    placeholder="Counter terminal 1"
                    value={terminalDraft.displayName}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs font-medium">
                  Provider terminal reference
                  <Input
                    className="mt-1.5 font-mono"
                    value={terminalDraft.providerTerminalReference}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        providerTerminalReference: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs font-medium">
                  Device reference
                  <Input
                    className="mt-1.5 font-mono"
                    value={terminalDraft.deviceReference}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        deviceReference: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs font-medium">
                  Merchant reference
                  <Input
                    className="mt-1.5 font-mono"
                    value={terminalDraft.merchantReference}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        merchantReference: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs font-medium sm:col-span-2">
                  Runtime secret name only
                  <Input
                    className="mt-1.5 font-mono"
                    placeholder="BALCONA_TERMINAL_PROVIDER_SECRET"
                    value={terminalDraft.secretReference}
                    onChange={(event) =>
                      setTerminalDraft((current) => ({
                        ...current,
                        secretReference: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                disabled={
                  terminalMutation.isPending ||
                  !terminalDraft.displayName.trim()
                }
                aria-busy={terminalMutation.isPending}
                onClick={() => terminalMutation.mutate()}
              >
                {terminalMutation.isPending
                  ? "Saving terminal readiness…"
                  : "Save blocked terminal readiness"}
              </Button>
              {terminalMutation.isError ? (
                <div className="mt-3">
                  <OfficeInlineNotice title="Terminal metadata not saved">
                    {formatErrorMessage(terminalMutation.error)}
                  </OfficeInlineNotice>
                </div>
              ) : null}
            </details>
          ) : (
            <OfficeInlineNotice title="Read-only access">
              online_payments.manage is required to record terminal readiness.
            </OfficeInlineNotice>
          )}
        </div>
      </OfficeControlSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <OfficeControlSection
          title="Settlements & payouts"
          description="Imported settlement batches appear through reconciliation runs. Import is intentionally explicit because it changes financial reconciliation state."
          action={
            <Banknote className="size-4 text-[#777770]" aria-hidden="true" />
          }
        >
          <div className="space-y-3">
            {runsQuery.isPending ? (
              <p role="status" className="text-xs text-[#777770]">
                Loading reconciliation runs…
              </p>
            ) : runs.length === 0 ? (
              <OfficeInlineNotice title="No reconciliation runs">
                No provider or settlement reconciliation run has been recorded.
              </OfficeInlineNotice>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 12).map((run) => {
                  const batch = asRecord(run.settlementBatch);

                  return (
                    <div
                      key={textValue(run.id)}
                      className="rounded-md border border-[#E4E4DF] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold">
                          {textValue(run.source).replaceAll("_", " ")}
                        </p>
                        <OfficeStatusBadge value={run.status} />
                      </div>
                      <div className="mt-2 grid gap-1 text-[11px] text-[#707069] sm:grid-cols-2">
                        <span>{formatOfficeDate(run.createdAt)}</span>
                        <span>
                          {batch.id
                            ? `Payout ${textValue(batch.payoutReference, textValue(batch.externalReference))}`
                            : "No settlement batch linked"}
                        </span>
                        <span>
                          Matched {numberValue(run.matchedCount)} · Pending{" "}
                          {numberValue(run.pendingCount)}
                        </span>
                        <span>Mismatches {numberValue(run.mismatchCount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canManage ? (
              <details className="rounded-md border border-[#E4E4DF] p-3">
                <summary className="cursor-pointer text-xs font-semibold">
                  Import settlement statement
                </summary>
                <p className="mt-2 text-[11px] leading-4 text-[#73736D]">
                  Enter the provider statement header and movements below. The
                  preview derives its totals from the lines, and server
                  validation rejects an inconsistent statement before it changes
                  reconciliation state.
                </p>
                <StructuredSettlementEditor
                  draft={settlementDraft}
                  setDraft={setSettlementDraft}
                  preview={settlementPreview}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={
                    !settlementDraft.externalReference.trim() ||
                    !settlementDraft.periodStart ||
                    !settlementDraft.periodEnd ||
                    settlementMutation.isPending
                  }
                  aria-busy={settlementMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Import this settlement statement and run reconciliation?",
                      )
                    ) {
                      settlementMutation.mutate();
                    }
                  }}
                >
                  <FileCheck2 className="size-3.5" aria-hidden="true" />
                  {settlementMutation.isPending
                    ? "Importing & reconciling…"
                    : "Import & reconcile"}
                </Button>
                {settlementMutation.isError ? (
                  <div className="mt-2">
                    <OfficeInlineNotice title="Settlement import failed">
                      {formatErrorMessage(settlementMutation.error)}
                    </OfficeInlineNotice>
                  </div>
                ) : null}
              </details>
            ) : null}
          </div>
        </OfficeControlSection>

        <OfficeControlSection
          title="Reconciliation"
          description="Provider inquiry reconciliation is a real server-to-server operation and can surface financial exceptions without inventing success."
          action={
            <FileCheck2 className="size-4 text-[#777770]" aria-hidden="true" />
          }
        >
          {canManage ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">
                From
                <Input
                  className="mt-1.5"
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label className="text-xs font-medium">
                Through
                <Input
                  className="mt-1.5"
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
              <label className="text-xs font-medium">
                Currency
                <Input
                  className="mt-1.5"
                  value={currency}
                  maxLength={12}
                  onChange={(event) => setCurrency(event.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={
                    !periodStart ||
                    !periodEnd ||
                    !currency.trim() ||
                    reconciliationMutation.isPending
                  }
                  aria-busy={reconciliationMutation.isPending}
                  onClick={() => reconciliationMutation.mutate()}
                >
                  {reconciliationMutation.isPending
                    ? "Reconciling with provider…"
                    : "Run provider reconciliation"}
                </Button>
              </div>
            </div>
          ) : (
            <OfficeInlineNotice title="Read-only access">
              online_payments.manage is required to start reconciliation.
            </OfficeInlineNotice>
          )}
          {reconciliationMutation.isError ? (
            <div className="mt-3">
              <OfficeInlineNotice title="Reconciliation failed">
                {formatErrorMessage(reconciliationMutation.error)}
              </OfficeInlineNotice>
            </div>
          ) : null}
        </OfficeControlSection>
      </div>

      <OfficeControlSection
        title="Issues"
        description="Mismatches and provider exceptions remain visible until explicitly acknowledged or resolved."
        action={
          openIssues.length > 0 ? (
            <AlertTriangle
              className="size-4 text-[#8A6A2C]"
              aria-hidden="true"
            />
          ) : null
        }
      >
        {issuesQuery.isPending ? (
          <p role="status" className="text-xs text-[#777770]">
            Loading reconciliation issues…
          </p>
        ) : issues.length === 0 ? (
          <EmptyState
            title="No reconciliation issues"
            description="The API returned no reconciliation exception for this branch."
          />
        ) : (
          <div className="space-y-2">
            <Input
              value={issueNote}
              onChange={(event) => setIssueNote(event.target.value)}
              placeholder="Optional acknowledgement / resolution note"
            />
            {issues.map((issue) => {
              const issueId = textValue(issue.id, "");
              const status = textValue(issue.status).toLowerCase();
              const pendingIssueAction = pendingIssueActions[issueId];

              return (
                <div
                  key={issueId}
                  className="grid gap-3 rounded-md border border-[#E4E4DF] p-3 lg:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        {textValue(issue.type).replaceAll("_", " ")}
                      </p>
                      <OfficeStatusBadge value={issue.status} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#6F6F68]">
                      {textValue(issue.message, "Reconciliation mismatch")}
                    </p>
                    <p className="mt-1 text-[11px] text-[#888881]">
                      Detected {formatOfficeDate(issue.detectedAt)}
                    </p>
                  </div>
                  {canManage && status !== "resolved" ? (
                    <div className="flex items-center gap-2">
                      {status !== "acknowledged" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={Boolean(pendingIssueAction)}
                          aria-busy={pendingIssueAction === "acknowledge"}
                          onClick={() =>
                            issueMutation.mutate({
                              issueId,
                              action: "acknowledge",
                            })
                          }
                        >
                          {pendingIssueAction === "acknowledge"
                            ? "Acknowledging…"
                            : "Acknowledge"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={Boolean(pendingIssueAction)}
                        aria-busy={pendingIssueAction === "resolve"}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Resolve this reconciliation issue? The resolution is audited.",
                            )
                          ) {
                            issueMutation.mutate({
                              issueId,
                              action: "resolve",
                            });
                          }
                        }}
                      >
                        {pendingIssueAction === "resolve"
                          ? "Resolving…"
                          : "Resolve"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </OfficeControlSection>

      {active.length > 0 ? (
        <OfficeInlineNotice title="Active payment state">
          {active.length} payment intent{active.length === 1 ? "" : "s"} remain
          pending or require action. These are not counted as settled money.
        </OfficeInlineNotice>
      ) : null}
    </div>
  );
}

export function OfficeMoneyPage() {
  return (
    <OfficeStaffShell
      activeDomain="money"
      title="Money"
      description="Restaurant payment operations, bills, settlements, reconciliation, and financial exceptions. Balcona subscription billing is intentionally separate."
    >
      <StaffAuthGate
        requiredPermissions={["online_payments.read"]}
        branchScoped
        deniedTitle="Money access required"
        deniedDescription="This surface requires online_payments.read for the selected location."
      >
        <MoneyContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
