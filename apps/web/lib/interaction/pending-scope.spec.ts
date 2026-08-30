import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDomainSaving,
  isEntityPending,
  pendingActionFor,
} from "./pending-scope.ts";

describe("entity-scoped interaction pending state", () => {
  it("keeps an unrelated kitchen task enabled while Task A starts", () => {
    const pending = { "task-a": "start" } as const;

    assert.equal(pendingActionFor(pending, "task-a"), "start");
    assert.equal(pendingActionFor(pending, "task-b"), undefined);
  });

  it("keeps an unrelated kitchen task enabled while Task A becomes ready", () => {
    const pending = { "task-a": "ready" } as const;

    assert.equal(pendingActionFor(pending, "task-a"), "ready");
    assert.equal(pendingActionFor(pending, "task-b"), undefined);
  });

  it("keeps Serve available for an unrelated waiter order", () => {
    const pendingOrderIds = new Set(["order-a"]);

    assert.equal(isEntityPending(pendingOrderIds, "order-a"), true);
    assert.equal(isEntityPending(pendingOrderIds, "order-b"), false);
  });

  it("does not leak catalog saving state across domains", () => {
    const pendingDomains = {
      category: true,
      item: false,
      modifier: false,
    } as const;

    assert.equal(isDomainSaving(pendingDomains, "category"), true);
    assert.equal(isDomainSaving(pendingDomains, "item"), false);
    assert.equal(isDomainSaving(pendingDomains, "modifier"), false);
  });

  it("does not leak a locations mutation across panels", () => {
    const pendingDomains = {
      branch: false,
      floor: false,
      table: true,
      qr: false,
    } as const;

    assert.equal(isDomainSaving(pendingDomains, "table"), true);
    assert.equal(isDomainSaving(pendingDomains, "branch"), false);
    assert.equal(isDomainSaving(pendingDomains, "floor"), false);
    assert.equal(isDomainSaving(pendingDomains, "qr"), false);
  });
});
