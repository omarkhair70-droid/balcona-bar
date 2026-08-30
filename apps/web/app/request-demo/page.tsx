import { Suspense } from "react";
import { RequestDemoPage } from "@/features/marketing/request-demo-page";

export default function RequestDemoRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F2EFE7]" />}>
      <RequestDemoPage />
    </Suspense>
  );
}
