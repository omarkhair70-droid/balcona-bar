import { AiWaiterPage } from "@/features/customer/pages/ai-waiter-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;

  return <AiWaiterPage sessionId={sessionId} />;
}
