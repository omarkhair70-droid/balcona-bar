import { EmptyState } from "@/components/ui/empty-state";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

export default function StaffKitchenPage() {
  return (
    <StaffPageShell
      title="Kitchen foundation"
      description="A reserved staff surface for future preparation views, station filters, and realtime production signals."
    >
      <EmptyState
        title="Kitchen queue UI is intentionally not implemented yet"
        description="The foundation stops at navigation, layout, and utilities without adding kitchen or barista queue behavior."
      />
    </StaffPageShell>
  );
}
