import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function recordsFrom(value: unknown, keys: string[]): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord);
  }

  const record = asRecord(value);

  for (const key of keys) {
    const records = asRecords(record[key]);

    if (records.length > 0 || Array.isArray(record[key])) {
      return records;
    }
  }

  return [];
}

export function textValue(value: unknown, fallback = "—") {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function booleanValue(value: unknown) {
  return value === true;
}

export function formatOfficeDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatMinor(value: unknown, currency = "EGP") {
  const amount = numberValue(value);

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EGP",
  }).format(amount / 100);
}

export function OfficeStatusBadge({ value }: { value: unknown }) {
  const normalized = textValue(value, "unknown").toLowerCase();
  const variant =
    ["active", "succeeded", "completed", "matched", "resolved", "enabled"].includes(
      normalized,
    )
      ? "success"
      : ["pending", "processing", "running", "acknowledged", "warning"].includes(
            normalized,
          )
        ? "warning"
        : ["failed", "cancelled", "expired", "mismatch", "disabled"].includes(
              normalized,
            )
          ? "danger"
          : "muted";

  return <Badge variant={variant}>{normalized.replaceAll("_", " ")}</Badge>;
}

export function OfficeControlSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 border-[#DADAD5] bg-white shadow-none">
      <CardHeader className="gap-3 border-b border-[#E6E6E1] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1 max-w-3xl text-xs leading-5">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="min-w-0 pt-4">{children}</CardContent>
    </Card>
  );
}

export function OfficeFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#E4E4DF] bg-[#FAFAF7] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81817A]">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm font-semibold text-[#282824]">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] leading-4 text-[#797973]">{hint}</p>
      ) : null}
    </div>
  );
}

export function OfficeInlineNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#DEDCD4] bg-[#F8F7F2] p-3">
      <p className="text-xs font-semibold text-[#34342F]">{title}</p>
      <div className="mt-1 text-xs leading-5 text-[#707069]">{children}</div>
    </div>
  );
}
