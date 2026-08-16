import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard";
import { requireApiUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const userId = await requireApiUserId();
    return NextResponse.json(await getDashboard(userId));
  } catch (error) {
    return apiError(error, "Dashboard error");
  }
}
