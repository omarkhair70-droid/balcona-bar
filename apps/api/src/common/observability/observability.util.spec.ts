import {
  operationalCodeFromException,
  redactSensitiveText,
  safeExceptionSummary,
  sanitizeJson,
} from "./observability.util";

describe("observability utilities", () => {
  it("redacts secrets from exception summaries", () => {
    const summary = safeExceptionSummary(
      new Error(
        "failed with token=abc password=secret postgresql://user:pass@db/app",
      ),
    );

    expect(summary.message).toContain("token=[redacted]");
    expect(summary.message).toContain("password=[redacted]");
    expect(summary.message).toContain("postgresql://user:[redacted]@db/app");
    expect(summary.message).not.toContain("abc");
    expect(summary.message).not.toContain("secret");
  });

  it("maps Prisma P2028 to DB_TRANSACTION_TIMEOUT", () => {
    const error = Object.assign(new Error("Transaction already closed"), {
      code: "P2028",
    });

    expect(operationalCodeFromException(error)).toBe("DB_TRANSACTION_TIMEOUT");
  });

  it("maps schema-like Prisma errors safely", () => {
    expect(operationalCodeFromException({ code: "P2022" })).toBe(
      "MIGRATION_NOT_APPLIED",
    );
    expect(operationalCodeFromException({ code: "P1014" })).toBe(
      "DATABASE_SCHEMA_MISMATCH",
    );
  });

  it("sanitizes JSON details by dropping sensitive keys", () => {
    const result = sanitizeJson({
      orderId: "order-1",
      token: "customer-token",
      nested: {
        cookie: "session=secret",
        reason: "safe",
      },
    });

    expect(result).toEqual({
      orderId: "order-1",
      nested: {
        reason: "safe",
      },
    });
  });

  it("redacts bearer text", () => {
    expect(redactSensitiveText("Authorization: Bearer abc.def")).toContain(
      "Bearer [redacted]",
    );
  });
});
