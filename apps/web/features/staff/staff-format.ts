export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}

export function getRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function getRecordString(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = ""
) {
  const value = record?.[key];

  return typeof value === "string" ? value : fallback;
}

export function getRecordNumber(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = 0
) {
  const value = record?.[key];

  return typeof value === "number" ? value : fallback;
}

export function getRecordBoolean(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = false
) {
  const value = record?.[key];

  return typeof value === "boolean" ? value : fallback;
}

export function formatMoney(minor = 0, currency = "EGP") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function humanizeStatus(status?: string) {
  if (!status) {
    return "Unknown";
  }

  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function shortId(value?: string) {
  return value ? value.slice(0, 8) : "unknown";
}

export function getTableLabel(
  table?: Record<string, unknown>,
  floor?: Record<string, unknown> | null
) {
  const displayName =
    getRecordString(table, "displayName") || getRecordString(table, "code");
  const floorName = getRecordString(floor ?? undefined, "name");

  if (displayName && floorName) {
    return `${floorName} / ${displayName}`;
  }

  return displayName || "Table";
}
