import { StaffInviteSetupPage } from "@/features/staff/pages/staff-invite-setup-page";

export default async function StaffInviteRoute({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <StaffInviteSetupPage token={token} />;
}
