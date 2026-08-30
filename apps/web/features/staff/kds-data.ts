import {
  getRecord,
  getRecordArray,
  getRecordNumber,
  getRecordString,
  getTableLabel
} from "./staff-format";

export function getTicketEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getTicketRecord(value: unknown) {
  const envelope = getTicketEnvelopeRecord(value);

  return getRecord(envelope.ticket) ?? envelope;
}

export function getTicketId(value: unknown) {
  return getRecordString(getTicketRecord(value), "id");
}

export function getTicketDisplayCode(value: unknown) {
  return (
    getRecordString(getTicketRecord(value), "displayCode") ||
    getTicketId(value)
  );
}

export function getTicketStatus(value: unknown) {
  return getRecordString(getTicketRecord(value), "status");
}

export function getTicketStation(value: unknown) {
  return getRecordString(getTicketRecord(value), "station");
}

export function getTicketOrder(value: unknown) {
  return getRecord(getTicketEnvelopeRecord(value).order);
}

export function getTicketOrderNumber(value: unknown) {
  return (
    getRecordString(getTicketOrder(value), "orderNumber") ||
    getRecordString(getTicketRecord(value), "orderNumberSnapshot")
  );
}

export function getTicketTable(value: unknown) {
  return getRecord(getTicketEnvelopeRecord(value).table);
}

export function getTicketFloor(value: unknown) {
  return getRecord(getTicketEnvelopeRecord(value).floor);
}

export function getTicketLocationLabel(value: unknown) {
  const liveLabel = getTableLabel(getTicketTable(value), getTicketFloor(value));

  if (liveLabel !== "Table") {
    return liveLabel;
  }

  const ticket = getTicketRecord(value);
  const tableCode = getRecordString(ticket, "tableCodeSnapshot");
  const floorName = getRecordString(ticket, "floorNameSnapshot");

  if (tableCode && floorName) {
    return `${floorName} / ${tableCode}`;
  }

  return tableCode || "Table";
}

export function getTicketItems(value: unknown) {
  return getRecordArray(getTicketEnvelopeRecord(value).items);
}

export function getTicketPrintJobs(value: unknown) {
  return getRecordArray(getTicketEnvelopeRecord(value).printJobs);
}

export function getTicketCreatedAt(value: unknown) {
  return getRecordString(getTicketRecord(value), "createdAt");
}

export function getTicketCustomerNote(value: unknown) {
  return getRecordString(getTicketRecord(value), "customerNoteSnapshot");
}

export function getTicketItemName(value: unknown) {
  return getRecordString(getRecord(value), "itemNameSnapshot", "Ticket item");
}

export function getTicketItemQuantity(value: unknown) {
  return getRecordNumber(getRecord(value), "quantity", 1);
}

export function getTicketItemNotes(value: unknown) {
  return getRecordString(getRecord(value), "notes");
}

export function getTicketItemModifiers(value: unknown) {
  return getRecordArray(getRecord(value)?.modifiersSnapshot);
}

export function getPrintJobEnvelopeRecord(value: unknown) {
  return getRecord(value) ?? {};
}

export function getPrintJobRecord(value: unknown) {
  const envelope = getPrintJobEnvelopeRecord(value);

  return getRecord(envelope.printJob) ?? envelope;
}

export function getPrintJobId(value: unknown) {
  return getRecordString(getPrintJobRecord(value), "id");
}

export function getPrintJobStatus(value: unknown) {
  return getRecordString(getPrintJobRecord(value), "status");
}

export function getPrintJobKind(value: unknown) {
  return getRecordString(getPrintJobRecord(value), "kind");
}

export function getPrintJobCreatedAt(value: unknown) {
  return getRecordString(getPrintJobRecord(value), "createdAt");
}

export function getPrintJobError(value: unknown) {
  return getRecordString(getPrintJobRecord(value), "errorMessage");
}

export function getPrintJobPrintableText(value: unknown) {
  return getRecordString(getPrintJobRecord(value), "printableText");
}

export function getPrintJobTicket(value: unknown) {
  return getRecord(getPrintJobEnvelopeRecord(value).kitchenTicket);
}

export function getPrintJobPrinterStation(value: unknown) {
  return getRecord(getPrintJobEnvelopeRecord(value).printerStation);
}

export function getPrinterStationName(value: unknown) {
  return getRecordString(getRecord(value), "name", "Printer station");
}

export function getPrinterStationStatus(value: unknown) {
  return getRecordString(getRecord(value), "status");
}
