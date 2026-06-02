import { CustomerSessionHomePage } from "@/features/customer/pages/customer-session-home-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <CustomerSessionHomePage sessionId={sessionId} />;
}
