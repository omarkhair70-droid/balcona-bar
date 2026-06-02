import { EmptyState } from "@/components/ui/empty-state";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

export default function StaffOwnerPage() {
  return (
    <StaffPageShell
      title="Owner foundation"
      description="A reserved staff surface for future analytics, permissions, configuration, and audit-log workflows."
    >
      <EmptyState
        title="Owner UI is intentionally not implemented yet"
        description="This placeholder keeps the route ready while avoiding dashboards and backend behavior changes."
      />
    </StaffPageShell>
  );
}
