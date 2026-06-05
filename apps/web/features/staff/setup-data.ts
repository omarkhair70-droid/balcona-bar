import type {
  TenantOnboardingLaunchStatus,
  TenantOnboardingReadinessStatus
} from "@/lib/api/types";

export function getLaunchStatusLabel(status: TenantOnboardingLaunchStatus) {
  if (status === "ready_for_pilot") {
    return "Pilot ready";
  }

  if (status === "ready_for_demo") {
    return "Demo ready";
  }

  return "Blocked";
}

export function getStaffRoleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getReadinessBadgeVariant(
  status: TenantOnboardingReadinessStatus
) {
  if (status === "ready") {
    return "success";
  }

  if (status === "needs_attention") {
    return "warning";
  }

  if (status === "blocked") {
    return "danger";
  }

  return "muted";
}
