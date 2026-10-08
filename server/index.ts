import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { CONFIG } from './config.js';
import { db } from './db/index.js';
import { priceEngine } from './engine/priceEngine.js';
import { eventsEngine } from './engine/eventsEngine.js';
import { battleEngine } from './engine/battleEngine.js';
import { wsHandler } from './ws/wsHandler.js';
import { setupTelegramBot } from './bot/bot.js';

import { authRouter } from './routes/auth.js';
import { marketRouter } from './routes/market.js';
import { tradeRouter } from './routes/trade.js';
import { portfolioRouter } from './routes/portfolio.js';
import { socialRouter } from './routes/social.js';
import { battlesRouter } from './routes/battles.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting map (in-memory, section 37)
const rateLimits: Map<string, { count: number; resetAt: number }> = new Map();
app.use('/api/trade', (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(ip, { count: 1, resetAt: now + 1000 });
    return next();
  }

  if (entry.count > 10) {
    // Max 10 trade requests per second per IP
    res.status(429).json({ error: 'Too Many Requests: Пожалуйста, подождите перед следующим действием' });
    return;
  }

  entry.count++;
  next();
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/market', marketRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/social', socialRouter);
app.use('/api/battles', battlesRouter);
app.use('/api/admin', adminRouter);

// Health check endpoint for Render
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'CryptoArena', uptime: process.uptime() });
});

// Setup Telegram Bot
const bot = setupTelegramBot();
if (bot) {
  if (CONFIG.BOT_MODE === 'webhook') {
    const webhookPath = `/api/telegram/webhook`;
    app.use(bot.webhookCallback(webhookPath));
    const fullWebhookUrl = `${CONFIG.APP_URL}${webhookPath}`;
    bot.telegram.setWebhook(fullWebhookUrl).then(() => {
      console.log(`[TelegramBot] Webhook registered at: ${fullWebhookUrl}`);
    }).catch(err => {
      console.error('[TelegramBot] Failed setting webhook:', err);
    });
  } else {
    bot.launch().then(() => {
      console.log('[TelegramBot] Long polling started successfully!');
    }).catch(err => {
      console.error('[TelegramBot] Polling launch error:', err);
    });

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

// Serve client static assets
const clientDistPaths = [
  path.resolve(process.cwd(), 'dist/client'),
  path.resolve(process.cwd(), 'client/dist')
];

let activeDistPath: string | null = null;
for (const p of clientDistPaths) {
  if (fs.existsSync(p)) {
    activeDistPath = p;
    break;
  }
}

if (activeDistPath) {
  console.log(`[Server] Serving static client build from: ${activeDistPath}`);
  app.use(express.static(activeDistPath));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(activeDistPath!, 'index.html'));
  });
} else {
  console.log('[Server] Client dist folder not found yet. Vite dev server can be used on port 5173.');
  app.get('/', (req: Request, res: Response) => {
    res.send('<h1>CryptoArena Server API is running!</h1><p>Client build in progress or run Vite dev on port 5173.</p>');
  });
}

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
async function startServer() {
  await db.init();
  priceEngine.start();
  eventsEngine.init();
  battleEngine.init();
  wsHandler.init(server);

  // Seed sample initial battles if none exist
  const existingBattles = await db.getBattles();
  if (existingBattles.length === 0) {
    await battleEngine.createBattle({
      title: '⚡ BTC Blitz Tournament',
      symbol: 'BTC/USDT',
      durationMinutes: 30,
      maxPlayers: 20
    });
    await battleEngine.createBattle({
      title: '🚀 TON Arena Cup',
      symbol: 'TON/USDT',
      durationMinutes: 60,
      maxPlayers: 50,
      startDelaySeconds: 300
    });
  }

  // Seed sample bot news
  const existingNews = await db.getMarketNews(5);
  if (existingNews.length === 0) {
    await db.createMarketNews({
      id: `news_init_1`,
      symbol: 'GLOBAL',
      title: '🏛️ Открытие сезона CryptoArena',
      description: 'Виртуальная биржа открыта! Торгуйте криптовалютами с плечом до x100 в полностью контролируемой симуляции.',
      type: 'INFO',
      importance: 'HIGH',
      created_at: Date.now()
    });
  }

  server.listen(CONFIG.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 CryptoArena Server is running on port ${CONFIG.PORT}`);
    console.log(`🌐 URL: ${CONFIG.APP_URL}`);
    console.log(`📡 WebSocket: ws://localhost:${CONFIG.PORT}/ws`);
    console.log(`⚙️ Mode: ${CONFIG.NODE_ENV} | Bot Mode: ${CONFIG.BOT_MODE}`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('[Server Fatal] Failed to start server:', err);
  process.exit(1);
});
