import {
  getRecord,
  getRecordArray,
  getRecordNumber,
  getRecordString
} from "./staff-format";

export function getOrderEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getOrderRecord(value: unknown) {
  const envelope = getOrderEnvelopeRecord(value);

  return getRecord(envelope.order) ?? envelope;
}

export function getOrderId(value: unknown) {
  return getRecordString(getOrderRecord(value), "id");
}

export function getOrderNumber(value: unknown) {
  const order = getOrderRecord(value);

  return getRecordString(order, "orderNumber") || getOrderId(value);
}

export function getOrderStatus(value: unknown) {
  return getRecordString(getOrderRecord(value), "status");
}

export function getOrderSubmittedAt(value: unknown) {
  const order = getOrderRecord(value);

  return (
    getRecordString(order, "submittedAt") || getRecordString(order, "createdAt")
  );
}

export function getOrderCustomerNote(value: unknown) {
  const order = getOrderRecord(value);

  return (
    getRecordString(order, "customerNote") ||
    getRecordString(order, "notes") ||
    getRecordString(order, "note")
  );
}

export function getOrderSource(value: unknown) {
  return getRecordString(getOrderRecord(value), "source");
}

export function getOrderTotals(value: unknown) {
  return getRecord(getOrderEnvelopeRecord(value).totals);
}

export function getOrderItems(value: unknown) {
  return getRecordArray(getOrderEnvelopeRecord(value).items);
}

export function getOrderEvents(value: unknown) {
  return getRecordArray(getOrderEnvelopeRecord(value).events);
}

export function getOrderTable(value: unknown) {
  return getRecord(getOrderEnvelopeRecord(value).table);
}

export function getOrderFloor(value: unknown) {
  return getRecord(getOrderEnvelopeRecord(value).floor);
}

export function getBillEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getBillRequestRecord(value: unknown) {
  const envelope = getBillEnvelopeRecord(value);

  return getRecord(envelope.billRequest) ?? envelope;
}

export function getBillRequestId(value: unknown) {
  return getRecordString(getBillRequestRecord(value), "id");
}

export function getBillRequestStatus(value: unknown) {
  return getRecordString(getBillRequestRecord(value), "status");
}

export function getBillRequestCreatedAt(value: unknown) {
  const billRequest = getBillRequestRecord(value);

  return (
    getRecordString(billRequest, "requestedAt") ||
    getRecordString(billRequest, "createdAt")
  );
}

export function getBillRequestTable(value: unknown) {
  const envelope = getBillEnvelopeRecord(value);
  const tableSession = getRecord(envelope.tableSession);

  return getRecord(envelope.table) ?? getRecord(tableSession?.table);
}

export function getBillRequestFloor(value: unknown) {
  const envelope = getBillEnvelopeRecord(value);
  const tableSession = getRecord(envelope.tableSession);

  return getRecord(envelope.floor) ?? getRecord(tableSession?.floor);
}

export function getBillTotals(value: unknown) {
  return getRecord(getBillEnvelopeRecord(value).totals);
}

export function getBillableOrders(value: unknown) {
  return getRecordArray(getBillEnvelopeRecord(value).billableOrders);
}

export function getMinorTotal(record: Record<string, unknown> | undefined) {
  return (
    getRecordNumber(record, "subtotalMinor") ||
    getRecordNumber(record, "lineTotalMinorSnapshot")
  );
}

export function getCurrency(record: Record<string, unknown> | undefined) {
  return getRecordString(record, "currency", "EGP");
}
