const BREADCRUMB_STORAGE_KEY = "balcona.debug.breadcrumbs";
const MAX_BREADCRUMBS = 30;

const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|secret|token|authorization|cookie|api[_-]?key|payload|body|note|message|ai/i;

export type DebugBreadcrumb = {
  timestamp: string;
  action: string;
  route?: string;
  flow?: string;
  result?: "started" | "success" | "failure" | "skipped" | "replayed";
  requestId?: string;
  flowId?: string;
  clientTraceId?: string;
  durationMs?: number;
  status?: number;
};

export type DebugBreadcrumbInput = Omit<DebugBreadcrumb, "timestamp"> & {
  timestamp?: string;
};

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function safeText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized
    .replace(
      /(authorization\s*[:=]\s*bearer\s+)([^,\s}]+)/gi,
      "$1[redacted]"
    )
    .replace(
      /(password|passwd|pwd|secret|token|api[_-]?key|cookie)(\s*[:=]\s*)([^,\s}]+)/gi,
      "$1$2[redacted]"
    )
    .slice(0, 240);
}

export function sanitizeBreadcrumb(
  breadcrumb: DebugBreadcrumbInput
): DebugBreadcrumb {
  return {
    timestamp: breadcrumb.timestamp ?? new Date().toISOString(),
    action: safeText(breadcrumb.action) ?? "unknown_action",
    route: safeText(breadcrumb.route),
    flow: safeText(breadcrumb.flow),
    result: breadcrumb.result,
    requestId: safeText(breadcrumb.requestId),
    flowId: safeText(breadcrumb.flowId),
    clientTraceId: safeText(breadcrumb.clientTraceId),
    durationMs:
      typeof breadcrumb.durationMs === "number" ? breadcrumb.durationMs : undefined,
    status: typeof breadcrumb.status === "number" ? breadcrumb.status : undefined
  };
}

function readStoredBreadcrumbs() {
  if (!storageAvailable()) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(BREADCRUMB_STORAGE_KEY) ?? "[]"
    );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => sanitizeBreadcrumb(item as DebugBreadcrumbInput))
      .slice(-MAX_BREADCRUMBS);
  } catch {
    return [];
  }
}

export function getDebugBreadcrumbs() {
  return readStoredBreadcrumbs();
}

export function addDebugBreadcrumb(input: DebugBreadcrumbInput) {
  const breadcrumb = sanitizeBreadcrumb(input);
  const nextBreadcrumbs = [...readStoredBreadcrumbs(), breadcrumb].slice(
    -MAX_BREADCRUMBS
  );

  if (!storageAvailable()) {
    return nextBreadcrumbs;
  }

  try {
    window.localStorage.setItem(
      BREADCRUMB_STORAGE_KEY,
      JSON.stringify(nextBreadcrumbs)
    );
  } catch {
    return nextBreadcrumbs;
  }

  return nextBreadcrumbs;
}

export function sanitizeBreadcrumbMetadata(value: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof entry === "string") {
      const text = safeText(entry);

      if (text) {
        safe[key] = text;
      }
      continue;
    }

    if (typeof entry === "number" || typeof entry === "boolean") {
      safe[key] = entry;
    }
  }

  return safe;
}
