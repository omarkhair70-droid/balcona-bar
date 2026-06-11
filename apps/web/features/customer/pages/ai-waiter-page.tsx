"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Power, ShoppingBag } from "lucide-react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  applyAiCartProposal,
  closeAiWaiter,
  escalateAiWaiter,
  getBranchEffectiveExperience,
  getBranchMenu,
  getCurrentAiWaiterSession,
  listAiWaiterMessages,
  rejectAiCartProposal,
  sendAiWaiterMessage,
  startAiWaiter
} from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { AiWaiterLanguage, MenuItemSummary } from "@/lib/api/types";
import { withCustomerTransientRetry } from "@/lib/customer/customer-api-reliability";
import {
  assertCustomerSessionReady,
  getCustomerSessionReadiness
} from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateLight, vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { AiCartProposalCard } from "../ai-cart-proposal-card";
import { AiChatShell } from "../ai-chat-shell";
import { AiEscalationCard } from "../ai-escalation-card";
import { AiMessageBubble } from "../ai-message-bubble";
import { AiMessageComposer } from "../ai-message-composer";
import { AiSuggestedPrompts } from "../ai-suggested-prompts";
import {
  aiLanguageOptions,
  getAiWaiterExperience,
  getRecord,
  shouldRefreshFromAiToolResult
} from "../ai-waiter-helpers";
import { AiWaiterStatusPill } from "../ai-waiter-status-pill";
import { CartSummary } from "../cart-summary";
import { CustomerSessionScreen } from "../customer-session-screen";

type AiWaiterPageProps = {
  sessionId: string;
};

const CUSTOMER_MUTATION_TIMEOUT_MS = 15_000;

function invalidateAiWaiter(queryClient: ReturnType<typeof useQueryClient>, sessionId: string) {
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.aiWaiter(sessionId)
  });
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.aiWaiterMessages(sessionId)
  });
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.aiWaiterProposals(sessionId)
  });
}

function invalidateCustomerState(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string
) {
  void queryClient.invalidateQueries({ queryKey: customerQueryKeys.cart(sessionId) });
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.status(sessionId)
  });
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.timeline(sessionId)
  });
}

function invalidateCustomerOperations(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string
) {
  invalidateCustomerState(queryClient, sessionId);
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.waiterCalls(sessionId)
  });
  void queryClient.invalidateQueries({
    queryKey: customerQueryKeys.bill(sessionId)
  });
}

function getLatestProposal(
  stateProposal?: Record<string, unknown> | null,
  mutationProposal?: Record<string, unknown> | null
) {
  return mutationProposal ?? stateProposal ?? null;
}

export function AiWaiterPage({ sessionId }: AiWaiterPageProps) {
  const t = useTranslations("customer.ai");
  const queryClient = useQueryClient();
  const hasHydrated = useCustomerSessionStore((state) => state.hasHydrated);
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const expiresAt = useCustomerSessionStore(
    (state) => state.customerAccessTokenExpiresAt
  );
  const readiness = getCustomerSessionReadiness(
    {
      hasHydrated,
      sessionId: storedSessionId,
      branchId,
      customerAccessToken: token,
      customerAccessTokenExpiresAt: expiresAt
    },
    sessionId
  );
  const [language, setLanguage] = useState<AiWaiterLanguage>("en");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [proposalNotice, setProposalNotice] = useState("");
  const [escalationNotice, setEscalationNotice] = useState("");
  const activeLanguage =
    aiLanguageOptions.find((option) => option.value === language) ??
    aiLanguageOptions[0];
  const aiWaiterQuery = useQuery({
    queryKey: customerQueryKeys.aiWaiter(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getCurrentAiWaiterSession(ready.sessionId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
    staleTime: 10_000,
    retry: 1
  });
  const aiMessagesQuery = useQuery({
    queryKey: customerQueryKeys.aiWaiterMessages(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return listAiWaiterMessages(
        ready.sessionId,
        { limit: 50 },
        ready.customerAccessToken
      );
    },
    enabled: readiness.isReady && Boolean(aiWaiterQuery.data?.session),
    staleTime: 10_000,
    retry: 1
  });
  const menuQuery = useQuery({
    queryKey: customerQueryKeys.menu(branchId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getBranchMenu(ready.branchId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
    staleTime: 30_000
  });
  const experienceQuery = useQuery({
    queryKey: customerQueryKeys.experience(branchId),
    queryFn: () => getBranchEffectiveExperience(branchId ?? ""),
    enabled: Boolean(branchId),
    staleTime: 60_000,
    retry: 1
  });
  const menuItemsById = useMemo(() => {
    const items = new Map<string, MenuItemSummary>();

    for (const category of menuQuery.data?.categories ?? []) {
      for (const item of category.items) {
        items.set(item.id, item);
      }
    }

    return items;
  }, [menuQuery.data?.categories]);
  const messages =
    aiMessagesQuery.data?.messages ??
    aiWaiterQuery.data?.messages ??
    [];
  const experience = getAiWaiterExperience(
    aiWaiterQuery.data,
    experienceQuery.data
  );
  const cartSummary = aiWaiterQuery.data?.cartSummary;

  const startMutation = useMutation({
    mutationFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return startAiWaiter(
        ready.sessionId,
        { language },
        ready.customerAccessToken
      );
    },
    onSuccess: () => {
      setLocalError("");
      invalidateAiWaiter(queryClient, sessionId);
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const sendMutation = useMutation({
    mutationFn: (value: string) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return sendAiWaiterMessage(
        ready.sessionId,
        { message: value, language },
        ready.customerAccessToken
      );
    },
    onSuccess: (result) => {
      setMessage("");
      setLocalError("");
      setProposalNotice("");
      invalidateAiWaiter(queryClient, sessionId);
      if (shouldRefreshFromAiToolResult(result)) {
        invalidateCustomerOperations(queryClient, sessionId);
      }
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const applyMutation = useMutation({
    mutationFn: (proposalId: string) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return withCustomerTransientRetry(
        () =>
          applyAiCartProposal(proposalId, ready.customerAccessToken, {
            timeoutMs: CUSTOMER_MUTATION_TIMEOUT_MS
          }),
        {
          flow: "ai_proposal_apply",
          maxAttempts: 3
        }
      );
    },
    onSuccess: () => {
      setProposalNotice(
        t("proposal.appliedNotice")
      );
      invalidateAiWaiter(queryClient, sessionId);
      invalidateCustomerState(queryClient, sessionId);
      vibrateSuccess();
    },
    onError: () => vibrateWarning()
  });
  const rejectMutation = useMutation({
    mutationFn: (proposalId: string) => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return rejectAiCartProposal(
        proposalId,
        { reason: "customer_declined" },
        ready.customerAccessToken
      );
    },
    onSuccess: () => {
      setProposalNotice(t("proposal.rejectedNotice"));
      invalidateAiWaiter(queryClient, sessionId);
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const escalationMutation = useMutation({
    mutationFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return escalateAiWaiter(
        ready.sessionId,
        {
          reason: "customer_requested_human",
          message: "Customer asked for a human waiter from the AI waiter UI."
        },
        ready.customerAccessToken
      );
    },
    onSuccess: () => {
      setEscalationNotice(t("escalation.notified"));
      invalidateAiWaiter(queryClient, sessionId);
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.waiterCalls(sessionId)
      });
      vibrateSuccess();
    },
    onError: () => vibrateWarning()
  });
  const closeMutation = useMutation({
    mutationFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return closeAiWaiter(ready.sessionId, ready.customerAccessToken);
    },
    onSuccess: () => {
      invalidateAiWaiter(queryClient, sessionId);
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const mutationProposal = getRecord(sendMutation.data?.cartProposal);
  const proposal = getLatestProposal(
    getRecord(aiWaiterQuery.data?.latestCartProposal),
    mutationProposal
  );
  const proposalActionError =
    applyMutation.isError
      ? t("errors.applyProposal", {
          message: formatErrorMessage(applyMutation.error)
        })
      : rejectMutation.isError
        ? t("errors.rejectProposal", {
            message: formatErrorMessage(rejectMutation.error)
          })
        : undefined;

  function handleSubmit() {
    if (!readiness.isReady) {
      setLocalError(readiness.message);
      vibrateWarning();
      return;
    }

    const normalized = message.trim();

    if (!normalized) {
      setLocalError(t("errors.emptyMessage"));
      vibrateWarning();
      return;
    }

    setLocalError("");
    sendMutation.mutate(normalized);
  }

  function handlePrompt(prompt: string) {
    setLocalError("");
    setMessage(prompt);
  }

  function handleQuickReply(reply: string) {
    if (!readiness.isReady) {
      setLocalError(readiness.message);
      vibrateWarning();
      return;
    }

    setLocalError("");
    sendMutation.mutate(reply);
  }

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="service"
      eyebrow={t("page.eyebrow")}
      title={t("page.title")}
      description={t("page.description")}
    >
      <AiChatShell
        title={experience.title}
        description={experience.description}
        tone={experience.tone}
        status={
          <AiWaiterStatusPill
            session={aiWaiterQuery.data?.session}
            language={activeLanguage}
            isLoading={aiWaiterQuery.isPending || startMutation.isPending}
            isError={aiWaiterQuery.isError}
          />
        }
        side={
          <>
            <AiCartProposalCard
              sessionId={sessionId}
              proposal={proposal}
              menuItemsById={menuItemsById}
              isApplying={applyMutation.isPending}
              isRejecting={rejectMutation.isPending}
              actionError={proposalActionError}
              actionSuccess={proposalNotice}
              isSessionReady={readiness.isReady}
              disabledMessage={readiness.isReady ? undefined : readiness.message}
              onApply={(proposalId) => applyMutation.mutate(proposalId)}
              onReject={(proposalId) => rejectMutation.mutate(proposalId)}
            />
            {proposalActionError ? (
              <CopyDebugReportButton
                action={
                  applyMutation.isError
                    ? "ai_proposal_apply"
                    : "ai_proposal_reject"
                }
                flow="customer_ai_waiter"
                sessionId={sessionId}
                error={
                  applyMutation.isError
                    ? applyMutation.error
                    : rejectMutation.error
                }
              />
            ) : null}
            <AiEscalationCard
              isPending={escalationMutation.isPending}
              successMessage={escalationNotice}
                errorMessage={
                  escalationMutation.isError
                  ? t("errors.escalation", {
                      message: formatErrorMessage(escalationMutation.error)
                    })
                  : undefined
              }
              onEscalate={() => escalationMutation.mutate()}
            />
            {escalationMutation.isError ? (
              <CopyDebugReportButton
                action="ai_waiter_escalate"
                flow="customer_ai_waiter"
                sessionId={sessionId}
                error={escalationMutation.error}
              />
            ) : null}
            <CartSummary
              sessionId={sessionId}
              cart={cartSummary}
            />
          </>
        }
      >
        <div className="grid gap-4" dir={activeLanguage.dir}>
          {aiWaiterQuery.isPending ? (
            <LoadingState label={t("page.loading")} />
          ) : null}
          {aiWaiterQuery.isError ? (
            <EmptyState
              title={t("errors.loadTitle")}
              description={formatErrorMessage(aiWaiterQuery.error)}
              action={<AlertTriangle className="size-5 text-warning" aria-hidden="true" />}
              debug={{
                action: "ai_waiter_state",
                flow: "customer_ai_waiter",
                sessionId,
                error: aiWaiterQuery.error
              }}
            />
          ) : null}
          {!aiWaiterQuery.data?.session && aiWaiterQuery.isSuccess ? (
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("empty.noActiveSessionTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("empty.noActiveSessionDescription")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || !readiness.isReady}
                >
                  {startMutation.isPending
                    ? t("page.starting")
                    : t("page.startAiWaiter")}
                </Button>
                <Link
                  href={`/customer/session/${sessionId}/menu`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  {t("actions.viewMenu")}
                </Link>
              </div>
              {startMutation.isError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {t("errors.start", {
                    message: formatErrorMessage(startMutation.error)
                  })}
                  <div className="mt-3">
                    <CopyDebugReportButton
                      action="ai_waiter_start"
                      flow="customer_ai_waiter"
                      sessionId={sessionId}
                      error={startMutation.error}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <AiSuggestedPrompts
            language={language}
            onSelect={handlePrompt}
            disabled={sendMutation.isPending || !readiness.isReady}
          />

          <ol className="grid min-h-80 content-end gap-3 rounded-card border bg-surface/55 p-3">
            {messages.length === 0 ? (
              <li>
                <EmptyState
                  title={t("empty.noMessagesTitle")}
                  description={t("empty.noMessagesDescription")}
                />
              </li>
            ) : null}
            {messages.map((item, index) => (
              <AiMessageBubble
                key={`${getStringKey(item)}-${index}`}
                message={item}
                dir={activeLanguage.dir}
                isReplyDisabled={sendMutation.isPending || !readiness.isReady}
                onQuickReply={handleQuickReply}
              />
            ))}
            {sendMutation.isPending ? (
              <li className="rounded-card border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                {t("messages.checkingMenu")}
              </li>
            ) : null}
          </ol>

          {sendMutation.isSuccess ? (
            <div className="rounded-card border border-success bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="me-2 inline size-4" aria-hidden="true" />
              {t("messages.sentSuccess")}
            </div>
          ) : null}

          <AiMessageComposer
            value={message}
            language={activeLanguage}
            onChange={setMessage}
            onLanguageChange={(value) => {
              setLanguage(value);
              setLocalError("");
            }}
            onSubmit={handleSubmit}
            isSending={sendMutation.isPending}
            errorMessage={
              localError ||
              (sendMutation.isError
                ? t("errors.respond", {
                    message: formatErrorMessage(sendMutation.error)
                  })
                : !readiness.isReady
                  ? readiness.message
                : "")
            }
          />
          {sendMutation.isError ? (
            <CopyDebugReportButton
              action="ai_waiter_send_message"
              flow="customer_ai_waiter"
              sessionId={sessionId}
              error={sendMutation.error}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/customer/session/${sessionId}/cart`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <ShoppingBag className="size-4" aria-hidden="true" />
              {t("actions.reviewCart")}
            </Link>
            {aiWaiterQuery.data?.session ? (
              <Button
                variant="ghost"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending || !readiness.isReady}
              >
                <Power className="size-4" aria-hidden="true" />
                {closeMutation.isPending
                  ? t("page.closing")
                  : t("page.closeAiWaiter")}
              </Button>
            ) : null}
          </div>
          {closeMutation.isError ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {t("errors.close", {
                message: formatErrorMessage(closeMutation.error)
              })}
              <div className="mt-3">
                <CopyDebugReportButton
                  action="ai_waiter_close"
                  flow="customer_ai_waiter"
                  sessionId={sessionId}
                  error={closeMutation.error}
                />
              </div>
            </div>
          ) : null}
        </div>
      </AiChatShell>
    </CustomerSessionScreen>
  );
}

function getStringKey(record: Record<string, unknown>) {
  const id = record.id;

  return typeof id === "string" ? id : "ai-message";
}
