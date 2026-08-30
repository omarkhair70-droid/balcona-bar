import Link from "next/link";
import { CheckCircle2, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { MenuItemSummary } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import {
  describeProposalItem,
  getProposalId,
  getProposalItems,
  getProposalMessage,
  getProposalStatus,
  getProposalTitle
} from "./ai-waiter-helpers";

type AiCartProposalCardProps = {
  sessionId: string;
  proposal?: Record<string, unknown> | null;
  menuItemsById: Map<string, MenuItemSummary>;
  isApplying?: boolean;
  isRejecting?: boolean;
  actionError?: string;
  actionSuccess?: string;
  isSessionReady?: boolean;
  disabledMessage?: string;
  onApply: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
};

export function AiCartProposalCard({
  sessionId,
  proposal,
  menuItemsById,
  isApplying,
  isRejecting,
  actionError,
  actionSuccess,
  isSessionReady = true,
  disabledMessage,
  onApply,
  onReject
}: AiCartProposalCardProps) {
  const t = useTranslations("customer.ai");

  if (!proposal) {
    return (
      <Card variant="quiet">
        <p className="text-sm text-muted-foreground">
          {t("proposal.empty")}
        </p>
      </Card>
    );
  }

  const proposalId = getProposalId(proposal);
  const status = getProposalStatus(proposal);
  const items = getProposalItems(proposal);
  const isActionable =
    Boolean(proposalId) && status === "proposed" && !actionSuccess && isSessionReady;

  return (
    <Card variant="accent" padding="lg">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t("proposal.badge")}</Badge>
        </div>
        <CardTitle>{getProposalTitle(proposal, t)}</CardTitle>
        <CardDescription>
          {t("proposal.disclaimer")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {getProposalMessage(proposal) ? (
          <p className="text-sm text-muted-foreground">
            {getProposalMessage(proposal)}
          </p>
        ) : null}
        {items.length === 0 ? (
          <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
            {t("proposal.missingItemDetails")}
          </div>
        ) : null}
        {items.map((item, index) => {
          const detail = describeProposalItem(item, menuItemsById, t);

          return (
            <div
              key={`${detail.menuItemId || "proposal-item"}-${index}`}
              className="rounded-card border bg-surface/80 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {detail.quantity}x {detail.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {detail.detail}
                  </p>
                </div>
                {detail.price ? (
                  <span className="text-sm font-semibold text-primary">
                    {detail.price}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="rounded-card border border-success/40 bg-success/10 p-3 text-sm text-success">
          <ShieldCheck className="me-2 inline size-4" aria-hidden="true" />
          {t("proposal.backendValidationNotice")}
        </div>
        {actionError ? (
          <div
            role="alert"
            className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
          >
            {actionError}
          </div>
        ) : null}
        {!isSessionReady && disabledMessage ? (
          <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
            {disabledMessage}
          </div>
        ) : null}
        {actionSuccess ? (
          <div className="rounded-card border border-success bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="mr-2 inline size-4" aria-hidden="true" />
            {actionSuccess}
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => proposalId && onApply(proposalId)}
          disabled={!isActionable || isApplying || isRejecting}
        >
          {isApplying ? t("proposal.applying") : t("proposal.applyToCart")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => proposalId && onReject(proposalId)}
          disabled={!isActionable || isApplying || isRejecting}
        >
          <X className="size-4" aria-hidden="true" />
          {isRejecting ? t("proposal.rejecting") : t("proposal.reject")}
        </Button>
        <Link
          href={`/guest/session/${sessionId}/cart`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("actions.reviewCart")}
        </Link>
      </CardFooter>
    </Card>
  );
}
