import { parseAllowedUserIds } from "@/lib/telegram/security";

export type TelegramConfig = {
  botToken: string;
  webhookSecret: string;
  userEmail: string;
  allowedUserIds: number[];
  webhookUrl: string;
};

export function readTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig {
  return {
    botToken: (env.TELEGRAM_BOT_TOKEN || "").trim(),
    webhookSecret: (env.TELEGRAM_WEBHOOK_SECRET || "").trim(),
    userEmail: (env.TELEGRAM_USER_EMAIL || "").trim().toLowerCase(),
    allowedUserIds: parseAllowedUserIds(env.TELEGRAM_ALLOWED_USER_IDS),
    webhookUrl: (env.TELEGRAM_WEBHOOK_URL || "").trim().replace(/\/+$/, "")
  };
}

export function missingTelegramConfig(config: TelegramConfig): string[] {
  const missing: string[] = [];
  if (!config.botToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.webhookSecret) missing.push("TELEGRAM_WEBHOOK_SECRET");
  if (!config.userEmail) missing.push("TELEGRAM_USER_EMAIL");
  if (!config.allowedUserIds.length) missing.push("TELEGRAM_ALLOWED_USER_IDS");
  return missing;
}

export function isTelegramConfigured(config: TelegramConfig): boolean {
  return missingTelegramConfig(config).length === 0;
}

export const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";
