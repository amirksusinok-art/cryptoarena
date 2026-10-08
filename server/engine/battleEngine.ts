import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { Battle, BattleParticipant } from '../db/types.js';
import { priceEngine } from './priceEngine.js';
import { orderEngine } from './orderEngine.js';

export class BattleEngine extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  public init() {
    console.log('[BattleEngine] Trading battles engine initialized');
    // Check battles every 5 seconds
    this.timer = setInterval(() => {
      this.checkBattles();
    }, 5000);
  }

  public async createBattle(params: {
    title: string;
    symbol: string;
    durationMinutes: number;
    maxPlayers?: number;
    startDelaySeconds?: number;
  }): Promise<Battle> {
    const now = Date.now();
    const startTime = now + (params.startDelaySeconds || 0) * 1000;
    const endTime = startTime + params.durationMinutes * 60 * 1000;

    const battle: Battle = {
      id: `battle_${now}_${Math.random().toString(36).substring(2, 6)}`,
      title: params.title,
      symbol: params.symbol,
      duration_minutes: params.durationMinutes,
      starting_balance: 10000.0,
      max_players: params.maxPlayers || 20,
      status: startTime > now ? 'UPCOMING' : 'ACTIVE',
      start_time: startTime,
      end_time: endTime,
      created_at: now
    };

    await db.createBattle(battle);
    this.emit('battle_created', battle);
    return battle;
  }

  public async joinBattle(battleId: string, userId: string): Promise<{ success: boolean; error?: string; participant?: BattleParticipant }> {
    const battle = await db.getBattle(battleId);
    if (!battle) return { success: false, error: 'Битва не найдена' };
    if (battle.status === 'FINISHED') return { success: false, error: 'Битва уже завершена' };

    const existing = await db.getBattleParticipant(battleId, userId);
    if (existing) return { success: true, participant: existing };

    const participants = await db.getBattleParticipants(battleId);
    if (participants.length >= battle.max_players) {
      return { success: false, error: 'Достигнут максимум участников в этой битве' };
    }

    const user = await db.getUser(userId);
    if (!user) return { success: false, error: 'Пользователь не найден' };

    const bp: BattleParticipant = {
      id: `${battleId}_${userId}`,
      battle_id: battleId,
      user_id: userId,
      username: user.username || 'Trader',
      first_name: user.first_name || 'Anonymous',
      balance: battle.starting_balance,
      locked_balance: 0,
      roi: 0,
      created_at: Date.now()
    };

    await db.addBattleParticipant(bp);
    this.emit('participant_joined', { battle, participant: bp });
    return { success: true, participant: bp };
  }

  public async calculateParticipantEquity(bp: BattleParticipant): Promise<{ equity: number; roi: number }> {
    const positions = await db.getUserPositions(bp.user_id, bp.battle_id);
    let totalUnrealizedPnL = 0;
    let usedMargin = 0;

    for (const pos of positions) {
      usedMargin += pos.margin;
      const ticker = priceEngine.getTicker(pos.symbol);
      const curPrice = ticker ? (pos.side === 'LONG' ? ticker.bid : ticker.ask) : pos.entry_price;
      const pnl = orderEngine.calculateUnrealizedPnL(pos.side, pos.entry_price, curPrice, pos.size);
      totalUnrealizedPnL += pnl;
    }

    const equity = bp.balance + usedMargin + totalUnrealizedPnL;
    const initial = 10000.0;
    const roi = Number((((equity - initial) / initial) * 100).toFixed(2));
    return { equity: Number(equity.toFixed(2)), roi };
  }

  private async checkBattles() {
    const now = Date.now();
    const battles = await db.getBattles();

    for (const b of battles) {
      // Check upcoming -> active
      if (b.status === 'UPCOMING' && now >= b.start_time) {
        await db.updateBattle(b.id, { status: 'ACTIVE' });
        this.emit('battle_started', b);
      }

      // Check active -> finished
      if (b.status === 'ACTIVE' && now >= b.end_time) {
        await this.finishBattle(b);
      }
    }
  }

  private async finishBattle(battle: Battle) {
    const participants = await db.getBattleParticipants(battle.id);

    // 1. Close all open battle positions
    for (const bp of participants) {
      const positions = await db.getUserPositions(bp.user_id, battle.id);
      for (const pos of positions) {
        await orderEngine.closePosition(pos.id, 'MANUAL');
      }
    }

    // 2. Re-fetch participants with settled balances
    const settledParticipants = await db.getBattleParticipants(battle.id);
    const scoredList: { bp: BattleParticipant; finalEquity: number; roi: number }[] = [];

    for (const bp of settledParticipants) {
      const finalEquity = bp.balance;
      const roi = Number((((finalEquity - battle.starting_balance) / battle.starting_balance) * 100).toFixed(2));
      scoredList.push({ bp, finalEquity, roi });
    }

    // Sort by highest ROI
    scoredList.sort((a, b) => b.roi - a.roi);

    for (let i = 0; i < scoredList.length; i++) {
      const item = scoredList[i];
      const rank = i + 1;
      await db.updateBattleParticipant(item.bp.id, {
        final_equity: item.finalEquity,
        roi: item.roi,
        rank
      });
    }

    await db.updateBattle(battle.id, { status: 'FINISHED' });
    this.emit('battle_finished', { battle, rankings: scoredList });
  }
}

export const battleEngine = new BattleEngine();
