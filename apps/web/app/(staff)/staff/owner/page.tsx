"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";

const legacyOwnerDestinations: Record<string, string> = {
  "#operations": "/office#operations",
  "#insights": "/office#insights",
  "#money": "/office/money",
  "#team": "/office/team",
  "#experience": "/office/experience",
  "#settings": "/office/settings",
  "#account": "/office/account"
};

export default function StaffOwnerPage() {
  const router = useRouter();

  useEffect(() => {
    const destination =
      legacyOwnerDestinations[window.location.hash] ?? "/office";

    router.replace(destination);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F5F2] text-[#64645E]">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Opening Balcona Office
      </div>
    </main>
  );
}
