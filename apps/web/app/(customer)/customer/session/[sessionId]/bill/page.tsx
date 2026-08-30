import { CustomerBillPage } from "@/features/customer/pages/customer-bill-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <CustomerBillPage sessionId={sessionId} />;
}
