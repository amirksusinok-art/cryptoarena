import { Telegraf } from 'telegraf';
import { db } from '../db/index.js';

interface QueuedNotification {
  telegramId: string;
  message: string;
  key: string;
  timestamp: number;
}

export class Notifier {
  private bot: Telegraf | null = null;
  private queue: QueuedNotification[] = [];
  private sentKeys: Map<string, number> = new Map();
  private isProcessing = false;

  public setBot(bot: Telegraf) {
    this.bot = bot;
    this.startQueueWorker();
  }

  public async notifyUser(telegramId: string, message: string, deduplicationKey?: string) {
    if (!telegramId || !this.bot) return;

    // Deduplication check (prevent duplicate messages with same key within 60 seconds)
    const key = deduplicationKey || `${telegramId}_${message.substring(0, 20)}`;
    const now = Date.now();
    const lastSent = this.sentKeys.get(key);
    if (lastSent && now - lastSent < 60000) {
      return; // Skip duplicate
    }

    this.queue.push({
      telegramId,
      message,
      key,
      timestamp: now
    });
  }

  public async broadcast(message: string, deduplicationKey?: string) {
    if (!this.bot) return;
    const users = await db.getAllUsers();
    for (const u of users) {
      if (u.telegram_id && !u.telegram_id.startsWith('mock_')) {
        await this.notifyUser(u.telegram_id, message, `${deduplicationKey}_${u.telegram_id}`);
      }
    }
  }

  private startQueueWorker() {
    setInterval(async () => {
      if (this.isProcessing || this.queue.length === 0 || !this.bot) return;
      this.isProcessing = true;

      const item = this.queue.shift();
      if (item) {
        try {
          await this.bot.telegram.sendMessage(item.telegramId, item.message, { parse_mode: 'HTML' });
          this.sentKeys.set(item.key, Date.now());
        } catch (err: any) {
          // Ignore if user blocked bot or invalid chat
          console.warn(`[Notifier] Could not send message to ${item.telegramId}:`, err?.message || err);
        }
      }

      this.isProcessing = false;
    }, 100); // 100ms throttle between Telegram messages
  }
}

export const notifier = new Notifier();
