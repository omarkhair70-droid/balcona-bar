import {
  getRecord,
  getRecordArray,
  getRecordNumber,
  getRecordString
} from "./staff-format";

export function getWaiterCallEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getWaiterCallRecord(value: unknown) {
  const envelope = getWaiterCallEnvelopeRecord(value);

  return getRecord(envelope.waiterCall) ?? envelope;
}

export function getWaiterCallId(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "id");
}

export function getWaiterCallStatus(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "status");
}

export function getWaiterCallType(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "type");
}

export function getWaiterCallPriority(value: unknown) {
  return getRecordNumber(getWaiterCallRecord(value), "priority");
}

export function getWaiterCallMessage(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "message");
}

export function getWaiterCallCreatedAt(value: unknown) {
  const waiterCall = getWaiterCallRecord(value);

  return (
    getRecordString(waiterCall, "createdAt") ||
    getRecordString(waiterCall, "requestedAt")
  );
}

export function getWaiterCallAcknowledgedAt(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "acknowledgedAt");
}

export function getWaiterCallResolvedAt(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "resolvedAt");
}

export function getWaiterCallCancelledAt(value: unknown) {
  return getRecordString(getWaiterCallRecord(value), "cancelledAt");
}

export function getWaiterCallTableSession(value: unknown) {
  return getRecord(getWaiterCallEnvelopeRecord(value).tableSession);
}

export function getWaiterCallSessionStatus(value: unknown) {
  return getRecordString(getWaiterCallTableSession(value), "status");
}

export function getWaiterCallTable(value: unknown) {
  const envelope = getWaiterCallEnvelopeRecord(value);
  const tableSession = getWaiterCallTableSession(value);

  return getRecord(envelope.table) ?? getRecord(tableSession?.table);
}

export function getWaiterCallFloor(value: unknown) {
  const envelope = getWaiterCallEnvelopeRecord(value);
  const tableSession = getWaiterCallTableSession(value);

  return getRecord(envelope.floor) ?? getRecord(tableSession?.floor);
}

export function getWaiterCallOrder(value: unknown) {
  return getRecord(getWaiterCallEnvelopeRecord(value).order);
}

export function getWaiterCallOrderNumber(value: unknown) {
  const order = getWaiterCallOrder(value);

  return getRecordString(order, "orderNumber") || getRecordString(order, "id");
}

export function getWaiterCallOrderStatus(value: unknown) {
  return getRecordString(getWaiterCallOrder(value), "status");
}

export function getWaiterCallEvents(value: unknown) {
  return getRecordArray(getWaiterCallEnvelopeRecord(value).events);
}
