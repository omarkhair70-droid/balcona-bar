"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  PlatformAdminSession,
  PlatformAdminUser,
  PlatformAuthContext,
  PlatformAuthResponse
} from "@/lib/api/types";

export type PlatformAuthState = {
  accessToken?: string;
  expiresAt?: string;
  platformAdminUser?: PlatformAdminUser;
  platformAdminSession?: PlatformAdminSession;
  lastLoadedAt?: string;
  setFromLogin: (result: PlatformAuthResponse) => void;
  setFromContext: (context: PlatformAuthContext) => void;
  clearSession: () => void;
};

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      setFromLogin: (result) =>
        set({
          accessToken: result.accessToken,
          expiresAt: result.expiresAt,
          platformAdminUser: result.platformAdminUser,
          platformAdminSession: result.platformAdminSession,
          lastLoadedAt: new Date().toISOString()
        }),
      setFromContext: (context) =>
        set({
          platformAdminUser: context.platformAdminUser,
          platformAdminSession: context.platformAdminSession,
          expiresAt: context.platformAdminSession.expiresAt,
          lastLoadedAt: new Date().toISOString()
        }),
      clearSession: () =>
        set({
          accessToken: undefined,
          expiresAt: undefined,
          platformAdminUser: undefined,
          platformAdminSession: undefined,
          lastLoadedAt: undefined
        })
    }),
    {
      name: "balcona_platform_session",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export function isPlatformSessionExpired(expiresAt?: string | null) {
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
}
