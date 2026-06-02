import { EmptyState } from "@/components/ui/empty-state";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

export default function StaffWaiterPage() {
  return (
    <StaffPageShell
      title="Waiter foundation"
      description="A reserved staff surface for future waiter calls, table attention, and service presence workflows."
    >
      <EmptyState
        title="Waiter UI is intentionally not implemented yet"
        description="Realtime and notification utilities are ready, but no operational dashboard is wired in this phase."
      />
    </StaffPageShell>
  );
}
