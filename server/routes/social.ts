import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { CONFIG } from '../config.js';

export const socialRouter = Router();

// Helper to compute user stats
async function computeUserStats(userId: string) {
  const user = await db.getUser(userId);
  if (!user) return null;

  const trades = await db.getUserTrades(userId, 500);
  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = totalTrades > 0 ? Math.round((winningTrades.length / totalTrades) * 100) : 0;

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const roi = Number((((user.balance - CONFIG.STARTING_BALANCE) / CONFIG.STARTING_BALANCE) * 100).toFixed(2));

  const avgProfit = winningTrades.length > 0 ? Number((winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length).toFixed(2)) : 0;
  const avgLoss = losingTrades.length > 0 ? Number((losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length).toFixed(2)) : 0;

  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0;

  // Max Drawdown calculation from capital history
  const capitalHistory = await db.getCapitalHistory(userId);
  let maxDrawdown = 0;
  if (capitalHistory.length > 1) {
    let peak = capitalHistory[0].equity;
    for (const pt of capitalHistory) {
      if (pt.equity > peak) peak = pt.equity;
      const dd = ((peak - pt.equity) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  return {
    user,
    stats: {
      roi,
      winRate,
      pnl: Number(totalPnL.toFixed(2)),
      tradesCount: totalTrades,
      avgProfit,
      avgLoss,
      bestTrade: Number(bestTrade.toFixed(2)),
      worstTrade: Number(worstTrade.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2))
    }
  };
}

// GET /api/social/leaderboard
socialRouter.get('/leaderboard', async (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'all';
  const allUsers = await db.getAllUsers();

  const leaders = await Promise.all(
    allUsers.map(async (u) => {
      const statsObj = await computeUserStats(u.id);
      return {
        id: u.id,
        telegramId: u.telegram_id,
        username: u.username || u.first_name || 'Trader',
        firstName: u.first_name,
        photoUrl: u.photo_url,
        balance: u.balance,
        roi: statsObj?.stats.roi || 0,
        winRate: statsObj?.stats.winRate || 0,
        tradesCount: statsObj?.stats.tradesCount || 0,
        pnl: statsObj?.stats.pnl || 0
      };
    })
  );

  // Sort by highest ROI
  leaders.sort((a, b) => b.roi - a.roi);

  // Add rank
  const ranked = leaders.map((item, index) => ({
    ...item,
    rank: index + 1
  }));

  res.json({ period, leaderboard: ranked });
});

// GET /api/social/profile/:userId
socialRouter.get('/profile/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const result = await computeUserStats(userId);
  if (!result) {
    res.status(404).json({ error: 'Профиль не найден' });
    return;
  }

  const capitalHistory = await db.getCapitalHistory(userId);
  res.json({
    ...result,
    capitalHistory
  });
});

// GET /api/social/friends
socialRouter.get('/friends', async (req: Request, res: Response): Promise<void> => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId обязателен' });
    return;
  }

  const friends = await db.getFriends(userId);
  const friendsWithStats = await Promise.all(
    friends.map(async (f) => {
      const stat = await computeUserStats(f.id);
      return {
        id: f.id,
        username: f.username,
        firstName: f.first_name,
        roi: stat?.stats.roi || 0,
        winRate: stat?.stats.winRate || 0,
        pnl: stat?.stats.pnl || 0,
        balance: f.balance
      };
    })
  );

  res.json(friendsWithStats);
});

// POST /api/social/friends/add
socialRouter.post('/friends/add', async (req: Request, res: Response): Promise<void> => {
  const { userId, targetUsername } = req.body;
  if (!userId || !targetUsername) {
    res.status(400).json({ error: 'userId и targetUsername обязательны' });
    return;
  }

  const allUsers = await db.getAllUsers();
  const target = allUsers.find(u => u.username?.toLowerCase() === targetUsername.toLowerCase() || u.id === targetUsername);

  if (!target) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }

  if (target.id === userId) {
    res.status(400).json({ error: 'Нельзя добавить самого себя в друзья' });
    return;
  }

  await db.addFriend(userId, target.id);
  res.json({ success: true, friend: target });
});

// POST /api/social/friends/remove
socialRouter.post('/friends/remove', async (req: Request, res: Response): Promise<void> => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    res.status(400).json({ error: 'userId и friendId обязательны' });
    return;
  }

  await db.removeFriend(userId, friendId);
  res.json({ success: true });
});

// GET /api/social/compare
socialRouter.get('/compare', async (req: Request, res: Response): Promise<void> => {
  const userId = req.query.userId as string;
  const friendId = req.query.friendId as string;

  if (!userId || !friendId) {
    res.status(400).json({ error: 'userId и friendId обязательны' });
    return;
  }

  const userStats = await computeUserStats(userId);
  const friendStats = await computeUserStats(friendId);

  if (!userStats || !friendStats) {
    res.status(404).json({ error: 'Один из пользователей не найден' });
    return;
  }

  // Find ranks in leaderboard
  const allUsers = await db.getAllUsers();
  const sorted = allUsers
    .map(u => ({
      id: u.id,
      roi: Number((((u.balance - CONFIG.STARTING_BALANCE) / CONFIG.STARTING_BALANCE) * 100).toFixed(2))
    }))
    .sort((a, b) => b.roi - a.roi);

  const userRank = sorted.findIndex(s => s.id === userId) + 1;
  const friendRank = sorted.findIndex(s => s.id === friendId) + 1;

  res.json({
    you: {
      id: userStats.user.id,
      username: userStats.user.username || userStats.user.first_name,
      ...userStats.stats,
      rank: userRank || 1
    },
    friend: {
      id: friendStats.user.id,
      username: friendStats.user.username || friendStats.user.first_name,
      ...friendStats.stats,
      rank: friendRank || 1
    }
  });
});
