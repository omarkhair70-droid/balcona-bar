import { CustomerMenuPage } from "@/features/customer/pages/customer-menu-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <CustomerMenuPage sessionId={sessionId} />;
}
