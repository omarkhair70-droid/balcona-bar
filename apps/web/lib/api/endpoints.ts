import { apiRequest } from "./client";
import type {
  BranchEffectiveExperience,
  CompanySummary,
  StaffLoginPayload,
  StaffLoginResult,
  StaffUserSummary,
  StartTableSessionPayload,
  StartTableSessionResult
} from "./types";

export function getCompanies() {
  return apiRequest<CompanySummary[]>("/companies");
}

export function getBranchEffectiveExperience(branchId: string) {
  return apiRequest<BranchEffectiveExperience>(
    `/branches/${branchId}/experience/effective`
  );
}

export function startTableSession(payload: StartTableSessionPayload) {
  return apiRequest<StartTableSessionResult, StartTableSessionPayload>(
    "/table-sessions/start",
    {
      method: "POST",
      body: payload
    }
  );
}

export function staffLogin(payload: StaffLoginPayload) {
  return apiRequest<StaffLoginResult, StaffLoginPayload>("/staff-auth/login", {
    method: "POST",
    body: payload
  });
}

export function staffMe(token: string) {
  return apiRequest<StaffUserSummary>("/staff-auth/me", {
    token
  });
}
