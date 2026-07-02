"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SignInForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setMessage("");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "");
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Реєстрація не вдалася");
      }
      const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/statistics" });
      if (result?.error) throw new Error("Невірний email або пароль");
      window.location.href = "/statistics";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Feelky</h1>
        <p className="mt-1 text-sm text-muted-foreground">Вхід до персонального фінансового dashboard</p>
      </div>
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-muted p-1">
        <button className={`min-h-10 rounded-md text-sm ${mode === "login" ? "bg-card text-[hsl(var(--card-foreground))] shadow" : "text-white/85 hover:text-white"}`} onClick={() => setMode("login")} type="button">Вхід</button>
        <button className={`min-h-10 rounded-md text-sm ${mode === "register" ? "bg-card text-[hsl(var(--card-foreground))] shadow" : "text-white/85 hover:text-white"}`} onClick={() => setMode("register")} type="button">Реєстрація</button>
      </div>
      <form action={submit} className="grid gap-3">
        {mode === "register" && <label>Ім&apos;я<input name="name" autoComplete="name" /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Пароль<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={8} /></label>
        {message && <div className="rounded-lg bg-muted p-3 text-sm">{message}</div>}
        <Button disabled={loading}>{loading ? "Зачекайте..." : mode === "register" ? "Створити і увійти" : "Увійти"}</Button>
        <Button type="button" variant="secondary" className="text-white hover:text-white" onClick={() => signIn("google", { callbackUrl: "/statistics" })}>
          Увійти через Google
        </Button>
      </form>
    </Card>
  );
}
