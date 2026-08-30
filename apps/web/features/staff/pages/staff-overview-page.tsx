"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getDefaultStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";

export function StaffOverviewPage() {
  const router = useRouter();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const defaultBranch = useStaffAuthStore((state) => state.defaultBranch);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persist = useStaffAuthStore.persist;

    if (persist.hasHydrated()) {
      queueMicrotask(() => setHydrated(true));
      return;
    }

    const unsubscribe = persist.onFinishHydration(() => {
      setHydrated(true);
    });

    void persist.rehydrate();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/staff/login");
      return;
    }

    router.replace(
      getDefaultStaffRoute(effectiveAccess, defaultBranch?.id)
    );
  }, [accessToken, defaultBranch?.id, effectiveAccess, hydrated, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#17120F] text-[#FFF5E8]">
      <div className="flex items-center gap-3 text-sm font-semibold text-[#B8A99B]">
        <LoaderCircle className="size-4 animate-spin text-[#C68A4A]" aria-hidden="true" />
        Balcona
      </div>
    </main>
  );
}
