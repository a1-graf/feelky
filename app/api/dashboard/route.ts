import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard";
import { requireApiUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireApiUserId();
    return NextResponse.json(await getDashboard(userId));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
