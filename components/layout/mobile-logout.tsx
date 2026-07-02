"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function MobileLogout() {
  return (
    <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => signOut({ callbackUrl: "/auth/signin" })}>
      <LogOut className="h-4 w-4" />
      Вийти
    </Button>
  );
}
