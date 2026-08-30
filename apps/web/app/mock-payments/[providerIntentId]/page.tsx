import { MockPaymentCheckoutPage } from "@/features/customer/pages/mock-payment-checkout-page";

type PageProps = {
  params: Promise<{ providerIntentId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { providerIntentId } = await params;

  return (
    <MockPaymentCheckoutPage
      providerIntentId={decodeURIComponent(providerIntentId)}
    />
  );
}
