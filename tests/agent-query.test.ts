import { describe, expect, it } from "vitest";
import { bearerToken, kyivDayStart, kyivStamp, MAX_TRANSACTION_LIMIT, parseTransactionQuery } from "@/lib/agent-query";

const NOW = new Date("2026-09-19T09:00:00.000Z");

describe("bearer token", () => {
  it("reads the token from an Authorization header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer   abc123  ")).toBe("abc123");
  });

  it("rejects anything that is not a bearer header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken("abc123")).toBeNull();
  });
});

describe("kyiv day boundaries", () => {
  it("starts a summer day at 21:00 UTC the day before", () => {
    expect(kyivDayStart("2026-09-01").toISOString()).toBe("2026-08-31T21:00:00.000Z");
  });

  it("starts a winter day at 22:00 UTC the day before", () => {
    expect(kyivDayStart("2026-01-15").toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });

  it("renders instants in Kyiv time", () => {
    expect(kyivStamp(new Date("2026-08-31T21:30:00.000Z"))).toBe("2026-09-01 00:30");
  });
});

describe("transaction query", () => {
  it("defaults to the last 30 Kyiv days and 50 rows", () => {
    const query = parseTransactionQuery(new URLSearchParams(), NOW);
    expect(query.limit).toBe(50);
    expect(query.type).toBeNull();
    expect(kyivStamp(query.from)).toBe("2026-08-21 00:00");
    expect(kyivStamp(query.to)).toBe("2026-09-19 23:59");
  });

  it("uses explicit dates inclusively", () => {
    const query = parseTransactionQuery(new URLSearchParams({ from: "2026-09-01", to: "2026-09-10" }), NOW);
    expect(kyivStamp(query.from)).toBe("2026-09-01 00:00");
    expect(kyivStamp(query.to)).toBe("2026-09-10 23:59");
  });

  it("caps the limit and ignores junk", () => {
    expect(parseTransactionQuery(new URLSearchParams({ limit: "9999" }), NOW).limit).toBe(MAX_TRANSACTION_LIMIT);
    expect(parseTransactionQuery(new URLSearchParams({ limit: "-5" }), NOW).limit).toBe(50);
    expect(parseTransactionQuery(new URLSearchParams({ limit: "abc" }), NOW).limit).toBe(50);
  });

  it("accepts a known type and drops an unknown one", () => {
    expect(parseTransactionQuery(new URLSearchParams({ type: "expense" }), NOW).type).toBe("EXPENSE");
    expect(parseTransactionQuery(new URLSearchParams({ type: "DROP TABLE" }), NOW).type).toBeNull();
  });

  it("falls back on malformed dates", () => {
    const query = parseTransactionQuery(new URLSearchParams({ from: "yesterday", to: "31-12-2026" }), NOW);
    expect(kyivStamp(query.to)).toBe("2026-09-19 23:59");
  });
});
