import { CustomerServicePage } from "@/features/customer/pages/customer-service-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <CustomerServicePage sessionId={sessionId} />;
}
