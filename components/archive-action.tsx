"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ArchiveAction({ transactionId, archived }: { transactionId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: archived ? "restore" : "archive", transactionId })
      });
      if (!response.ok) return;
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" onClick={run} title={archived ? "Відновити" : "Архівувати"} disabled={pending}>
      {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
    </Button>
  );
}
