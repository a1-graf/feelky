import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ensureUserDefaults } from "@/lib/user-defaults";

export async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect("/auth/signin");
  await ensureUserDefaults(userId);
  return userId;
}

export async function requireApiUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  await ensureUserDefaults(userId);
  return userId;
}
