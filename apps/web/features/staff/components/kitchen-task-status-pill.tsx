"use client";

import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type KitchenTaskStatusPillProps = {
  status?: string;
};

export function KitchenTaskStatusPill({ status }: KitchenTaskStatusPillProps) {
  const t = useTranslations("staff");

  const label =
    status === "pending"
      ? t("kitchen.statusPending")
      : status === "preparing"
        ? t("kitchen.statusPreparing")
        : status === "ready"
          ? t("kitchen.statusReady")
          : status === "cancelled"
            ? t("kitchen.statusCancelled")
            : status || t("kitchen.statusAll");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em]",
        status === "pending" &&
          "border-[#8A682A] bg-[#352B16] text-[#F7CD73]",
        status === "preparing" &&
          "border-[#7A5936] bg-[#33271B] text-[#E7B46F]",
        status === "ready" &&
          "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]",
        status === "cancelled" &&
          "border-[#7D3932] bg-[#3D211E] text-[#FFAAA0]",
        !["pending", "preparing", "ready", "cancelled"].includes(status ?? "") &&
          "border-[#44413D] bg-[#23211F] text-[#C8C2BC]"
      )}
    >
      {label}
    </span>
  );
}
