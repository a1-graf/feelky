import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const getCurrentSession = cache(() => getServerSession(authOptions));

export async function requireUserId() {
  const session = await getCurrentSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/auth/signin");
  return userId;
}

export async function requireApiUserId() {
  const session = await getCurrentSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
