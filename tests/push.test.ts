import { describe, expect, it } from "vitest";
import { pushMessageSchema } from "@/lib/push";

describe("pushMessageSchema", () => {
  it("defaults body and url", () => {
    expect(pushMessageSchema.parse({ title: "Hi" })).toEqual({ title: "Hi", body: "", url: "/dashboard" });
  });

  it("accepts only in-app paths", () => {
    expect(pushMessageSchema.parse({ title: "Hi", url: "/fx?tab=1" }).url).toBe("/fx?tab=1");
    expect(() => pushMessageSchema.parse({ title: "Hi", url: "https://evil.example" })).toThrow();
    expect(() => pushMessageSchema.parse({ title: "Hi", url: "//evil.example" })).toThrow();
  });

  it("requires a title", () => {
    expect(() => pushMessageSchema.parse({ title: "  " })).toThrow();
  });
});
