import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { battleEngine } from '../engine/battleEngine.js';

export const battlesRouter = Router();

// GET /api/battles
battlesRouter.get('/', async (req: Request, res: Response) => {
  const battles = await db.getBattles();
  res.json(battles);
});

// GET /api/battles/:id
battlesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const battleId = req.params.id as string;
  const battle = await db.getBattle(battleId);
  if (!battle) {
    res.status(404).json({ error: 'Битва не найдена' });
    return;
  }

  const participants = await db.getBattleParticipants(battle.id);
  const enriched = await Promise.all(
    participants.map(async (bp) => {
      const calc = await battleEngine.calculateParticipantEquity(bp);
      return {
        ...bp,
        currentEquity: calc.equity,
        roi: calc.roi
      };
    })
  );

  // Sort by highest ROI
  enriched.sort((a, b) => b.roi - a.roi);

  res.json({
    battle,
    participants: enriched
  });
});

// POST /api/battles/:id/join
battlesRouter.post('/:id/join', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body;
  const battleId = req.params.id as string;
  if (!userId) {
    res.status(400).json({ error: 'userId обязателен' });
    return;
  }

  const result = await battleEngine.joinBattle(battleId, userId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(result);
});

// GET /api/battles/:id/portfolio
battlesRouter.get('/:id/portfolio', async (req: Request, res: Response): Promise<void> => {
  const userId = req.query.userId as string;
  const battleId = req.params.id as string;

  if (!userId) {
    res.status(400).json({ error: 'userId обязателен' });
    return;
  }

  const bp = await db.getBattleParticipant(battleId, userId);
  if (!bp) {
    res.status(404).json({ error: 'Вы не участвуете в этой битве' });
    return;
  }

  const calc = await battleEngine.calculateParticipantEquity(bp);
  const positions = await db.getUserPositions(userId, battleId);
  const orders = await db.getUserOrders(userId, battleId);

  res.json({
    participant: bp,
    currentEquity: calc.equity,
    roi: calc.roi,
    positions,
    orders
  });
});
