"use client";

import { ClipboardCopy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildDebugReport,
  stringifyDebugReport,
  type DebugReportInput
} from "@/lib/observability/debug-report";
import { shouldShowDebugReportControls } from "@/lib/observability/metadata";

type CopyDebugReportButtonProps = DebugReportInput & {
  label?: string;
};

export function CopyDebugReportButton({
  label = "Copy debug report",
  ...input
}: CopyDebugReportButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!shouldShowDebugReportControls()) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        const report = stringifyDebugReport(buildDebugReport(input));

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
      {copied ? "Copied" : label}
    </Button>
  );
}

