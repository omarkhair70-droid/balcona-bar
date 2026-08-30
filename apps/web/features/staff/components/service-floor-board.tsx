"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  MapPinned,
  Radio,
  UsersRound
} from "lucide-react";
import type {
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
  onSelectSession?: (sessionId: string) => void;
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

const tablePlacement = [
  "col-span-3 row-span-2 sm:col-span-4",
  "col-span-3 row-span-3 sm:col-span-3",
  "col-span-4 row-span-2 sm:col-span-5",
  "col-span-2 row-span-2 sm:col-span-3",
  "col-span-3 row-span-2 sm:col-span-4",
  "col-span-3 row-span-3 sm:col-span-3"
] as const;

function placementForTable(table: BranchAdminTable, index: number) {
  if ((table.capacity ?? 0) >= 6) {
    return "col-span-4 row-span-3 sm:col-span-5";
  }

  if ((table.capacity ?? 0) <= 2) {
    return "col-span-2 row-span-2 sm:col-span-3";
  }

  return tablePlacement[index % tablePlacement.length];
}

export function ServiceFloorBoard({
  overview,
  isLoading,
  error,
  selectedSessionId,
  onSelectSession
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
    activeFloor?.tables.find((table) => table.id === selectedTableId) ??
    activeFloor?.tables.find(
      (table) => table.activeSession?.id === selectedSessionId
    ) ??
    activeFloor?.tables.find((table) => table.activeSession) ??
    activeFloor?.tables[0];

  const selectedTone = selectedTable ? getTableTone(selectedTable) : undefined;
  const selectedSession = selectedTable?.activeSession;
  const selectedAttention = selectedSession?.tableAttentionSnapshot;
  const selectedElapsed = formatElapsed(
    getElapsedMinutes(selectedSession?.startedAt, now)
  );

  return (
    <section className="min-w-0 overflow-hidden border border-[#3B3028] bg-[#17120F]">
      <div className="border-b border-[#342A23] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
              {t("serviceFloor.eyebrow")}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#FFF5E8]">
              {t("serviceFloor.title")}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#95887D]">
              {t("serviceFloor.description")}
            </p>
          </div>

          {overview ? (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-[#456144] bg-[#213022] px-2.5 py-1 text-[#A8D5A6]">
                {t("serviceFloor.occupiedCount", {
                  count: overview.stats.occupiedTables
                })}
              </span>
              <span className="rounded-full border border-[#7A3F3A] bg-[#3A211F] px-2.5 py-1 text-[#F09C94]">
                {t("serviceFloor.attentionCount", {
                  count: overview.stats.needsAttention
                })}
              </span>
            </div>
          ) : null}
        </div>

        {groups.length > 0 ? (
          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
            aria-label={t("serviceFloor.areaNavigation")}
          >
            {groups.map((group) => {
              const active = activeFloor?.id === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setSelectedFloorId(group.id);
                    setSelectedTableId(undefined);
                  }}
                  className={cn(
                    "min-h-10 shrink-0 rounded-md border px-3 text-xs font-semibold transition",
                    active
                      ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
                      : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2] hover:border-[#554238] hover:bg-[#292019]"
                  )}
                >
                  {group.name}
                  <span className="ms-1.5 opacity-70">{group.tables.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="rounded-md border border-[#3A3028] bg-[#211A15] p-4 text-sm text-[#A99B8E]">
            {t("serviceFloor.loading")}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-[#71413A] bg-[#321F1C] p-4 text-sm text-[#E4A199]"
          >
            {error.message}
          </div>
        ) : null}

        {!isLoading && !error && groups.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
            {t("serviceFloor.empty")}
          </div>
        ) : null}

        {!isLoading && !error && activeFloor ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0 rounded-lg border border-[#342A23] bg-[#1B1511] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <MapPinned className="size-4 shrink-0 text-[#C68A4A]" aria-hidden="true" />
                  <strong className="truncate text-sm text-[#F8EDDF]">
                    {activeFloor.name}
                  </strong>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7FC37E]">
                  <Radio className="size-3" aria-hidden="true" />
                  {t("serviceFloor.live")}
                </span>
              </div>

              <div className="grid grid-cols-6 auto-rows-[3rem] grid-flow-row-dense gap-2 sm:grid-cols-12 sm:auto-rows-[3.25rem]">
                {activeFloor.tables.map((table, index) => {
                  const tone = getTableTone(table);
                  const session = table.activeSession;
                  const selected = selectedTable?.id === table.id;
                  const elapsed = formatElapsed(
                    getElapsedMinutes(session?.startedAt, now)
                  );

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => {
                        setSelectedTableId(table.id);

                        if (session?.id) {
                          onSelectSession?.(session.id);
                        }
                      }}
                      className={cn(
                        "relative flex min-h-24 flex-col justify-between overflow-hidden border p-3 text-start transition",
                        placementForTable(table, index),
                        (table.capacity ?? 0) <= 2
                          ? "rounded-[2rem]"
                          : (table.capacity ?? 0) >= 6
                            ? "rounded-xl"
                            : "rounded-md",
                        tone === "urgent" &&
                          "border-[#8A4640] bg-[#321F1C] text-[#F2B0A9]",
                        tone === "attention" &&
                          "border-[#7D5D2C] bg-[#392B18] text-[#F0C66E]",
                        tone === "occupied" &&
                          "border-[#456144] bg-[#213022] text-[#CBE5C8]",
                        tone === "free" &&
                          "border-[#3B3028] bg-[#211A15] text-[#D9CCC0]",
                        tone === "maintenance" &&
                          "border-[#5A4630] bg-[#2E261D] text-[#BFAE96]",
                        tone === "inactive" &&
                          "border-[#342B24] bg-[#1A1512] text-[#746A62] opacity-65",
                        selected &&
                          "ring-2 ring-[#C68A4A] ring-offset-2 ring-offset-[#1B1511]",
                        "hover:-translate-y-0.5 hover:border-[#C68A4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0A764]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-sm">{table.code}</strong>
                          <p className="mt-0.5 line-clamp-1 text-[10px] opacity-75">
                            {table.displayName}
                          </p>
                        </div>
                        {tone === "urgent" || tone === "attention" ? (
                          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                        ) : null}
                      </div>

                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-75">
                          {t(`serviceFloor.state.${tone}`)}
                        </p>
                        {session ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold">
                            <Clock3 className="size-3.5" aria-hidden="true" />
                            {elapsed}
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] opacity-65">
                            {t("serviceFloor.capacity", {
                              count: table.capacity ?? 0
                            })}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-[10px] leading-4 text-[#756A61]">
                {t("serviceFloor.geometryNote")}
              </p>
            </div>

            {selectedTable ? (
              <aside
                className="rounded-lg border border-[#3A3028] bg-[#211A15] p-4"
                aria-label={t("serviceFloor.tableContext")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9D856D]">
                      {t("serviceFloor.selectedTable")}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#FFF5E8]">
                      {selectedTable.code}
                    </h3>
                    <p className="mt-1 text-xs text-[#91857A]">
                      {selectedTable.displayName}
                    </p>
                  </div>
                  {selectedTone ? (
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                        selectedTone === "urgent" &&
                          "border-[#7A3F3A] bg-[#3A211F] text-[#F09C94]",
                        selectedTone === "attention" &&
                          "border-[#7D5D2C] bg-[#392B18] text-[#F0C66E]",
                        selectedTone === "occupied" &&
                          "border-[#456144] bg-[#213022] text-[#A8D5A6]",
                        (selectedTone === "free" ||
                          selectedTone === "maintenance" ||
                          selectedTone === "inactive") &&
                          "border-[#4D4036] bg-[#2B221C] text-[#D9CCC0]"
                      )}
                    >
                      {t(`serviceFloor.state.${selectedTone}`)}
                    </span>
                  ) : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-[#342A23] bg-[#18130F] p-3">
                    <dt className="text-[#81756B]">{t("serviceFloor.elapsed")}</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#F8EDDF]">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {selectedSession ? selectedElapsed : "—"}
                    </dd>
                  </div>
                  <div className="rounded-md border border-[#342A23] bg-[#18130F] p-3">
                    <dt className="text-[#81756B]">{t("serviceFloor.partyLabel")}</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#F8EDDF]">
                      <UsersRound className="size-3.5" aria-hidden="true" />
                      {selectedSession?.partySize ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-md border border-[#342A23] bg-[#18130F] p-3">
                    <dt className="text-[#81756B]">{t("serviceFloor.capacityLabel")}</dt>
                    <dd className="mt-1 font-semibold text-[#F8EDDF]">
                      {selectedTable.capacity ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-md border border-[#342A23] bg-[#18130F] p-3">
                    <dt className="text-[#81756B]">{t("serviceFloor.sessionLabel")}</dt>
                    <dd className="mt-1 font-semibold text-[#F8EDDF]">
                      {selectedSession?.status ?? t("serviceFloor.noSession")}
                    </dd>
                  </div>
                </dl>

                {selectedAttention ? (
                  <div className="mt-3 rounded-md border border-[#71413A] bg-[#321F1C] p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#F2B0A9]">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      {t("serviceFloor.attentionContext")}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#CDA49E]">
                      {selectedAttention.priority} · {selectedAttention.status} ·{" "}
                      {t("serviceFloor.score", { score: selectedAttention.score })}
                    </p>
                  </div>
                ) : null}

                {selectedSession ? (
                  <p className="mt-3 text-[10px] leading-4 text-[#756A61]">
                    {t("serviceFloor.sessionContextHint")}
                  </p>
                ) : null}
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
