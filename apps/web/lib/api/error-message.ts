type ErrorRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalizedValue = value.trim();

  return normalizedValue === "[object Object]" ? "" : normalizedValue;
}

function messageFromValue(value: unknown, depth = 0): string {
  if (depth > 4) {
    return "";
  }

  const directText = normalizeText(value);

  if (directText) {
    return directText;
  }

  if (Array.isArray(value)) {
    return value.map((item) => messageFromValue(item, depth + 1)).filter(Boolean).join(", ");
  }

  if (!isRecord(value)) {
    return "";
  }

  const message = messageFromValue(value.message, depth + 1);

  if (message) {
    return message;
  }

  const detailsMessage = messageFromValue(value.details, depth + 1);

  if (detailsMessage) {
    return detailsMessage;
  }

  const errorMessage = messageFromValue(value.error, depth + 1);

  if (errorMessage) {
    return errorMessage;
  }

  return messageFromValue(value.response, depth + 1);
}

function requestIdFromValue(value: unknown, depth = 0): string {
  if (depth > 4 || !isRecord(value)) {
    return "";
  }

  const directRequestId = normalizeText(value.requestId);

  if (directRequestId) {
    return directRequestId;
  }

  return (
    requestIdFromValue(value.error, depth + 1) ||
    requestIdFromValue(value.details, depth + 1) ||
    requestIdFromValue(value.response, depth + 1)
  );
}

export function formatErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
) {
  const message = messageFromValue(error);
  const requestId = requestIdFromValue(error);
  const readableMessage = message || fallback;

  return requestId && !readableMessage.includes(requestId)
    ? `${readableMessage} (Request ID: ${requestId})`
    : readableMessage;
}
