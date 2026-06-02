import { CustomerTableStartPage } from "@/features/customer/pages/customer-table-start-page";

type PageProps = {
  params: Promise<{ qrToken: string }>;
};

export default async function Page({ params }: PageProps) {
  const { qrToken } = await params;

  return <CustomerTableStartPage qrToken={decodeURIComponent(qrToken)} />;
}
