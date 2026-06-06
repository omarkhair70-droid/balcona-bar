import { PlatformCompanyDetailPage } from "@/features/platform/pages/platform-company-detail-page";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function PlatformCompanyDetailRoute({ params }: PageProps) {
  const { companyId } = await params;

  return <PlatformCompanyDetailPage companyId={companyId} />;
}
