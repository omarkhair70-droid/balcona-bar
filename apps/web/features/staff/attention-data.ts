import {
  getRecord,
  getRecordNumber,
  getRecordString,
  humanizeStatus
} from "./staff-format";

export function getAttentionEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getAttentionRecord(value: unknown) {
  const envelope = getAttentionEnvelopeRecord(value);
  const directAttention = getRecord(envelope.attention);
  const nestedAttention = getRecord(directAttention?.attention);

  return nestedAttention ?? directAttention ?? envelope;
}

export function getAttentionId(value: unknown) {
  return getRecordString(getAttentionRecord(value), "id");
}

export function getAttentionStatus(value: unknown) {
  return getRecordString(getAttentionRecord(value), "status");
}

export function getAttentionPriority(value: unknown) {
  return getRecordString(getAttentionRecord(value), "priority");
}

export function getAttentionScore(value: unknown) {
  return getRecordNumber(getAttentionRecord(value), "score");
}

export function getAttentionLastEvaluatedAt(value: unknown) {
  return getRecordString(getAttentionRecord(value), "lastEvaluatedAt");
}

export function getAttentionMutedUntil(value: unknown) {
  return getRecordString(getAttentionRecord(value), "mutedUntil");
}

export function getAttentionResolvedAt(value: unknown) {
  return getRecordString(getAttentionRecord(value), "resolvedAt");
}

export function getAttentionTableSession(value: unknown) {
  const envelope = getAttentionEnvelopeRecord(value);
  const directAttention = getRecord(envelope.attention);

  return (
    getRecord(envelope.tableSession) ??
    getRecord(directAttention?.tableSession) ??
    getRecord(getAttentionRecord(value).tableSession)
  );
}

export function getAttentionSessionId(value: unknown) {
  const attention = getAttentionRecord(value);

  return (
    getRecordString(attention, "tableSessionId") ||
    getRecordString(getAttentionTableSession(value), "id")
  );
}

export function getAttentionTable(value: unknown) {
  return getRecord(getAttentionTableSession(value)?.table);
}

export function getAttentionFloor(value: unknown) {
  return getRecord(getAttentionTableSession(value)?.floor);
}

export function getAttentionReasons(value: unknown) {
  const reasons = getAttentionRecord(value).reasons;

  return Array.isArray(reasons) ? reasons : [];
}

export function getAttentionRecommendedActions(value: unknown) {
  const actions = getAttentionRecord(value).recommendedActions;

  return Array.isArray(actions) ? actions : [];
}

export function getAttentionReasonMessage(reason: unknown, fallback = "Reason") {
  if (typeof reason === "string") {
    return humanizeStatus(reason);
  }

  const record = getRecord(reason);

  return (
    getRecordString(record, "message") ||
    humanizeStatus(getRecordString(record, "reason")) ||
    fallback
  );
}

export function getAttentionReasonLabel(reason: unknown, fallback = "attention") {
  if (typeof reason === "string") {
    return humanizeStatus(reason);
  }

  return humanizeStatus(getRecordString(getRecord(reason), "reason")) || fallback;
}

export function getAttentionActionLabel(action: unknown) {
  return typeof action === "string"
    ? humanizeStatus(action)
    : humanizeStatus(getRecordString(getRecord(action), "action", "review"));
}
