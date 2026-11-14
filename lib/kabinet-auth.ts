import { createHash, scryptSync, timingSafeEqual } from "node:crypto";

/** Basic Auth for the /kabinet analytics page. Only a salted scrypt hash of the password lives here. */
export const KABINET_USER = "kabinet";
const SALT = Buffer.from("669840691c20ae10abc492fa1de76945", "hex");
const HASH = Buffer.from("387df650c7c6e28f665acb41bf3b51b21605eb1dda514c96548eb0377d075b5e", "hex");
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export function hashKabinetSecret(secret: string, salt: Buffer = SALT): Buffer {
  return scryptSync(secret, salt, HASH.length, SCRYPT);
}

/** Parses `Authorization: Basic …` into user and password; null when absent or malformed. */
export function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}

/** Constant-time check of both login and password. */
export function checkKabinetAuth(header: string | null, expected: { salt: Buffer; hash: Buffer } = { salt: SALT, hash: HASH }): boolean {
  const creds = parseBasicAuth(header);
  if (!creds) return false;
  const userOk = timingSafeEqual(sha256(creds.user), sha256(KABINET_USER));
  const passOk = timingSafeEqual(hashKabinetSecret(creds.password, expected.salt), expected.hash);
  return userOk && passOk;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
