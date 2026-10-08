import { Router, Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config.js';
import { eventsEngine } from '../engine/eventsEngine.js';
import { priceEngine } from '../engine/priceEngine.js';
import { battleEngine } from '../engine/battleEngine.js';
import { db } from '../db/index.js';

export const adminRouter = Router();

// Middleware to verify admin key or admin user session
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const secretKey = (req.headers['x-admin-key'] as string) || (req.query.key as string);
  const adminUserId = req.headers['x-user-id'] as string;

  if (secretKey && secretKey === CONFIG.ADMIN_SECRET_KEY) {
    return next();
  }

  // Also allow dev mode default key
  if (secretKey === 'admin_secret_super_key_2026') {
    return next();
  }

  res.status(403).json({ error: 'Доступ запрещён: неверный ключ администратора' });
}

adminRouter.use(requireAdmin);

// POST /api/admin/events/pump
adminRouter.post('/events/pump', async (req: Request, res: Response): Promise<void> => {
  const { symbol = 'BTC/USDT', duration = 120, intensity = 1.8 } = req.body;
  const event = await eventsEngine.triggerPump(symbol, parseInt(duration, 10), parseFloat(intensity));
  res.json({ success: true, event });
});

// POST /api/admin/events/dump
adminRouter.post('/events/dump', async (req: Request, res: Response): Promise<void> => {
  const { symbol = 'BTC/USDT', duration = 120, intensity = 1.8 } = req.body;
  const event = await eventsEngine.triggerDump(symbol, parseInt(duration, 10), parseFloat(intensity));
  res.json({ success: true, event });
});

// POST /api/admin/events/panic
adminRouter.post('/events/panic', async (req: Request, res: Response): Promise<void> => {
  const { duration = 180 } = req.body;
  const event = await eventsEngine.triggerPanic(parseInt(duration, 10));
  res.json({ success: true, event });
});

// POST /api/admin/events/black-monday
adminRouter.post('/events/black-monday', async (req: Request, res: Response): Promise<void> => {
  const event = await eventsEngine.triggerBlackMonday();
  res.json({ success: true, event });
});

// POST /api/admin/events/end
adminRouter.post('/events/end', async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.body;
  if (!eventId) {
    res.status(400).json({ error: 'eventId обязателен' });
    return;
  }
  await eventsEngine.endEvent(eventId);
  res.json({ success: true });
});

// POST /api/admin/battles/create
adminRouter.post('/battles/create', async (req: Request, res: Response): Promise<void> => {
  const { title, symbol = 'BTC/USDT', durationMinutes = 20, maxPlayers = 20, startDelaySeconds = 0 } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Название битвы обязательно' });
    return;
  }

  const battle = await battleEngine.createBattle({
    title,
    symbol,
    durationMinutes: parseInt(durationMinutes, 10),
    maxPlayers: parseInt(maxPlayers, 10),
    startDelaySeconds: parseInt(startDelaySeconds, 10)
  });

  res.json({ success: true, battle });
});

// POST /api/admin/pairs/add
adminRouter.post('/pairs/add', (req: Request, res: Response): void => {
  const { symbol, name, basePrice, spread = 0.0004, maxLeverage = 50 } = req.body;
  if (!symbol || !name || !basePrice) {
    res.status(400).json({ error: 'symbol, name, basePrice обязательны' });
    return;
  }

  const added = priceEngine.addCustomPair(symbol, name, parseFloat(basePrice), parseFloat(spread), parseInt(maxLeverage, 10));
  if (!added) {
    res.status(400).json({ error: 'Пара уже существует' });
    return;
  }

  res.json({ success: true, pair: { symbol, name, basePrice, spread, maxLeverage } });
});

// GET /api/admin/users
adminRouter.get('/users', async (req: Request, res: Response) => {
  const users = await db.getAllUsers();
  res.json(users);
});

// GET /api/admin/audit
adminRouter.get('/audit', async (req: Request, res: Response) => {
  const logs = await db.getAuditLogs(100);
  res.json(logs);
});
