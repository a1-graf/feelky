import { readFileSync } from "node:fs";
import { BOT_COMMANDS, ALLOWED_UPDATES } from "@/lib/telegram/commands";
import { TELEGRAM_WEBHOOK_PATH, readTelegramConfig } from "@/lib/telegram/config";
import { getWebhookInfo, setMyCommands, setWebhook } from "@/lib/telegram/api";

/** Minimal .env loader so the script works with plain `tsx` and no extra dependency. */
function loadEnvFile(file = ".env") {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadEnvFile();
  const config = readTelegramConfig();

  const missing: string[] = [];
  if (!config.botToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.webhookSecret) missing.push("TELEGRAM_WEBHOOK_SECRET");
  if (!config.webhookUrl) missing.push("TELEGRAM_WEBHOOK_URL");
  if (missing.length) {
    console.error(`Заповни env перед підключенням webhook: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (!config.webhookUrl.startsWith("https://")) {
    console.error("TELEGRAM_WEBHOOK_URL має бути публічним HTTPS-адресом, напр. https://feelky.example.com");
    process.exitCode = 1;
    return;
  }
  if (!config.allowedUserIds.length) {
    console.warn("Увага: TELEGRAM_ALLOWED_USER_IDS порожній — бот не прийме жодної команди.");
  }
  if (!config.userEmail) {
    console.warn("Увага: TELEGRAM_USER_EMAIL порожній — бот не знатиме, до якого акаунта Feelky писати.");
  }

  const url = `${config.webhookUrl}${TELEGRAM_WEBHOOK_PATH}`;
  await setWebhook(config.botToken, url, config.webhookSecret, ALLOWED_UPDATES);
  console.log(`Webhook встановлено: ${url}`);

  await setMyCommands(config.botToken, BOT_COMMANDS);
  console.log(`Зареєстровано команд: ${BOT_COMMANDS.length}`);

  const info = await getWebhookInfo(config.botToken);
  console.log(`Поточний webhook: ${info.url || "—"}`);
  console.log(`Необроблених оновлень: ${info.pending_update_count ?? 0}`);
  if (info.last_error_message) console.warn(`Остання помилка Telegram: ${info.last_error_message}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Не вдалося налаштувати webhook");
  process.exitCode = 1;
});
