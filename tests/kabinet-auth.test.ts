import { describe, expect, it } from "vitest";
import { checkKabinetAuth, hashKabinetSecret, parseBasicAuth } from "@/lib/kabinet-auth";

const basic = (user: string, password: string) => "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
const expected = { salt, hash: hashKabinetSecret("test-secret", salt) };

describe("kabinet basic auth", () => {
  it("parses the header", () => {
    expect(parseBasicAuth(basic("kabinet", "a:b"))).toEqual({ user: "kabinet", password: "a:b" });
    expect(parseBasicAuth(null)).toBeNull();
    expect(parseBasicAuth("Bearer x")).toBeNull();
  });

  it("accepts only the right login and password", () => {
    expect(checkKabinetAuth(basic("kabinet", "test-secret"), expected)).toBe(true);
    expect(checkKabinetAuth(basic("kabinet", "wrong"), expected)).toBe(false);
    expect(checkKabinetAuth(basic("admin", "test-secret"), expected)).toBe(false);
    expect(checkKabinetAuth(null, expected)).toBe(false);
  });
});
