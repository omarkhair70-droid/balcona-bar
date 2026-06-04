"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Power, ShoppingBag } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
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
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateLight, vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { AiCartProposalCard } from "../ai-cart-proposal-card";
import { AiChatShell } from "../ai-chat-shell";
import { AiEscalationCard } from "../ai-escalation-card";
import { AiMessageBubble } from "../ai-message-bubble";
import { AiMessageComposer } from "../ai-message-composer";
import { AiSuggestedPrompts } from "../ai-suggested-prompts";
import {
  aiLanguageOptions,
  getAiWaiterExperience,
  getRecord
} from "../ai-waiter-helpers";
import { AiWaiterStatusPill } from "../ai-waiter-status-pill";
import { CartSummary } from "../cart-summary";
import { CustomerSessionScreen } from "../customer-session-screen";

type AiWaiterPageProps = {
  sessionId: string;
};

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

function getLatestProposal(
  stateProposal?: Record<string, unknown> | null,
  mutationProposal?: Record<string, unknown> | null
) {
  return mutationProposal ?? stateProposal ?? null;
}

export function AiWaiterPage({ sessionId }: AiWaiterPageProps) {
  const queryClient = useQueryClient();
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const branchId = useCustomerSessionStore((state) => state.branchId);
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
    queryFn: () => getCurrentAiWaiterSession(sessionId, token),
    staleTime: 10_000,
    retry: 1
  });
  const aiMessagesQuery = useQuery({
    queryKey: customerQueryKeys.aiWaiterMessages(sessionId),
    queryFn: () => listAiWaiterMessages(sessionId, { limit: 50 }, token),
    enabled: Boolean(aiWaiterQuery.data?.session),
    staleTime: 10_000,
    retry: 1
  });
  const menuQuery = useQuery({
    queryKey: customerQueryKeys.menu(branchId),
    queryFn: () => getBranchMenu(branchId ?? "", token),
    enabled: Boolean(branchId),
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
    mutationFn: () => startAiWaiter(sessionId, { language }, token),
    onSuccess: () => {
      setLocalError("");
      invalidateAiWaiter(queryClient, sessionId);
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const sendMutation = useMutation({
    mutationFn: (value: string) =>
      sendAiWaiterMessage(sessionId, { message: value, language }, token),
    onSuccess: () => {
      setMessage("");
      setLocalError("");
      setProposalNotice("");
      invalidateAiWaiter(queryClient, sessionId);
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const applyMutation = useMutation({
    mutationFn: (proposalId: string) => applyAiCartProposal(proposalId, token),
    onSuccess: () => {
      setProposalNotice(
        "Proposal applied to your cart. Please review the cart before submitting the order."
      );
      invalidateAiWaiter(queryClient, sessionId);
      invalidateCustomerState(queryClient, sessionId);
      vibrateSuccess();
    },
    onError: () => vibrateWarning()
  });
  const rejectMutation = useMutation({
    mutationFn: (proposalId: string) =>
      rejectAiCartProposal(proposalId, { reason: "customer_declined" }, token),
    onSuccess: () => {
      setProposalNotice("Proposal rejected. You can ask for a different suggestion.");
      invalidateAiWaiter(queryClient, sessionId);
      vibrateLight();
    },
    onError: () => vibrateWarning()
  });
  const escalationMutation = useMutation({
    mutationFn: () =>
      escalateAiWaiter(
        sessionId,
        {
          reason: "customer_requested_human",
          message: "Customer asked for a human waiter from the AI waiter UI."
        },
        token
      ),
    onSuccess: () => {
      setEscalationNotice("A human waiter has been notified for your table.");
      invalidateAiWaiter(queryClient, sessionId);
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.waiterCalls(sessionId)
      });
      vibrateSuccess();
    },
    onError: () => vibrateWarning()
  });
  const closeMutation = useMutation({
    mutationFn: () => closeAiWaiter(sessionId, token),
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
      ? `We could not apply this proposal. ${applyMutation.error.message}`
      : rejectMutation.isError
        ? `We could not reject this proposal. ${rejectMutation.error.message}`
        : undefined;

  function handleSubmit() {
    const normalized = message.trim();

    if (!normalized) {
      setLocalError("Write a message or choose a suggested prompt first.");
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
    setLocalError("");
    sendMutation.mutate(reply);
  }

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="service"
      eyebrow="AI waiter"
      title="AI café concierge"
      description="Ask for recommendations, review safe cart proposals, and keep final order submission in the cart."
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
              onApply={(proposalId) => applyMutation.mutate(proposalId)}
              onReject={(proposalId) => rejectMutation.mutate(proposalId)}
            />
            <AiEscalationCard
              isPending={escalationMutation.isPending}
              successMessage={escalationNotice}
              errorMessage={
                escalationMutation.isError
                  ? `We could not notify the team yet. ${escalationMutation.error.message}`
                  : undefined
              }
              onEscalate={() => escalationMutation.mutate()}
            />
            <CartSummary
              sessionId={sessionId}
              cart={cartSummary}
            />
          </>
        }
      >
        <div className="grid gap-4" dir={activeLanguage.dir}>
          {aiWaiterQuery.isPending ? (
            <LoadingState label="Loading AI waiter" />
          ) : null}
          {aiWaiterQuery.isError ? (
            <EmptyState
              title="AI waiter could not load"
              description={aiWaiterQuery.error.message}
              action={<AlertTriangle className="size-5 text-warning" aria-hidden="true" />}
            />
          ) : null}
          {!aiWaiterQuery.data?.session && aiWaiterQuery.isSuccess ? (
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                No AI waiter session is active yet.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start one or send a prompt. Suggestions will use this branch
                menu and availability.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                >
                  {startMutation.isPending ? "Starting..." : "Start AI waiter"}
                </Button>
                <Link
                  href={`/customer/session/${sessionId}/menu`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  View menu
                </Link>
              </div>
              {startMutation.isError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  AI waiter could not start. {startMutation.error.message}
                </div>
              ) : null}
            </div>
          ) : null}

          <AiSuggestedPrompts
            language={language}
            onSelect={handlePrompt}
            disabled={sendMutation.isPending}
          />

          <ol className="grid min-h-80 content-end gap-3 rounded-card border bg-surface/55 p-3">
            {messages.length === 0 ? (
              <li>
                <EmptyState
                  title="No messages yet"
                  description="Ask for a menu-grounded recommendation or choose a prompt to begin."
                />
              </li>
            ) : null}
            {messages.map((item, index) => (
              <AiMessageBubble
                key={`${getStringKey(item)}-${index}`}
                message={item}
                dir={activeLanguage.dir}
                isReplyDisabled={sendMutation.isPending}
                onQuickReply={handleQuickReply}
              />
            ))}
            {sendMutation.isPending ? (
              <li className="rounded-card border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                AI waiter is checking the branch menu and availability...
              </li>
            ) : null}
          </ol>

          {sendMutation.isSuccess ? (
            <div className="rounded-card border border-success bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="mr-2 inline size-4" aria-hidden="true" />
              Message sent. Any cart proposal still needs your confirmation.
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
                ? `AI waiter could not respond. ${sendMutation.error.message}`
                : "")
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/customer/session/${sessionId}/cart`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <ShoppingBag className="size-4" aria-hidden="true" />
              Review cart
            </Link>
            {aiWaiterQuery.data?.session ? (
              <Button
                variant="ghost"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                <Power className="size-4" aria-hidden="true" />
                {closeMutation.isPending ? "Closing..." : "Close AI waiter"}
              </Button>
            ) : null}
          </div>
          {closeMutation.isError ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              AI waiter could not close. {closeMutation.error.message}
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
