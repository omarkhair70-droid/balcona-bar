"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Receipt,
  ShoppingBag,
  UsersRound
} from "lucide-react";
import {
  getOrderNumber,
  getOrderStatus
} from "@/features/staff/cashier-data";
import {
  formatMoney,
  getRecord,
  getRecordNumber,
  getRecordString,
  humanizeStatus
} from "@/features/staff/staff-format";
import type {
  BillResult,
  BranchAdminOverviewResult,
  BranchAdminTable
} from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type ServiceFloorBoardProps = {
  overview?: BranchAdminOverviewResult;
  isLoading?: boolean;
  error?: Error;
  selectedSessionId?: string;
  onSelectSession?: (sessionId?: string) => void;
  sessionOrders?: Record<string, unknown>[];
  sessionBill?: BillResult;
  contextLoading?: boolean;
  onOpenOrders?: () => void;
  onOpenAttention?: () => void;
  onOpenBills?: () => void;
};

type FloorGroup = {
  id: string;
  name: string;
  tables: BranchAdminTable[];
};

type TableTone =
  | "urgent"
  | "attention"
  | "maintenance"
  | "inactive"
  | "occupied"
  | "free";

type FloorSlot = {
  left: number;
  top: number;
  width: number;
  height: number;
  shape: "round" | "wide" | "square";
};

const floorSlots: FloorSlot[] = [
  { left: 6, top: 54, width: 20, height: 116, shape: "round" },
  { left: 31, top: 40, width: 18, height: 132, shape: "square" },
  { left: 59, top: 36, width: 25, height: 108, shape: "wide" },
  { left: 9, top: 236, width: 22, height: 106, shape: "wide" },
  { left: 39, top: 218, width: 20, height: 118, shape: "round" },
  { left: 69, top: 220, width: 18, height: 116, shape: "square" },
  { left: 27, top: 394, width: 24, height: 104, shape: "wide" },
  { left: 62, top: 390, width: 22, height: 106, shape: "wide" }
];

function slotForTable(index: number) {
  const base = floorSlots[index % floorSlots.length];
  const cycle = Math.floor(index / floorSlots.length);

  return {
    ...base,
    top: base.top + cycle * 470
  };
}

function getDefaultFloorTable(tables: BranchAdminTable[]) {
  return (
    tables.find((table) => getTableTone(table) === "urgent") ??
    tables.find((table) => getTableTone(table) === "attention") ??
    tables.find((table) => table.activeSession) ??
    tables[0]
  );
}

function getTableTone(table: BranchAdminTable): TableTone {
  const attention = table.activeSession?.tableAttentionSnapshot;
  const attentionStatus = attention?.status;
  const attentionPriority = attention?.priority;

  if (attentionStatus === "urgent" || attentionPriority === "urgent") {
    return "urgent";
  }

  if (
    attentionStatus === "needs_attention" ||
    attentionPriority === "high"
  ) {
    return "attention";
  }

  if (table.status === "maintenance") {
    return "maintenance";
  }

  if (table.status === "inactive") {
    return "inactive";
  }

  if (table.activeSession) {
    return "occupied";
  }

  return "free";
}

function getElapsedMinutes(startedAt: string | undefined, now: number) {
  if (!startedAt) {
    return null;
  }

  const started = new Date(startedAt).getTime();

  if (!Number.isFinite(started)) {
    return null;
  }

  return Math.max(0, Math.floor((now - started) / 60_000));
}

function formatElapsed(minutes: number | null) {
  if (minutes === null) {
    return "—";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function tableToneClasses(tone: TableTone) {
  if (tone === "urgent") {
    return "border-[#C55D52] bg-[#5A2925] text-[#FFE7E3]";
  }

  if (tone === "attention") {
    return "border-[#C18C37] bg-[#554018] text-[#FFF0C7]";
  }

  if (tone === "occupied") {
    return "border-[#667061] bg-[#33382F] text-[#F0F0E7]";
  }

  if (tone === "maintenance") {
    return "border-[#6A563D] bg-[#332A20] text-[#D8C3A6]";
  }

  if (tone === "inactive") {
    return "border-[#342B24] bg-[#1A1512] text-[#746A62] opacity-65";
  }

  return "border-[#4A4540] bg-[#292724] text-[#C7C1BB]";
}

function tableShapeClasses(shape: FloorSlot["shape"]) {
  if (shape === "round") {
    return "rounded-full";
  }

  if (shape === "wide") {
    return "rounded-[22px]";
  }

  return "rounded-xl";
}

export function ServiceFloorBoard({
  overview,
  isLoading,
  error,
  selectedSessionId,
  onSelectSession,
  sessionOrders = [],
  sessionBill,
  contextLoading,
  onOpenOrders,
  onOpenAttention,
  onOpenBills
}: ServiceFloorBoardProps) {
  const t = useTranslations("staff");
  const [now, setNow] = useState(() => Date.now());
  const [selectedFloorId, setSelectedFloorId] = useState<string>();
  const [selectedTableId, setSelectedTableId] = useState<string>();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo<FloorGroup[]>(() => {
    if (!overview) {
      return [];
    }

    const mapped = overview.tablesByFloor.map((group) => ({
      id: group.id,
      name: group.name,
      tables: group.tables
    }));

    if (overview.ungroupedTables.length > 0) {
      mapped.push({
        id: "ungrouped",
        name: t("serviceFloor.ungrouped"),
        tables: overview.ungroupedTables
      });
    }

    return mapped;
  }, [overview, t]);

  const activeFloor =
    groups.find((group) => group.id === selectedFloorId) ?? groups[0];

  const selectedTable =
    activeFloor?.tables.find(
      (table) => table.activeSession?.id === selectedSessionId
    ) ??
    activeFloor?.tables.find((table) => table.id === selectedTableId) ??
    getDefaultFloorTable(activeFloor?.tables ?? []);

  const selectedTableSessionId = selectedTable?.activeSession?.id;

  useEffect(() => {
    if (selectedTableSessionId !== selectedSessionId) {
      onSelectSession?.(selectedTableSessionId);
    }
  }, [onSelectSession, selectedSessionId, selectedTableSessionId]);

  const selectedTone = selectedTable ? getTableTone(selectedTable) : undefined;
  const selectedSession = selectedTable?.activeSession;
  const selectedAttention = selectedSession?.tableAttentionSnapshot;
  const selectedElapsed = formatElapsed(
    getElapsedMinutes(selectedSession?.startedAt, now)
  );

  const activeOrder = sessionOrders[0];
  const billEnvelope = getRecord(sessionBill);
  const activeBill =
    getRecord(billEnvelope?.activeBill) ?? getRecord(billEnvelope?.bill);
  const activeBillRequest =
    getRecord(billEnvelope?.activeBillRequest) ??
    getRecord(billEnvelope?.billRequest);
  const billTotals = getRecord(billEnvelope?.totals);
  const billStatus =
    getRecordString(activeBill, "status") ||
    getRecordString(activeBillRequest, "status");
  const billNumber =
    getRecordString(activeBill, "billNumber") ||
    getRecordString(activeBill, "id") ||
    getRecordString(activeBillRequest, "id");
  const billBalanceMinor =
    getRecordNumber(billTotals, "balanceDueMinor") ||
    getRecordNumber(billTotals, "totalMinor");
  const billCurrency =
    getRecordString(billTotals, "currency") ||
    getRecordString(activeBill, "currency", "EGP");
  const canvasCycles = activeFloor
    ? Math.max(1, Math.ceil(activeFloor.tables.length / floorSlots.length))
    : 1;
  const canvasHeight = 540 + (canvasCycles - 1) * 470;

  const selectFloor = (group: FloorGroup) => {
    const nextTable = getDefaultFloorTable(group.tables);

    setSelectedFloorId(group.id);
    setSelectedTableId(nextTable?.id);
    onSelectSession?.(nextTable?.activeSession?.id);
  };

  const selectTable = (table: BranchAdminTable) => {
    setSelectedTableId(table.id);
    onSelectSession?.(table.activeSession?.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-[#1E1814] p-4 text-sm text-[#A99B8E]">
        {t("serviceFloor.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="min-h-[calc(100vh-8rem)] bg-[#1E1814] p-4 text-sm text-[#E4A199]"
      >
        {error.message}
      </div>
    );
  }

  if (!activeFloor) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-[#1E1814] p-4 text-sm text-[#91857A]">
        {t("serviceFloor.empty")}
      </div>
    );
  }

  return (
    <section className="min-h-[calc(100vh-8rem)] bg-[#1E1814]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#352B24] bg-[#17120F] px-3 py-2.5">
        <div
          className="flex items-center gap-1 overflow-x-auto"
          aria-label={t("serviceFloor.areaNavigation")}
        >
          {groups.map((group) => {
            const active = activeFloor.id === group.id;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => selectFloor(group)}
                className={cn(
                  "min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition",
                  active
                    ? "bg-[#E8DED4] text-[#241A14]"
                    : "text-[#AFA195] hover:bg-[#292019]"
                )}
              >
                {group.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#A89A8E]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#5E6254]" />
            {t("serviceFloor.state.occupied")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#B48634]" />
            {t("serviceFloor.state.attention")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#B75349]" />
            {t("serviceFloor.state.urgent")}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 p-3 lg:p-4">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
                {t("serviceFloor.eyebrow")}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#FFF5E8]">
                {activeFloor.name}
              </h2>
            </div>
            <p className="text-[11px] text-[#8F8176]">
              {t("serviceFloor.occupiedCount", {
                count: activeFloor.tables.filter((table) => table.activeSession)
                  .length
              })}
            </p>
          </div>

          <div
            className="relative hidden overflow-hidden rounded-xl border border-[#38302A] bg-[#11100F] shadow-inner md:block"
            style={{ minHeight: canvasHeight }}
          >
            <div className="absolute inset-4 rounded-lg border border-dashed border-[#2E2925]" />
            <div className="absolute inset-x-[8%] top-[36%] border-t border-dashed border-[#28231F]" />
            <div className="absolute bottom-[20%] top-[7%] start-[31%] border-s border-dashed border-[#28231F]" />

            {activeFloor.tables.map((table, index) => {
              const slot = slotForTable(index);
              const tone = getTableTone(table);
              const selected = selectedTable?.id === table.id;
              const session = table.activeSession;
              const elapsed = formatElapsed(
                getElapsedMinutes(session?.startedAt, now)
              );

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => selectTable(table)}
                  style={{
                    left: `${slot.left}%`,
                    top: slot.top,
                    width: `${slot.width}%`,
                    height: slot.height
                  }}
                  className={cn(
                    "absolute flex min-h-[76px] min-w-[76px] flex-col items-center justify-center border-2 p-2 text-center transition",
                    tableShapeClasses(slot.shape),
                    tableToneClasses(tone),
                    selected
                      ? "ring-2 ring-[#E5A65E] ring-offset-2 ring-offset-[#11100F]"
                      : "hover:brightness-110"
                  )}
                >
                  {session ? (
                    <span className="text-[10px] font-bold opacity-80">
                      {elapsed}
                    </span>
                  ) : null}
                  <span className="mt-0.5 text-2xl font-black leading-none">
                    {table.code.replace(/^T/i, "") || table.code}
                  </span>
                  <span className="mt-1 max-w-full text-[9px] font-semibold uppercase tracking-[0.05em] opacity-80">
                    {t(`serviceFloor.state.${tone}`)}
                  </span>
                </button>
              );
            })}

          </div>

          <div className="grid gap-2 md:hidden">
            {activeFloor.tables.map((table) => {
              const tone = getTableTone(table);
              const elapsed = formatElapsed(
                getElapsedMinutes(table.activeSession?.startedAt, now)
              );
              const selected = selectedTable?.id === table.id;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => selectTable(table)}
                  className={cn(
                    "flex min-h-16 items-center justify-between rounded-lg border p-3 text-start",
                    tableToneClasses(tone),
                    selected && "ring-2 ring-[#E5A65E]"
                  )}
                >
                  <div>
                    <p className="text-lg font-black">{table.code}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.08em] opacity-80">
                      {t(`serviceFloor.state.${tone}`)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-semibold">
                      {table.activeSession ? elapsed : "—"}
                    </p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {t("serviceFloor.capacity", {
                        count: table.capacity ?? 0
                      })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="border-t border-[#352B24] bg-[#17120F] p-4 lg:border-s lg:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
            {t("serviceFloor.tableContext")}
          </p>

          {selectedTable ? (
            <>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-4xl font-black text-[#FFF5E8]">
                    {selectedTable.code}
                  </p>
                  <p className="mt-1 text-xs text-[#93867B]">
                    {selectedSession
                      ? t("serviceFloor.sessionActive")
                      : t("serviceFloor.noSession")}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                    selectedTone && tableToneClasses(selectedTone)
                  )}
                >
                  {selectedSession ? selectedElapsed : t("serviceFloor.state.free")}
                </span>
              </div>

              {selectedSession ? (
                <div className="mt-5 grid gap-2">
                  {contextLoading ? (
                    <div className="rounded-md border border-[#3D342D] bg-[#211A15] p-3 text-xs text-[#93867B]">
                      {t("serviceFloor.contextLoading")}
                    </div>
                  ) : null}

                  {selectedAttention ? (
                    <button
                      type="button"
                      onClick={onOpenAttention}
                      className="rounded-md border border-[#714D34] bg-[#2D2319] p-3 text-start transition hover:border-[#9A6942]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#B68C64]">
                            {t("serviceShell.attention")}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#F1DDC8]">
                            {humanizeStatus(selectedAttention.priority)} ·{" "}
                            {humanizeStatus(selectedAttention.status)}
                          </p>
                          <p className="mt-1 text-xs text-[#A78D78]">
                            {t("serviceFloor.score", {
                              score: selectedAttention.score
                            })}
                          </p>
                        </div>
                        <AlertTriangle
                          className="size-4 shrink-0 text-[#D59A60]"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#C6A487]">
                        {t("serviceFloor.openAttention")}
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </p>
                    </button>
                  ) : null}

                  {activeOrder ? (
                    <button
                      type="button"
                      onClick={onOpenOrders}
                      className="rounded-md border border-[#3D342D] bg-[#211A15] p-3 text-start transition hover:border-[#5A493E]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8D8075]">
                            {t("serviceFloor.orderContext")}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#F4E8DA]">
                            {getOrderNumber(activeOrder)}
                          </p>
                          <p className="mt-1 text-xs text-[#9C8F83]">
                            {humanizeStatus(getOrderStatus(activeOrder))}
                          </p>
                        </div>
                        <ShoppingBag
                          className="size-4 shrink-0 text-[#C68A4A]"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#A78D78]">
                        {t("serviceFloor.openOrders")}
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </p>
                    </button>
                  ) : null}

                  {activeBill || activeBillRequest ? (
                    <button
                      type="button"
                      onClick={onOpenBills}
                      className="rounded-md border border-[#3D342D] bg-[#211A15] p-3 text-start transition hover:border-[#5A493E]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8D8075]">
                            {t("serviceFloor.billContext")}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#F4E8DA]">
                            {billNumber || humanizeStatus(billStatus)}
                          </p>
                          <p className="mt-1 text-xs text-[#9C8F83]">
                            {humanizeStatus(billStatus)}
                          </p>
                        </div>
                        <div className="text-end">
                          <Receipt
                            className="ms-auto size-4 text-[#C68A4A]"
                            aria-hidden="true"
                          />
                          {billBalanceMinor > 0 ? (
                            <p className="mt-2 text-sm font-semibold text-[#FFF5E8]">
                              {formatMoney(billBalanceMinor, billCurrency)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#A78D78]">
                        {t("serviceFloor.openBills")}
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </p>
                    </button>
                  ) : null}

                  {!contextLoading &&
                  !selectedAttention &&
                  !activeOrder &&
                  !activeBill &&
                  !activeBillRequest ? (
                    <div className="rounded-md border border-[#3D342D] bg-[#211A15] p-3">
                      <p className="text-sm font-semibold text-[#E8DBCE]">
                        {t("serviceFloor.sessionQuiet")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#93867B]">
                        {t("serviceFloor.sessionQuietDescription")}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="rounded-md border border-[#342A23] bg-[#18130F] p-3">
                      <p className="text-[#81756B]">{t("serviceFloor.partyLabel")}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#F8EDDF]">
                        <UsersRound className="size-3.5" aria-hidden="true" />
                        {selectedSession.partySize ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#342A23] bg-[#18130F] p-3">
                      <p className="text-[#81756B]">{t("serviceFloor.elapsed")}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#F8EDDF]">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        {selectedElapsed}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-md border border-dashed border-[#3C342D] p-4 text-xs leading-5 text-[#847970]">
                  {t("serviceFloor.freeTableDescription")}
                </div>
              )}
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
