import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { priceEngine } from '../engine/priceEngine.js';
import { orderEngine } from '../engine/orderEngine.js';

export const portfolioRouter = Router();

// GET /api/portfolio
portfolioRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    const battleId = req.query.battleId as string | undefined;

    if (!userId) {
      res.status(400).json({ error: 'Параметр userId обязателен' });
      return;
    }

    let userBalance = 0;
    let lockedBalance = 0;

    if (battleId) {
      const bp = await db.getBattleParticipant(battleId, userId);
      if (!bp) {
        res.status(404).json({ error: 'Участник битвы не найден' });
        return;
      }
      userBalance = bp.balance;
      lockedBalance = bp.locked_balance;
    } else {
      const user = await db.getUser(userId);
      if (!user) {
        res.status(404).json({ error: 'Пользователь не найден' });
        return;
      }
      userBalance = user.balance;
      lockedBalance = user.locked_balance;
    }

    const positions = await db.getUserPositions(userId, battleId);
    const orders = await db.getUserOrders(userId, battleId);
    const trades = await db.getUserTrades(userId, 50);
    const capitalHistory = battleId ? [] : await db.getCapitalHistory(userId);

    // Calculate live position metrics
    let totalUnrealizedPnL = 0;
    let totalUsedMargin = 0;

    const enrichedPositions = positions.map(p => {
      const ticker = priceEngine.getTicker(p.symbol);
      const currentPrice = ticker ? (p.side === 'LONG' ? ticker.bid : ticker.ask) : p.entry_price;
      const unrealizedPnL = orderEngine.calculateUnrealizedPnL(p.side, p.entry_price, currentPrice, p.size);
      const roi = p.margin > 0 ? Number(((unrealizedPnL / p.margin) * 100).toFixed(2)) : 0;

      totalUnrealizedPnL += unrealizedPnL;
      totalUsedMargin += p.margin;

      return {
        ...p,
        current_price: currentPrice,
        unrealized_pnl: unrealizedPnL,
        roi
      };
    });

    // Realized PnL from trades
    const filteredTrades = battleId ? trades.filter(t => t.battle_id === battleId) : trades.filter(t => !t.battle_id);
    const totalRealizedPnL = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);

    // Total Equity = Available Balance + Locked Balance + Used Margin + Total Unrealized PnL
    const totalEquity = Number((userBalance + totalUsedMargin + totalUnrealizedPnL).toFixed(2));
    const availableBalance = Number((userBalance - lockedBalance).toFixed(2));

    res.json({
      totalBalance: Number((userBalance + totalUsedMargin).toFixed(2)),
      totalEquity,
      availableBalance: Math.max(0, availableBalance),
      lockedBalance,
      usedMargin: Number(totalUsedMargin.toFixed(2)),
      unrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
      realizedPnL: Number(totalRealizedPnL.toFixed(2)),
      positions: enrichedPositions,
      orders,
      trades: filteredTrades,
      capitalHistory
    });
  } catch (err: any) {
    console.error('[Portfolio] Error:', err);
    res.status(500).json({ error: err.message || 'Ошибка загрузки портфеля' });
  }
});
