import { CustomerStatusPage } from "@/features/customer/pages/customer-status-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <CustomerStatusPage sessionId={sessionId} />;
}
