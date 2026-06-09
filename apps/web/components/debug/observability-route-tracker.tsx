"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { addDebugBreadcrumb } from "@/lib/observability/breadcrumbs";

export function ObservabilityRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    addDebugBreadcrumb({
      action: "route_changed",
      route: pathname,
      result: "success"
    });
  }, [pathname]);

  return null;
}

