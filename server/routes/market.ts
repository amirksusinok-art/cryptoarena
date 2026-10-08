import { Router, Request, Response } from 'express';
import { priceEngine, Timeframe } from '../engine/priceEngine.js';
import { eventsEngine } from '../engine/eventsEngine.js';
import { db } from '../db/index.js';

export const marketRouter = Router();

// GET /api/market/tickers
marketRouter.get('/tickers', (req: Request, res: Response) => {
  const tickers = priceEngine.getAllTickers();

  // Top Gainers and Top Losers
  const sorted = [...tickers].sort((a, b) => b.change24hPercent - a.change24hPercent);
  const topGainers = sorted.slice(0, 3);
  const topLosers = [...sorted].reverse().slice(0, 3);

  res.json({
    tickers,
    topGainers,
    topLosers
  });
});

// GET /api/market/candles
marketRouter.get('/candles', (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || 'BTC/USDT';
  const timeframe = (req.query.timeframe as Timeframe) || '1m';

  const candles = priceEngine.getCandles(symbol, timeframe);
  res.json({ symbol, timeframe, candles });
});

// GET /api/market/orderbook
marketRouter.get('/orderbook', (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || 'BTC/USDT';
  const orderBook = priceEngine.getOrderBook(symbol);
  res.json(orderBook);
});

// GET /api/market/news
marketRouter.get('/news', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 30;
  const news = await db.getMarketNews(limit);
  res.json(news);
});

// GET /api/market/events
marketRouter.get('/events', (req: Request, res: Response) => {
  const activeEvents = eventsEngine.getActiveEventsList();
  res.json(activeEvents);
});

// GET /api/market/favorites
marketRouter.get('/favorites', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.json([]);
    return;
  }
  const favs = await db.getFavorites(userId);
  res.json(favs);
});

// POST /api/market/favorites/toggle
marketRouter.post('/favorites/toggle', async (req: Request, res: Response): Promise<void> => {
  const { userId, symbol } = req.body;
  if (!userId || !symbol) {
    res.status(400).json({ error: 'Missing userId or symbol' });
    return;
  }
  const current = await db.getFavorites(userId);
  if (current.includes(symbol)) {
    await db.removeFavorite(userId, symbol);
    res.json({ symbol, isFavorite: false });
  } else {
    await db.addFavorite(userId, symbol);
    res.json({ symbol, isFavorite: true });
  }
});
