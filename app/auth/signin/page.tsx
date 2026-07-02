import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/forms/sign-in-form";
import { authOptions } from "@/lib/auth";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/statistics");
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <SignInForm />
    </main>
  );
}
