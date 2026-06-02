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
  return (
    <Card variant="glass" padding="lg">
      <CardHeader>
        <div className="text-primary">
          <HandHeart className="size-6" aria-hidden="true" />
        </div>
        <CardTitle>Ask a human waiter</CardTitle>
        <CardDescription>
          If the AI cannot help or you prefer a person, the team can be notified
          calmly without leaving this table experience.
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
          {isPending ? "Asking..." : "Ask a human waiter"}
        </Button>
      </CardFooter>
    </Card>
  );
}
