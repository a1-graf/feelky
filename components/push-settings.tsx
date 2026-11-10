"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function postPush(body: unknown) {
  const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Помилка сервера");
  return data;
}

/** Push on/off for this device. Permission is asked only on a tap: iOS refuses it otherwise. */
export function PushSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const keyResponse = await fetch("/api/push", { cache: "no-store" });
      const { publicKey } = await keyResponse.json();
      if (!publicKey) throw new Error("Немає ключа сповіщень");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
      await postPush({ action: "subscribe", subscription: subscription.toJSON() });
      setState("on");
      setNote("Сповіщення увімкнено на цьому пристрої.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Не вдалося увімкнути");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await postPush({ action: "unsubscribe", endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Не вдалося вимкнути");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNote("");
    try {
      const result = await postPush({ action: "test" });
      setNote(result.sent ? "Тестове сповіщення надіслано." : "Немає підписаних пристроїв.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Не вдалося надіслати");
    } finally {
      setBusy(false);
    }
  }

  const hint = {
    loading: "Перевіряю…",
    unsupported: "Цей браузер не підтримує сповіщення.",
    "needs-install": "На iPhone сповіщення працюють лише у встановленому застосунку: Safari → Поділитися → «На екран Додому», потім відкрийте Feelky з іконки.",
    denied: "Сповіщення заборонені. Увімкніть їх у Параметрах iPhone → Сповіщення → Feelky.",
    off: "Сповіщення на цьому пристрої вимкнені.",
    on: "Сповіщення на цьому пристрої увімкнені."
  }[state];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="font-semibold">Сповіщення</div>
        <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{hint}</div>
        {note ? <div className="mt-1 text-sm">{note}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {state === "off" ? <Button onClick={enable} disabled={busy}>Увімкнути сповіщення</Button> : null}
        {state === "on" ? <Button variant="secondary" onClick={test} disabled={busy}>Тест</Button> : null}
        {state === "on" ? <Button variant="ghost" onClick={disable} disabled={busy}>Вимкнути</Button> : null}
      </div>
    </div>
  );
}
