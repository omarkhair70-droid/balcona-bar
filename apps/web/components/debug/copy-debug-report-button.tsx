"use client";

import { ClipboardCopy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildDebugReport,
  stringifyDebugReport,
  type DebugReportInput
} from "@/lib/observability/debug-report";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { shouldShowDebugReportControls } from "@/lib/observability/metadata";

type CopyDebugReportButtonProps = DebugReportInput & {
  label?: string;
};

export function CopyDebugReportButton({
  label,
  ...input
}: CopyDebugReportButtonProps) {
  const [copied, setCopied] = useState(false);
  const { locale } = useI18n();
  const t = useTranslations("debug");

  if (!shouldShowDebugReportControls()) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        const report = stringifyDebugReport(
          buildDebugReport({ ...input, locale: input.locale ?? locale })
        );

        await navigator.clipboard.writeText(report);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <ClipboardCopy className="size-4" aria-hidden="true" />
      )}
      {copied ? t("copied") : (label ?? t("copyDebugReport"))}
    </Button>
  );
}

