"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StartTableSessionResult } from "@/lib/api/types";

export type CustomerSessionState = {
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
};

export const useCustomerSessionStore = create<CustomerSessionState>()(
  persist(
    (set) => ({
      setFromStartResult: (qrToken, result) =>
        set({
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
          sessionId: undefined,
          branchId: undefined,
          tableId: undefined,
          qrToken: undefined,
          customerAccessToken: undefined,
          customerAccessTokenExpiresAt: undefined,
          customerSessionIdentityId: undefined,
          lastLoadedAt: undefined
        })
    }),
    {
      name: "balcona_customer_session",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export function isCustomerSessionExpired(expiresAt?: string | null) {
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
}
