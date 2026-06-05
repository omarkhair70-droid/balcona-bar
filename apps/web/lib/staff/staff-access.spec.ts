import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { StaffEffectiveAccess } from "@/lib/api/types";
import {
  getInventoryAccessMode,
  hasCompanyStaffPermission,
  hasStaffPermission
} from "./staff-access";

const company = {
  id: "company-1",
  name: "Balkona",
  slug: "balkona",
  status: "active"
};

const branch = {
  id: "branch-1",
  companyId: company.id,
  name: "Main",
  slug: "main",
  status: "active"
};

function access(input: Partial<StaffEffectiveAccess>): StaffEffectiveAccess {
  return {
    companies: [],
    branches: [],
    roles: [],
    permissions: [],
    ...input
  };
}

describe("staff inventory access helpers", () => {
  it("distinguishes branch stock management from company catalog management", () => {
    const branchScopedManager = access({
      branches: [
        {
          company,
          branch,
          source: "branch_membership",
          roles: ["branch_manager"],
          permissions: ["inventory.read", "inventory.manage"]
        }
      ],
      roles: ["branch_manager"],
      permissions: ["inventory.read", "inventory.manage"]
    });

    assert.equal(
      hasStaffPermission(branchScopedManager, "inventory.manage", branch.id),
      true
    );
    assert.equal(
      hasCompanyStaffPermission(
        branchScopedManager,
        "inventory.manage",
        company.id
      ),
      false
    );

    assert.deepEqual(
      getInventoryAccessMode({
        access: branchScopedManager,
        companyId: company.id,
        branchId: branch.id
      }),
      {
        canReadBranchInventory: true,
        canManageBranchStock: true,
        canReadCompanyInventory: false,
        canManageCompanyInventory: false,
        mode: "branch_stock_management"
      }
    );
  });

  it("allows company-scoped inventory managers to manage catalog and requirements", () => {
    const companyScopedManager = access({
      companies: [
        {
          company,
          branchScope: "all_branches",
          roles: ["menu_admin"],
          permissions: ["inventory.read", "inventory.manage"]
        }
      ],
      branches: [
        {
          company,
          branch,
          source: "company_membership",
          roles: ["menu_admin"],
          permissions: ["inventory.read", "inventory.manage"]
        }
      ],
      roles: ["menu_admin"],
      permissions: ["inventory.read", "inventory.manage"]
    });

    assert.deepEqual(
      getInventoryAccessMode({
        access: companyScopedManager,
        companyId: company.id,
        branchId: branch.id
      }),
      {
        canReadBranchInventory: true,
        canManageBranchStock: true,
        canReadCompanyInventory: true,
        canManageCompanyInventory: true,
        mode: "company_inventory_management"
      }
    );
  });
});
