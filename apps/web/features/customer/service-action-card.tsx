import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceActionCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  pending?: boolean;
};

export function ServiceActionCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  disabled,
  pending
}: ServiceActionCardProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="text-primary">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={onAction} disabled={disabled || pending}>
          {pending ? "Sending..." : actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
