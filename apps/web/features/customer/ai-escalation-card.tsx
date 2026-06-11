import { HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type AiEscalationCardProps = {
  isPending?: boolean;
  errorMessage?: string;
  successMessage?: string;
  onEscalate: () => void;
};

export function AiEscalationCard({
  isPending,
  errorMessage,
  successMessage,
  onEscalate
}: AiEscalationCardProps) {
  const t = useTranslations("customer.ai");

  return (
    <Card variant="glass" padding="lg">
      <CardHeader>
        <div className="text-primary">
          <HandHeart className="size-6" aria-hidden="true" />
        </div>
        <CardTitle>{t("escalation.title")}</CardTitle>
        <CardDescription>
          {t("escalation.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
          >
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-card border border-success bg-success/10 p-3 text-sm text-success">
            {successMessage}
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button onClick={onEscalate} disabled={isPending}>
          {isPending ? t("escalation.asking") : t("escalation.askHuman")}
        </Button>
      </CardFooter>
    </Card>
  );
}
