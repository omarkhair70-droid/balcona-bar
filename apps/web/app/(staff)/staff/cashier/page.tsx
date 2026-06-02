import { EmptyState } from "@/components/ui/empty-state";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

export default function StaffCashierPage() {
  return (
    <StaffPageShell
      title="Cashier foundation"
      description="A reserved staff surface for future smart cashier intake, bill review, and order control workflows."
    >
      <EmptyState
        title="Cashier UI is intentionally not implemented yet"
        description="This phase only creates the shell, route, and shared primitives needed by the next dashboard phase."
      />
    </StaffPageShell>
  );
}
