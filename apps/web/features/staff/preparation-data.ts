import {
  getRecord,
  getRecordArray,
  getRecordNumber,
  getRecordString
} from "./staff-format";

export function getTaskEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getTaskRecord(value: unknown) {
  const envelope = getTaskEnvelopeRecord(value);

  return getRecord(envelope.task) ?? envelope;
}

export function getTaskId(value: unknown) {
  return getRecordString(getTaskRecord(value), "id");
}

export function getTaskStatus(value: unknown) {
  return getRecordString(getTaskRecord(value), "status");
}

export function getTaskStation(value: unknown) {
  return getRecordString(getTaskRecord(value), "station");
}

export function getTaskQuantity(value: unknown) {
  return getRecordNumber(getTaskRecord(value), "quantity", 1);
}

export function getTaskItemName(value: unknown) {
  const task = getTaskRecord(value);
  const orderItem = getTaskOrderItem(value);

  return (
    getRecordString(task, "itemNameSnapshot") ||
    getRecordString(orderItem, "itemNameSnapshot") ||
    "Preparation item"
  );
}

export function getTaskNotes(value: unknown) {
  const task = getTaskRecord(value);
  const orderItem = getTaskOrderItem(value);

  return getRecordString(task, "notes") || getRecordString(orderItem, "notes");
}

export function getTaskCreatedAt(value: unknown) {
  return getRecordString(getTaskRecord(value), "createdAt");
}

export function getTaskStartedAt(value: unknown) {
  return getRecordString(getTaskRecord(value), "startedAt");
}

export function getTaskReadyAt(value: unknown) {
  return getRecordString(getTaskRecord(value), "readyAt");
}

export function getTaskCancelledAt(value: unknown) {
  return getRecordString(getTaskRecord(value), "cancelledAt");
}

export function getTaskOrder(value: unknown) {
  return getRecord(getTaskEnvelopeRecord(value).order);
}

export function getTaskOrderId(value: unknown) {
  return getRecordString(getTaskOrder(value), "id");
}

export function getTaskOrderNumber(value: unknown) {
  return getRecordString(getTaskOrder(value), "orderNumber");
}

export function getTaskOrderStatus(value: unknown) {
  return getRecordString(getTaskOrder(value), "status");
}

export function getTaskOrderSubmittedAt(value: unknown) {
  const order = getTaskOrder(value);

  return (
    getRecordString(order, "submittedAt") || getRecordString(order, "createdAt")
  );
}

export function getTaskTable(value: unknown) {
  return getRecord(getTaskEnvelopeRecord(value).table);
}

export function getTaskFloor(value: unknown) {
  return getRecord(getTaskEnvelopeRecord(value).floor);
}

export function getTaskOrderItem(value: unknown) {
  return getRecord(getTaskEnvelopeRecord(value).orderItem);
}

export function getTaskModifierOptions(value: unknown) {
  return getRecordArray(getTaskEnvelopeRecord(value).modifierOptions);
}

export function getTaskEvents(value: unknown) {
  return getRecordArray(getTaskEnvelopeRecord(value).events);
}
