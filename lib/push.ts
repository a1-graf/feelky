import webpush from "web-push";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Web Push for the installed app (iOS shows it only for the home-screen PWA, 16.4+).
 * VAPID keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; without them a pair is generated
 * once and kept in AppConfig, so push works before anyone touches the Vercel env.
 */

const VAPID_CONFIG_KEY = "vapid";

type VapidKeys = { publicKey: string; privateKey: string };

let cached: VapidKeys | null = null;

export async function vapidKeys(env: NodeJS.ProcessEnv = process.env): Promise<VapidKeys> {
  const publicKey = (env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || "").trim();
  if (publicKey && privateKey) return { publicKey, privateKey };
  if (cached) return cached;
  const stored = await prisma.appConfig.findUnique({ where: { key: VAPID_CONFIG_KEY } });
  if (stored) return (cached = JSON.parse(stored.value) as VapidKeys);
  const generated = webpush.generateVAPIDKeys();
  // Two cold starts racing: whoever writes first wins, the other reads that row back.
  await prisma.appConfig.upsert({
    where: { key: VAPID_CONFIG_KEY },
    create: { key: VAPID_CONFIG_KEY, value: JSON.stringify(generated) },
    update: {}
  });
  const saved = await prisma.appConfig.findUniqueOrThrow({ where: { key: VAPID_CONFIG_KEY } });
  return (cached = JSON.parse(saved.value) as VapidKeys);
}

export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) })
});

export const pushMessageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(1000).default(""),
  // Only paths inside the app: a tap must not open a foreign site.
  url: z.string().trim().regex(/^\/(?!\/)/, "url must be a path like /dashboard").max(500).default("/dashboard")
});

export type PushMessage = z.infer<typeof pushMessageSchema>;

export async function saveSubscription(userId: string, subscription: z.infer<typeof subscriptionSchema>, userAgent: string | null) {
  const data = { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null };
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { endpoint: subscription.endpoint, ...data },
    update: data
  });
}

export async function removeSubscription(userId: string, endpoint: string) {
  const { count } = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return count;
}

/** Sends to every device of the user. Endpoints the push service reports as gone are deleted. */
export async function sendPush(userId: string, message: PushMessage) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subscriptions.length) return { devices: 0, sent: 0, removed: 0, failed: 0 };
  const keys = await vapidKeys();
  const subject = (process.env.VAPID_SUBJECT || "").trim() || "https://feelky.vercel.app";
  const payload = JSON.stringify(message);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24, urgency: "high" }
      );
      sent += 1;
      await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastSentAt: new Date() } });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        removed += 1;
      } else {
        failed += 1;
        console.error("[push] send failed", status, error instanceof Error ? error.message : error);
      }
    }
  }));
  return { devices: subscriptions.length, sent, removed, failed };
}
