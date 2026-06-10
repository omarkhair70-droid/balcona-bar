import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  LANGUAGE_OPTIONS,
  normalizeLocale,
  resolveLocale
} from "./config";
import { translate } from "./messages";

describe("i18n foundation", () => {
  it("normalizes supported English and Arabic locale candidates", () => {
    assert.equal(DEFAULT_LOCALE, "en");
    assert.equal(normalizeLocale("en-US"), "en");
    assert.equal(normalizeLocale("ar-EG"), "ar");
    assert.equal(normalizeLocale("   "), undefined);
    assert.equal(resolveLocale("fr-FR", "ar-EG"), "ar");
  });

  it("exposes both language switcher options", () => {
    assert.deepEqual(
      LANGUAGE_OPTIONS.map((option) => option.locale),
      ["en", "ar"]
    );
    assert.ok(LANGUAGE_OPTIONS.every((option) => option.nativeLabel));
  });

  it("returns the correct document direction for each locale", () => {
    assert.equal(getLocaleDirection("en"), "ltr");
    assert.equal(getLocaleDirection("ar"), "rtl");
  });

  it("loads translated messages with English fallback and interpolation", () => {
    assert.equal(translate("en", "common.loading"), "Loading");
    assert.equal(translate("ar", "common.language"), "اللغة");
    assert.equal(
      translate("en", "customer.tableLabel", { token: "T01" }),
      "Table T01"
    );
    assert.equal(translate("ar", "missing.key"), "missing.key");
  });
});
