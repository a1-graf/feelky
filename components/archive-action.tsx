"use client";

import { ArchiveRestore, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ArchiveAction({ transactionId, archived }: { transactionId: string; archived: boolean }) {
  async function run() {
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: archived ? "restore" : "archive", transactionId })
    });
    window.location.reload();
  }

  return (
    <Button variant="secondary" onClick={run} title={archived ? "Відновити" : "Архівувати"}>
      {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
    </Button>
  );
}
