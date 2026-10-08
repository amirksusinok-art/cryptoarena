import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { Position, Order, Trade, User } from '../db/types.js';
import { priceEngine, PriceTick } from './priceEngine.js';
import { CONFIG } from '../config.js';

interface PlaceOrderParams {
  userId: string;
  symbol: string;
  type: 'MARKET' | 'LIMIT';
  side: 'LONG' | 'SHORT';
  size: number; // Notional size in USDT
  leverage: number;
  limitPrice?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  battleId?: string | null;
  requestId?: string;
}

export class OrderEngine extends EventEmitter {
  // Concurrency mutex lock per user ID
  private userLocks: Map<string, Promise<void>> = new Map();
  // Idempotency cache (stores processed request IDs for 60 seconds)
  private processedRequests: Map<string, { result: any; expiresAt: number }> = new Map();

  constructor() {
    super();
    // Subscribe to price ticks for real-time order matching and liquidations
    priceEngine.on('tick', (tick: PriceTick) => {
      this.processPriceTick(tick);
    });

    // Clean up expired idempotency keys every 30 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [key, val] of this.processedRequests) {
        if (val.expiresAt < now) this.processedRequests.delete(key);
      }
    }, 30000);
  }

  // --- User Mutex Lock ---
  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    while (this.userLocks.has(userId)) {
      await this.userLocks.get(userId);
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.userLocks.set(userId, lockPromise);

    try {
      return await fn();
    } finally {
      this.userLocks.delete(userId);
      resolveLock();
    }
  }

  // --- Calculate Liquidation Price ---
  public calculateLiquidationPrice(
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    leverage: number,
    maintenanceRate = CONFIG.MAINTENANCE_MARGIN_RATE,
    commissionRate = CONFIG.DEFAULT_COMMISSION_RATE
  ): number {
    if (side === 'LONG') {
      // LiqPrice = EntryPrice * (1 - 1/leverage + maintenanceRate + commissionRate)
      const ratio = 1 - 1 / leverage + maintenanceRate + commissionRate;
      return Math.max(0.00001, Number((entryPrice * ratio).toFixed(6)));
    } else {
      // LiqPrice = EntryPrice * (1 + 1/leverage - maintenanceRate - commissionRate)
      const ratio = 1 + 1 / leverage - maintenanceRate - commissionRate;
      return Number((entryPrice * ratio).toFixed(6));
    }
  }

  // --- Calculate Unrealized PnL ---
  public calculateUnrealizedPnL(side: 'LONG' | 'SHORT', entryPrice: number, currentPrice: number, size: number): number {
    if (entryPrice <= 0) return 0;
    if (side === 'LONG') {
      return Number((size * ((currentPrice - entryPrice) / entryPrice)).toFixed(4));
    } else {
      return Number((size * ((entryPrice - currentPrice) / entryPrice)).toFixed(4));
    }
  }

  // --- Place Order (Market or Limit) ---
  public async placeOrder(params: PlaceOrderParams): Promise<{ success: boolean; data?: any; error?: string }> {
    // Check idempotency key
    if (params.requestId && this.processedRequests.has(params.requestId)) {
      return this.processedRequests.get(params.requestId)!.result;
    }

    const result = await this.withUserLock(params.userId, async () => {
      const ticker = priceEngine.getTicker(params.symbol);
      if (!ticker) {
        return { success: false, error: 'Торговая пара не найдена' };
      }

      if (params.leverage < 1 || params.leverage > ticker.maxLeverage) {
        return { success: false, error: `Кредитное плечо должно быть от x1 до x${ticker.maxLeverage}` };
      }

      if (params.size <= 0) {
        return { success: false, error: 'Размер позиции должен быть больше 0' };
      }

      // Check user / battle account balance
      let userBalance = 0;
      let userLocked = 0;

      if (params.battleId) {
        const bp = await db.getBattleParticipant(params.battleId, params.userId);
        if (!bp) return { success: false, error: 'Вы не являетесь участником этой битвы' };
        userBalance = bp.balance;
        userLocked = bp.locked_balance;
      } else {
        const user = await db.getUser(params.userId);
        if (!user) return { success: false, error: 'Пользователь не найден' };
        userBalance = user.balance;
        userLocked = user.locked_balance;
      }

      const availableBalance = userBalance - userLocked;
      const margin = Number((params.size / params.leverage).toFixed(4));
      const entryFee = Number((params.size * CONFIG.DEFAULT_COMMISSION_RATE).toFixed(4));
      const totalRequired = margin + entryFee;

      if (availableBalance < totalRequired) {
        return {
          success: false,
          error: `Недостаточно свободных средств. Требуется $${totalRequired.toFixed(2)} ($${margin.toFixed(2)} маржа + $${entryFee.toFixed(2)} комиссия), доступно $${availableBalance.toFixed(2)}`
        };
      }

      const now = Date.now();

      // ================= MARKET ORDER =================
      if (params.type === 'MARKET') {
        // Execute immediately at current server price with spread
        const execPrice = params.side === 'LONG' ? ticker.ask : ticker.bid;
        const maintMargin = Number((params.size * CONFIG.MAINTENANCE_MARGIN_RATE).toFixed(4));
        const liqPrice = this.calculateLiquidationPrice(params.side, execPrice, params.leverage);

        // Deduct margin + entry fee from balance
        if (params.battleId) {
          await db.updateBattleParticipant(`${params.battleId}_${params.userId}`, {
            balance: Number((userBalance - totalRequired).toFixed(4))
          });
        } else {
          await db.updateUser(params.userId, {
            balance: Number((userBalance - totalRequired).toFixed(4))
          });
        }

        const positionId = `pos_${now}_${Math.random().toString(36).substring(2, 6)}`;
        const position: Position = {
          id: positionId,
          user_id: params.userId,
          symbol: params.symbol,
          side: params.side,
          entry_price: execPrice,
          size: params.size,
          leverage: params.leverage,
          margin,
          maintenance_margin: maintMargin,
          liquidation_price: liqPrice,
          stop_loss: params.stopLoss || null,
          take_profit: params.takeProfit || null,
          status: 'OPEN',
          entry_fee: entryFee,
          battle_id: params.battleId || null,
          created_at: now
        };

        await db.createPosition(position);

        // Audit log
        await db.createAuditLog({
          id: `log_${now}`,
          user_id: params.userId,
          action: 'OPEN_MARKET_POSITION',
          details: JSON.stringify({ positionId, symbol: params.symbol, side: params.side, price: execPrice, size: params.size, leverage: params.leverage, fee: entryFee }),
          request_id: params.requestId || null,
          status: 'SUCCESS',
          created_at: now
        });

        this.emit('position_opened', position);
        return { success: true, data: { type: 'POSITION', position } };
      }

      // ================= LIMIT ORDER =================
      if (params.type === 'LIMIT') {
        if (!params.limitPrice || params.limitPrice <= 0) {
          return { success: false, error: 'Укажите корректную цену лимитного ордера' };
        }

        // Lock margin + entry fee in locked_balance
        if (params.battleId) {
          await db.updateBattleParticipant(`${params.battleId}_${params.userId}`, {
            locked_balance: Number((userLocked + totalRequired).toFixed(4))
          });
        } else {
          await db.updateUser(params.userId, {
            locked_balance: Number((userLocked + totalRequired).toFixed(4))
          });
        }

        const orderId = `ord_${now}_${Math.random().toString(36).substring(2, 6)}`;
        const order: Order = {
          id: orderId,
          user_id: params.userId,
          symbol: params.symbol,
          type: 'LIMIT',
          side: params.side,
          price: params.limitPrice,
          size: params.size,
          leverage: params.leverage,
          margin,
          locked_amount: totalRequired,
          stop_loss: params.stopLoss || null,
          take_profit: params.takeProfit || null,
          status: 'PENDING',
          battle_id: params.battleId || null,
          created_at: now
        };

        await db.createOrder(order);

        await db.createAuditLog({
          id: `log_${now}`,
          user_id: params.userId,
          action: 'CREATE_LIMIT_ORDER',
          details: JSON.stringify({ orderId, symbol: params.symbol, side: params.side, limitPrice: params.limitPrice, size: params.size }),
          request_id: params.requestId || null,
          status: 'SUCCESS',
          created_at: now
        });

        this.emit('order_created', order);
        return { success: true, data: { type: 'ORDER', order } };
      }

      return { success: false, error: 'Неизвестный тип ордера' };
    });

    // Store in idempotency cache
    if (params.requestId) {
      this.processedRequests.set(params.requestId, {
        result,
        expiresAt: Date.now() + 60000
      });
    }

    return result;
  }

  // --- Close Position (Manual or Triggered) ---
  public async closePosition(
    positionId: string,
    reason: 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIQUIDATION',
    customClosePrice?: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const pos = await db.getPosition(positionId);
    if (!pos || pos.status !== 'OPEN') {
      return { success: false, error: 'Позиция не найдена или уже закрыта' };
    }

    return this.withUserLock(pos.user_id, async () => {
      // Re-fetch to ensure no race condition
      const freshPos = await db.getPosition(positionId);
      if (!freshPos || freshPos.status !== 'OPEN') {
        return { success: false, error: 'Позиция уже закрыта' };
      }

      const ticker = priceEngine.getTicker(freshPos.symbol);
      const closePrice = customClosePrice || (freshPos.side === 'LONG' ? ticker?.bid || freshPos.entry_price : ticker?.ask || freshPos.entry_price);
      const now = Date.now();

      // Calculate gross unrealized PnL
      const grossPnL = this.calculateUnrealizedPnL(freshPos.side, freshPos.entry_price, closePrice, freshPos.size);
      const closeFee = Number((freshPos.size * CONFIG.DEFAULT_COMMISSION_RATE).toFixed(4));

      let netReturnedAmount = 0;
      let finalRealizedPnL = 0;

      if (reason === 'LIQUIDATION') {
        // Position equity fell below maintenance margin: user loses isolated margin
        netReturnedAmount = 0;
        finalRealizedPnL = -freshPos.margin;
      } else {
        // Standard close: return Margin + Gross PnL - Close Fee
        finalRealizedPnL = Number((grossPnL - freshPos.entry_fee - closeFee).toFixed(4));
        netReturnedAmount = Math.max(0, Number((freshPos.margin + grossPnL - closeFee).toFixed(4)));
      }

      // Return net proceeds to user balance
      if (freshPos.battle_id) {
        const bp = await db.getBattleParticipant(freshPos.battle_id, freshPos.user_id);
        if (bp) {
          const newBalance = Number((bp.balance + netReturnedAmount).toFixed(4));
          await db.updateBattleParticipant(bp.id, { balance: newBalance });
        }
      } else {
        const user = await db.getUser(freshPos.user_id);
        if (user) {
          const newBalance = Number((user.balance + netReturnedAmount).toFixed(4));
          await db.updateUser(user.id, { balance: newBalance });
        }
      }

      // Update position
      const updatedPos = await db.updatePosition(positionId, {
        status: reason === 'LIQUIDATION' ? 'LIQUIDATED' : 'CLOSED',
        close_price: closePrice,
        realized_pnl: finalRealizedPnL,
        close_fee: closeFee,
        closed_at: now
      });

      // Record trade history
      const roi = Number(((finalRealizedPnL / freshPos.margin) * 100).toFixed(2));
      const trade: Trade = {
        id: `trd_${now}_${Math.random().toString(36).substring(2, 6)}`,
        position_id: positionId,
        user_id: freshPos.user_id,
        symbol: freshPos.symbol,
        side: freshPos.side,
        entry_price: freshPos.entry_price,
        exit_price: closePrice,
        size: freshPos.size,
        leverage: freshPos.leverage,
        pnl: finalRealizedPnL,
        roi,
        close_reason: reason,
        total_fee: freshPos.entry_fee + closeFee,
        battle_id: freshPos.battle_id,
        created_at: now
      };
      await db.createTrade(trade);

      // Add point to capital history if main portfolio
      if (!freshPos.battle_id) {
        const user = await db.getUser(freshPos.user_id);
        if (user) {
          await db.addCapitalPoint(user.id, user.balance);
        }
      }

      // Emit event
      this.emit('position_closed', { position: updatedPos, trade, reason });

      return { success: true, data: { position: updatedPos, trade, reason } };
    });
  }

  // --- Cancel Pending Order ---
  public async cancelOrder(orderId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const order = await db.getOrder(orderId);
    if (!order || order.user_id !== userId || order.status !== 'PENDING') {
      return { success: false, error: 'Ордер не найден или уже исполнен/отменён' };
    }

    return this.withUserLock(userId, async () => {
      const freshOrder = await db.getOrder(orderId);
      if (!freshOrder || freshOrder.status !== 'PENDING') {
        return { success: false, error: 'Ордер уже обработан' };
      }

      // Unlock locked_balance
      if (freshOrder.battle_id) {
        const bp = await db.getBattleParticipant(freshOrder.battle_id, userId);
        if (bp) {
          const newLocked = Math.max(0, Number((bp.locked_balance - freshOrder.locked_amount).toFixed(4)));
          await db.updateBattleParticipant(bp.id, { locked_balance: newLocked });
        }
      } else {
        const user = await db.getUser(userId);
        if (user) {
          const newLocked = Math.max(0, Number((user.locked_balance - freshOrder.locked_amount).toFixed(4)));
          await db.updateUser(user.id, { locked_balance: newLocked });
        }
      }

      await db.updateOrder(orderId, { status: 'CANCELLED' });
      this.emit('order_cancelled', freshOrder);
      return { success: true };
    });
  }

  // --- Update Stop Loss / Take Profit for Open Position ---
  public async updatePositionSLTP(
    positionId: string,
    userId: string,
    stopLoss?: number | null,
    takeProfit?: number | null
  ): Promise<{ success: boolean; data?: Position; error?: string }> {
    const pos = await db.getPosition(positionId);
    if (!pos || pos.user_id !== userId || pos.status !== 'OPEN') {
      return { success: false, error: 'Позиция не найдена' };
    }

    const updated = await db.updatePosition(positionId, {
      stop_loss: stopLoss !== undefined ? stopLoss : pos.stop_loss,
      take_profit: takeProfit !== undefined ? takeProfit : pos.take_profit
    });

    this.emit('position_updated', updated);
    return { success: true, data: updated || undefined };
  }

  // --- Process Price Tick (Real-Time Matching & Liquidations) ---
  private async processPriceTick(tick: PriceTick) {
    // 1. Process Pending Limit Orders for this symbol
    const pendingOrders = await db.getPendingOrders();
    const symbolOrders = pendingOrders.filter(o => o.symbol === tick.symbol);

    for (const order of symbolOrders) {
      let isExecutable = false;
      let executionPrice = order.price;

      if (order.side === 'LONG') {
        // Buy Limit: executes if current ask <= limitPrice
        // Gap rule: if gap down occurred, execute at the better (lower) price!
        if (tick.ask <= order.price) {
          isExecutable = true;
          executionPrice = tick.ask; // Better or equal price
        }
      } else {
        // Sell Limit: executes if current bid >= limitPrice
        // Gap rule: if gap up occurred, execute at the better (higher) price!
        if (tick.bid >= order.price) {
          isExecutable = true;
          executionPrice = tick.bid; // Better or equal price
        }
      }

      if (isExecutable) {
        await this.executeLimitOrder(order, executionPrice);
      }
    }

    // 2. Check Open Positions for this symbol (SL, TP, and Liquidation)
    const openPositions = await db.getAllOpenPositions();
    const symbolPositions = openPositions.filter(p => p.symbol === tick.symbol);

    for (const pos of symbolPositions) {
      const currentPrice = pos.side === 'LONG' ? tick.bid : tick.ask;

      // Check Take Profit
      if (pos.take_profit) {
        const tpTriggered = pos.side === 'LONG' ? currentPrice >= pos.take_profit : currentPrice <= pos.take_profit;
        if (tpTriggered) {
          await this.closePosition(pos.id, 'TAKE_PROFIT', pos.take_profit);
          continue;
        }
      }

      // Check Stop Loss
      if (pos.stop_loss) {
        const slTriggered = pos.side === 'LONG' ? currentPrice <= pos.stop_loss : currentPrice >= pos.stop_loss;
        if (slTriggered) {
          await this.closePosition(pos.id, 'STOP_LOSS', pos.stop_loss);
          continue;
        }
      }

      // Check Liquidation
      const isLiquidated = pos.side === 'LONG' ? currentPrice <= pos.liquidation_price : currentPrice >= pos.liquidation_price;
      if (isLiquidated) {
        await this.closePosition(pos.id, 'LIQUIDATION', pos.liquidation_price);
        continue;
      }

      // Check Liquidation Warning (within 10% of liquidation price)
      const distanceToLiq = Math.abs(currentPrice - pos.liquidation_price) / pos.entry_price;
      if (distanceToLiq < 0.02) {
        this.emit('liquidation_warning', { position: pos, currentPrice });
      }
    }
  }

  // --- Execute Limit Order to Position ---
  private async executeLimitOrder(order: Order, execPrice: number) {
    await this.withUserLock(order.user_id, async () => {
      const freshOrder = await db.getOrder(order.id);
      if (!freshOrder || freshOrder.status !== 'PENDING') return;

      const now = Date.now();
      const entryFee = Number((freshOrder.size * CONFIG.DEFAULT_COMMISSION_RATE).toFixed(4));
      const maintMargin = Number((freshOrder.size * CONFIG.MAINTENANCE_MARGIN_RATE).toFixed(4));
      const liqPrice = this.calculateLiquidationPrice(freshOrder.side, execPrice, freshOrder.leverage);

      // Deduct from balance and release locked_balance
      if (freshOrder.battle_id) {
        const bp = await db.getBattleParticipant(freshOrder.battle_id, freshOrder.user_id);
        if (bp) {
          const newLocked = Math.max(0, Number((bp.locked_balance - freshOrder.locked_amount).toFixed(4)));
          const newBalance = Math.max(0, Number((bp.balance - freshOrder.locked_amount).toFixed(4)));
          await db.updateBattleParticipant(bp.id, { balance: newBalance, locked_balance: newLocked });
        }
      } else {
        const user = await db.getUser(freshOrder.user_id);
        if (user) {
          const newLocked = Math.max(0, Number((user.locked_balance - freshOrder.locked_amount).toFixed(4)));
          const newBalance = Math.max(0, Number((user.balance - freshOrder.locked_amount).toFixed(4)));
          await db.updateUser(user.id, { balance: newBalance, locked_balance: newLocked });
        }
      }

      // Mark order filled
      await db.updateOrder(order.id, { status: 'FILLED', filled_at: now });

      // Create new position
      const positionId = `pos_${now}_${Math.random().toString(36).substring(2, 6)}`;
      const position: Position = {
        id: positionId,
        user_id: freshOrder.user_id,
        symbol: freshOrder.symbol,
        side: freshOrder.side,
        entry_price: execPrice,
        size: freshOrder.size,
        leverage: freshOrder.leverage,
        margin: freshOrder.margin,
        maintenance_margin: maintMargin,
        liquidation_price: liqPrice,
        stop_loss: freshOrder.stop_loss,
        take_profit: freshOrder.take_profit,
        status: 'OPEN',
        entry_fee: entryFee,
        battle_id: freshOrder.battle_id,
        created_at: now
      };
      await db.createPosition(position);

      this.emit('limit_filled', { order: freshOrder, position, execPrice });
    });
  }
}

export const orderEngine = new OrderEngine();
