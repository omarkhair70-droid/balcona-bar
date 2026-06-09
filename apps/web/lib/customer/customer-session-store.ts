"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StartTableSessionResult } from "@/lib/api/types";

export type CustomerSessionState = {
  hasHydrated: boolean;
  sessionId?: string;
  branchId?: string;
  tableId?: string;
  qrToken?: string;
  customerAccessToken?: string;
  customerAccessTokenExpiresAt?: string | null;
  customerSessionIdentityId?: string;
  lastLoadedAt?: string;
  setFromStartResult: (
    qrToken: string,
    result: StartTableSessionResult
  ) => void;
  clearSession: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useCustomerSessionStore = create<CustomerSessionState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setFromStartResult: (qrToken, result) =>
        set({
          hasHydrated: true,
          sessionId: result.session.id,
          branchId: result.branch.id,
          tableId: result.table.id,
          qrToken,
          customerAccessToken: result.customerAccess.customerAccessToken,
          customerAccessTokenExpiresAt:
            result.customerAccess.customerAccessTokenExpiresAt,
          customerSessionIdentityId:
            result.customerAccess.customerSessionIdentityId,
          lastLoadedAt: new Date().toISOString()
        }),
      clearSession: () =>
        set({
          hasHydrated: true,
          sessionId: undefined,
          branchId: undefined,
          tableId: undefined,
          qrToken: undefined,
          customerAccessToken: undefined,
          customerAccessTokenExpiresAt: undefined,
          customerSessionIdentityId: undefined,
          lastLoadedAt: undefined
        }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated })
    }),
    {
      name: "balcona_customer_session",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);

export function isCustomerSessionExpired(expiresAt?: string | null) {
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
}
