"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui";

export type ActionResult = { ok: boolean; message: string };

/**
 * A form posting to a server action that answers { ok, message }: the message shows under the form,
 * a refusal (not enough money, more than is left) never turns into an error page.
 */
export function ActionForm({
  action,
  children,
  className,
  confirmText,
  resetOnSuccess = true
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={form}
      className={cn(className, pending && "pointer-events-none opacity-70")}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const outcome = await action(data);
            setResult(outcome);
            if (outcome.ok) {
              if (resetOnSuccess) form.current?.reset();
              router.refresh();
            }
          } catch {
            setResult({ ok: false, message: "Не вдалося зберегти. Спробуй ще раз." });
          }
        });
      }}
    >
      {children}
      {result && (
        <div role="status" className={cn("col-span-full rounded-lg px-3 py-2 text-sm", result.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
          {result.message}
        </div>
      )}
    </form>
  );
}
