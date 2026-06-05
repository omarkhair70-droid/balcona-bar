import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  getLaunchStatusLabel,
  getReadinessBadgeVariant,
  getStaffRoleLabel
} from "./setup-data";

describe("setup-data", () => {
  it("labels launch statuses for setup cards", () => {
    assert.equal(getLaunchStatusLabel("ready_for_pilot"), "Pilot ready");
    assert.equal(getLaunchStatusLabel("ready_for_demo"), "Demo ready");
    assert.equal(getLaunchStatusLabel("blocked"), "Blocked");
  });

  it("formats staff role labels without hardcoding each role", () => {
    assert.equal(getStaffRoleLabel("branch_manager"), "Branch Manager");
    assert.equal(getStaffRoleLabel("menu_admin"), "Menu Admin");
  });

  it("maps readiness states to badge variants", () => {
    assert.equal(getReadinessBadgeVariant("ready"), "success");
    assert.equal(getReadinessBadgeVariant("needs_attention"), "warning");
    assert.equal(getReadinessBadgeVariant("blocked"), "danger");
    assert.equal(getReadinessBadgeVariant("missing"), "muted");
  });
});
