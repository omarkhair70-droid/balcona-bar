import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;
  redirect(`/guest/session/${sessionId}/menu`);
}
