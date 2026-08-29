"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, UsersRound } from "lucide-react";
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

function getTableTone(table: BranchAdminTable) {
  const attention = table.activeSession?.tableAttentionSnapshot;
  const attentionStatus = attention?.status;
  const attentionPriority = attention?.priority;

  if (
    attentionStatus === "urgent" ||
    attentionPriority === "urgent"
  ) {
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

export function ServiceFloorBoard({
  overview,
  isLoading,
  error,
  selectedSessionId,
  onSelectSession
}: ServiceFloorBoardProps) {
  const t = useTranslations("staff");
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

  const [selectedFloorId, setSelectedFloorId] = useState<string>();

  const activeFloor =
    groups.find((group) => group.id === selectedFloorId) ?? groups[0];

  return (
    <section className="min-w-0 border border-[#3B3028] bg-[#17120F]">
      <div className="border-b border-[#342A23] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
              {t("serviceFloor.eyebrow")}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#FFF5E8]">
              {t("serviceFloor.title")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#95887D]">
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
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {groups.map((group) => {
              const active = activeFloor?.id === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedFloorId(group.id)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-md border px-3 text-xs font-semibold transition",
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {activeFloor.tables.map((table) => {
              const tone = getTableTone(table);
              const session = table.activeSession;
              const attention = session?.tableAttentionSnapshot;
              const selected = Boolean(
                session?.id && session.id === selectedSessionId
              );
              const clickable = Boolean(session?.id && onSelectSession);

              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (session?.id) {
                      onSelectSession?.(session.id);
                    }
                  }}
                  className={cn(
                    "relative min-h-28 overflow-hidden rounded-md border p-3 text-start transition",
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
                    selected && "ring-2 ring-[#C68A4A] ring-offset-2 ring-offset-[#17120F]",
                    clickable && "hover:-translate-y-0.5 hover:border-[#C68A4A]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm">{table.code}</strong>
                    {attention?.status === "urgent" ? (
                      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-[11px] opacity-75">
                    {table.displayName}
                  </p>

                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">
                    {t(`serviceFloor.state.${tone}`)}
                  </p>

                  {session ? (
                    <div className="mt-2 grid gap-1 text-[10px] opacity-80">
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="size-3" aria-hidden="true" />
                        {session.partySize
                          ? t("serviceFloor.party", { count: session.partySize })
                          : t("serviceFloor.sessionActive")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3" aria-hidden="true" />
                        {new Date(session.startedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <p className="mt-3 text-[10px] leading-4 text-[#756A61]">
          {t("serviceFloor.geometryNote")}
        </p>
      </div>
    </section>
  );
}
