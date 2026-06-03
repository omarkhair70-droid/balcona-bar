import type {
  BranchAdminBranchStatus,
  BranchAdminTableStatus
} from "@/lib/api/types";

export const branchTableAdminTabs = [
  { id: "branches", label: "Branches" },
  { id: "floors", label: "Floors" },
  { id: "tables", label: "Tables" },
  { id: "qr", label: "QR Links" },
  { id: "sessions", label: "Active Sessions" },
  { id: "issues", label: "Setup Issues" }
] as const;

export type BranchTableAdminTab = (typeof branchTableAdminTabs)[number]["id"];

export const branchStatuses: BranchAdminBranchStatus[] = [
  "active",
  "inactive"
];

export const tableStatuses: BranchAdminTableStatus[] = [
  "active",
  "inactive",
  "maintenance"
];

export function slugifyBranchAdminValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildQrTokenFromParts(branchSlug: string, tableCode: string) {
  return slugifyBranchAdminValue(`${branchSlug}-${tableCode}`);
}

export function humanizeBranchAdminValue(value: string) {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatBranchAdminDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Not set";
}

export function getBranchAdminErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Branch and table update failed. Review the form and try again.";
}

export function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return Promise.resolve();
  }

  return navigator.clipboard.writeText(value);
}
