"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  BranchSummary,
  StaffAuthContext,
  StaffEffectiveAccess,
  StaffLoginResult,
  StaffSessionSummary,
  StaffUserSummary
} from "@/lib/api/types";

export type StaffAuthState = {
  accessToken?: string;
  expiresAt?: string;
  staffUser?: StaffUserSummary;
  staffSession?: StaffSessionSummary;
  effectiveAccess?: StaffEffectiveAccess;
  defaultBranch?: BranchSummary | null;
  selectedBranchId?: string;
  lastLoadedAt?: string;
  setFromLogin: (result: StaffLoginResult) => void;
  setFromContext: (context: StaffAuthContext) => void;
  setSelectedBranchId: (branchId: string) => void;
  clearSession: () => void;
};

function getAccessibleBranchIds(access?: StaffEffectiveAccess) {
  return new Set(access?.branches.map((entry) => entry.branch.id) ?? []);
}

function firstAccessibleBranchId(access?: StaffEffectiveAccess) {
  return access?.branches[0]?.branch.id;
}

function resolveSelectedBranchId({
  access,
  currentBranchId,
  defaultBranchId
}: {
  access?: StaffEffectiveAccess;
  currentBranchId?: string;
  defaultBranchId?: string | null;
}) {
  const accessibleBranchIds = getAccessibleBranchIds(access);

  if (currentBranchId && accessibleBranchIds.has(currentBranchId)) {
    return currentBranchId;
  }

  if (defaultBranchId && accessibleBranchIds.has(defaultBranchId)) {
    return defaultBranchId;
  }

  return defaultBranchId ?? firstAccessibleBranchId(access);
}

export const useStaffAuthStore = create<StaffAuthState>()(
  persist(
    (set, get) => ({
      setFromLogin: (result) =>
        set({
          accessToken: result.accessToken,
          expiresAt: result.expiresAt,
          staffUser: result.staffUser,
          staffSession: result.staffSession,
          effectiveAccess: result.effectiveAccess,
          defaultBranch: result.defaultBranch,
          selectedBranchId: resolveSelectedBranchId({
            access: result.effectiveAccess,
            currentBranchId: get().selectedBranchId,
            defaultBranchId:
              result.defaultBranch?.id ?? result.staffSession.branchId ?? null
          }),
          lastLoadedAt: new Date().toISOString()
        }),
      setFromContext: (context) =>
        set((state) => ({
          staffUser: context.staffUser,
          staffSession: context.staffSession,
          effectiveAccess: context.staffAccess,
          selectedBranchId: resolveSelectedBranchId({
            access: context.staffAccess,
            currentBranchId: state.selectedBranchId,
            defaultBranchId:
              state.defaultBranch?.id ?? context.staffSession.branchId ?? null
          }),
          lastLoadedAt: new Date().toISOString()
        })),
      setSelectedBranchId: (branchId) =>
        set((state) => {
          const accessibleBranchIds = getAccessibleBranchIds(
            state.effectiveAccess
          );

          if (!accessibleBranchIds.has(branchId)) {
            return {
              selectedBranchId: resolveSelectedBranchId({
                access: state.effectiveAccess,
                currentBranchId: state.selectedBranchId,
                defaultBranchId: state.defaultBranch?.id ?? null
              }),
              lastLoadedAt: new Date().toISOString()
            };
          }

          return {
            selectedBranchId: branchId,
            lastLoadedAt: new Date().toISOString()
          };
        }),
      clearSession: () =>
        set({
          accessToken: undefined,
          expiresAt: undefined,
          staffUser: undefined,
          staffSession: undefined,
          effectiveAccess: undefined,
          defaultBranch: undefined,
          selectedBranchId: undefined,
          lastLoadedAt: undefined
        })
    }),
    {
      name: "balcona_staff_session",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export function isStaffSessionExpired(expiresAt?: string | null) {
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
}
