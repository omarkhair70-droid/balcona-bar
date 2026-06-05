import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  getOrderAllowedActions,
  getStringArrayOrActionObjects
} from "./cashier-data";

describe("cashier-data action parsing", () => {
  it("keeps string allowedActions from the backend lifecycle", () => {
    assert.deepEqual(
      getOrderAllowedActions({
        lifecycle: {
          allowedActions: ["accept", "reject"]
        }
      }),
      ["accept", "reject"]
    );
  });

  it("reads object action fields used by richer lifecycle payloads", () => {
    assert.deepEqual(
      getStringArrayOrActionObjects([
        { action: "accept" },
        { type: "reject" },
        { name: "cancel" },
        { label: "ignored" },
        null
      ]),
      ["accept", "reject", "cancel"]
    );
  });

  it("returns an empty list for missing or malformed values", () => {
    assert.deepEqual(getStringArrayOrActionObjects(undefined), []);
    assert.deepEqual(getStringArrayOrActionObjects(["", 123, {}]), []);
  });
});
