"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/i18n-provider";

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
  const t = useTranslations("customer");

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="text-primary">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={onAction} disabled={disabled || pending}>
          {pending ? t("service.sending") : actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
