import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  SMOKE_BOOTSTRAP_EMAILS,
  assertSafeBootstrapEnvironment,
  buildSmokeCredentials,
  readSmokeBootstrapConfig,
  renderBootstrapSummary,
  updateEnvContent
} from "./smoke-bootstrap.mjs";

describe("smoke bootstrap", () => {
  it("updates smoke env keys while preserving existing base URLs", () => {
    const result = updateEnvContent(
      [
        "SMOKE_WEB_BASE_URL=https://web.example.com",
        "SMOKE_API_BASE_URL=https://api.example.com/api/v1",
        "SMOKE_OWNER_EMAIL="
      ].join("\n"),
      {
        SMOKE_OWNER_EMAIL: SMOKE_BOOTSTRAP_EMAILS.owner,
        SMOKE_OWNER_PASSWORD: "Smoke-secret-value-123456"
      }
    );

    assert.match(result.content, /SMOKE_WEB_BASE_URL=https:\/\/web\.example\.com/);
    assert.match(result.content, /SMOKE_API_BASE_URL=https:\/\/api\.example\.com\/api\/v1/);
    assert.match(result.content, /SMOKE_OWNER_EMAIL=smoke-owner@balcona\.test/);
    assert.match(result.content, /SMOKE_OWNER_PASSWORD=Smoke-secret-value-123456/);
  });

  it("does not overwrite non-empty values unless overwrite is true", () => {
    const result = updateEnvContent(
      "SMOKE_COMPANY_ID=existing-company\n",
      { SMOKE_COMPANY_ID: "new-company" },
      { overwrite: false }
    );

    assert.match(result.content, /SMOKE_COMPANY_ID=existing-company/);
    assert.deepEqual(result.preservedKeys, ["SMOKE_COMPANY_ID"]);
  });

  it("fails clearly when bootstrap token is missing", () => {
    assert.throws(
      () =>
        readSmokeBootstrapConfig({
          SMOKE_WEB_BASE_URL: "https://web.example.com",
          SMOKE_API_BASE_URL: "https://api.example.com/api/v1"
        }),
      /SMOKE_BOOTSTRAP_TOKEN or SMOKE_RESET_TOKEN/
    );
  });

  it("blocks production bootstrap from the local helper", () => {
    assert.throws(
      () => assertSafeBootstrapEnvironment({ SMOKE_ENVIRONMENT: "production" }),
      (error) => error.code === "SMOKE_BOOTSTRAP_DISABLED_IN_PRODUCTION"
    );
  });

  it("rejects non-smoke emails unless overwrite is requested", () => {
    assert.throws(
      () =>
        buildSmokeCredentials({
          SMOKE_OWNER_EMAIL: "owner@example.com"
        }),
      (error) => error.code === "SMOKE_BOOTSTRAP_NON_SMOKE_ENV_VALUE"
    );
  });

  it("does not print generated credentials in the bootstrap summary", () => {
    const password = "Smoke-super-secret-password-123";
    const credentialPlan = buildSmokeCredentials(
      {},
      { passwordFactory: () => password }
    );
    const summary = renderBootstrapSummary({
      response: {
        company: { id: "company-1" },
        branch: { id: "branch-1" }
      },
      credentialPlan,
      writeResult: {
        writtenKeys: ["SMOKE_OWNER_PASSWORD", "SMOKE_PLATFORM_PASSWORD"],
        preservedKeys: []
      }
    });

    assert.match(summary, /passwordValuesPrinted=false/);
    assert.doesNotMatch(summary, new RegExp(password));
  });
});
