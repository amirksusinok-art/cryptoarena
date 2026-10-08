import { Router, Request, Response } from 'express';
import { orderEngine } from '../engine/orderEngine.js';

export const tradeRouter = Router();

// POST /api/trade/order
tradeRouter.post('/order', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      symbol,
      type,
      side,
      size,
      leverage,
      limitPrice,
      stopLoss,
      takeProfit,
      battleId,
      requestId
    } = req.body;

    if (!userId || !symbol || !type || !side || !size || !leverage) {
      res.status(400).json({ error: 'Все поля ордера обязательны для заполнения' });
      return;
    }

    const result = await orderEngine.placeOrder({
      userId,
      symbol,
      type,
      side,
      size: parseFloat(size),
      leverage: parseInt(leverage, 10),
      limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      battleId: battleId || null,
      requestId
    });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('[TradeRouter] Order error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки сделки' });
  }
});

// POST /api/trade/close
tradeRouter.post('/close', async (req: Request, res: Response): Promise<void> => {
  try {
    const { positionId } = req.body;
    if (!positionId) {
      res.status(400).json({ error: 'ID позиции не указан' });
      return;
    }

    const result = await orderEngine.closePosition(positionId, 'MANUAL');
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка закрытия сделки' });
  }
});

// POST /api/trade/cancel
tradeRouter.post('/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, userId } = req.body;
    if (!orderId || !userId) {
      res.status(400).json({ error: 'orderId и userId обязательны' });
      return;
    }

    const result = await orderEngine.cancelOrder(orderId, userId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка отмены ордера' });
  }
});

// POST /api/trade/sltp
tradeRouter.post('/sltp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { positionId, userId, stopLoss, takeProfit } = req.body;
    if (!positionId || !userId) {
      res.status(400).json({ error: 'positionId и userId обязательны' });
      return;
    }

    const result = await orderEngine.updatePositionSLTP(
      positionId,
      userId,
      stopLoss !== undefined && stopLoss !== null ? parseFloat(stopLoss) : null,
      takeProfit !== undefined && takeProfit !== null ? parseFloat(takeProfit) : null
    );

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка обновления SL/TP' });
  }
});
