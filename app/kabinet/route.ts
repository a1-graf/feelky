import { readFile } from "node:fs/promises";
import path from "node:path";
import { checkKabinetAuth } from "@/lib/kabinet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow"
};

/** Static analytics page behind HTTP Basic Auth; independent of NextAuth. The HTML is served byte for byte. */
export async function GET(request: Request) {
  if (!checkKabinetAuth(request.headers.get("authorization"))) {
    return new Response("Authentication required", {
      status: 401,
      headers: { ...PRIVATE_HEADERS, "WWW-Authenticate": 'Basic realm="kabinet", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" }
    });
  }
  const html = await readFile(path.join(process.cwd(), "content/kabinet/index.html"));
  return new Response(new Uint8Array(html), {
    status: 200,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/html; charset=utf-8" }
  });
}
