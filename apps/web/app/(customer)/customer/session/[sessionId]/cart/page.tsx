import { CustomerCartPage } from "@/features/customer/pages/customer-cart-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <CustomerCartPage sessionId={sessionId} />;
}
