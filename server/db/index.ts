import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { CONFIG } from '../config.js';
import {
  User,
  Position,
  Order,
  Trade,
  Battle,
  BattleParticipant,
  MarketNews,
  MarketEvent,
  AuditLog,
  CapitalPoint
} from './types.js';

interface DatabaseData {
  users: User[];
  positions: Position[];
  orders: Order[];
  trades: Trade[];
  battles: Battle[];
  battle_participants: BattleParticipant[];
  market_news: MarketNews[];
  market_events: MarketEvent[];
  audit_logs: AuditLog[];
  favorites: { id: string; user_id: string; symbol: string }[];
  friends: { id: string; user_id: string; friend_id: string }[];
  capital_history: CapitalPoint[];
}

const defaultData: DatabaseData = {
  users: [],
  positions: [],
  orders: [],
  trades: [],
  battles: [],
  battle_participants: [],
  market_news: [],
  market_events: [],
  audit_logs: [],
  favorites: [],
  friends: [],
  capital_history: []
};

class DatabaseService {
  private pgPool: pg.Pool | null = null;
  private localData: DatabaseData = defaultData;
  private dataDir = path.resolve(process.cwd(), 'data');
  private dataFilePath = path.resolve(this.dataDir, 'cryptoarena_store.json');
  private isPg = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    if (CONFIG.DATABASE_URL && CONFIG.DATABASE_URL.startsWith('postgres')) {
      try {
        console.log('[DB] Connecting to PostgreSQL database...');
        this.pgPool = new pg.Pool({
          connectionString: CONFIG.DATABASE_URL,
          ssl: CONFIG.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
        });

        // Test connection
        await this.pgPool.query('SELECT 1');
        this.isPg = true;
        await this.initPgTables();
        console.log('[DB] Connected and synced PostgreSQL tables successfully!');
        return;
      } catch (err) {
        console.warn('[DB] Failed connecting to PostgreSQL, falling back to local file store:', err);
        this.isPg = false;
      }
    }

    // Local JSON file store fallback
    console.log('[DB] Initializing local persistent store...');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.dataFilePath)) {
      try {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.localData = { ...defaultData, ...JSON.parse(raw) };
        console.log(`[DB] Loaded local data (${this.localData.users.length} users, ${this.localData.positions.length} positions)`);
      } catch (e) {
        console.error('[DB] Error parsing existing db file, resetting to clean state:', e);
        this.localData = defaultData;
        this.saveLocal();
      }
    } else {
      this.saveLocal();
      console.log('[DB] Created new local storage file at data/cryptoarena_store.json');
    }
  }

  private saveLocal() {
    if (this.isPg) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(this.dataFilePath, JSON.stringify(this.localData, null, 2), 'utf-8');
      } catch (err) {
        console.error('[DB] Failed saving data to file:', err);
      }
    }, 200);
  }

  private async initPgTables() {
    if (!this.pgPool) return;
    const client = await this.pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          telegram_id VARCHAR(64) UNIQUE NOT NULL,
          username VARCHAR(64),
          first_name VARCHAR(128),
          photo_url TEXT,
          balance NUMERIC(16, 4) NOT NULL DEFAULT 10000.00,
          locked_balance NUMERIC(16, 4) NOT NULL DEFAULT 0.00,
          is_admin INT NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS positions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          symbol VARCHAR(32) NOT NULL,
          side VARCHAR(16) NOT NULL,
          entry_price NUMERIC(16, 4) NOT NULL,
          size NUMERIC(16, 4) NOT NULL,
          leverage INT NOT NULL,
          margin NUMERIC(16, 4) NOT NULL,
          maintenance_margin NUMERIC(16, 4) NOT NULL,
          liquidation_price NUMERIC(16, 4) NOT NULL,
          stop_loss NUMERIC(16, 4),
          take_profit NUMERIC(16, 4),
          status VARCHAR(16) NOT NULL,
          close_price NUMERIC(16, 4),
          realized_pnl NUMERIC(16, 4),
          entry_fee NUMERIC(16, 4) NOT NULL,
          close_fee NUMERIC(16, 4),
          battle_id VARCHAR(64),
          created_at BIGINT NOT NULL,
          closed_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          symbol VARCHAR(32) NOT NULL,
          type VARCHAR(16) NOT NULL,
          side VARCHAR(16) NOT NULL,
          price NUMERIC(16, 4) NOT NULL,
          size NUMERIC(16, 4) NOT NULL,
          leverage INT NOT NULL,
          margin NUMERIC(16, 4) NOT NULL,
          locked_amount NUMERIC(16, 4) NOT NULL,
          stop_loss NUMERIC(16, 4),
          take_profit NUMERIC(16, 4),
          status VARCHAR(16) NOT NULL,
          battle_id VARCHAR(64),
          created_at BIGINT NOT NULL,
          filled_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS trades (
          id VARCHAR(64) PRIMARY KEY,
          position_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          symbol VARCHAR(32) NOT NULL,
          side VARCHAR(16) NOT NULL,
          entry_price NUMERIC(16, 4) NOT NULL,
          exit_price NUMERIC(16, 4) NOT NULL,
          size NUMERIC(16, 4) NOT NULL,
          leverage INT NOT NULL,
          pnl NUMERIC(16, 4) NOT NULL,
          roi NUMERIC(16, 4) NOT NULL,
          close_reason VARCHAR(32) NOT NULL,
          total_fee NUMERIC(16, 4) NOT NULL,
          battle_id VARCHAR(64),
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS battles (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(128) NOT NULL,
          symbol VARCHAR(32) NOT NULL,
          duration_minutes INT NOT NULL,
          starting_balance NUMERIC(16, 4) NOT NULL DEFAULT 10000.00,
          max_players INT NOT NULL,
          status VARCHAR(16) NOT NULL,
          start_time BIGINT NOT NULL,
          end_time BIGINT NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS battle_participants (
          id VARCHAR(64) PRIMARY KEY,
          battle_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          username VARCHAR(64),
          first_name VARCHAR(128),
          balance NUMERIC(16, 4) NOT NULL,
          locked_balance NUMERIC(16, 4) NOT NULL DEFAULT 0.00,
          final_equity NUMERIC(16, 4),
          roi NUMERIC(16, 4) NOT NULL DEFAULT 0.00,
          rank INT,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS market_news (
          id VARCHAR(64) PRIMARY KEY,
          symbol VARCHAR(32) NOT NULL,
          title VARCHAR(256) NOT NULL,
          description TEXT NOT NULL,
          type VARCHAR(32) NOT NULL,
          importance VARCHAR(16) NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS market_events (
          id VARCHAR(64) PRIMARY KEY,
          type VARCHAR(32) NOT NULL,
          symbol VARCHAR(32),
          phase VARCHAR(32) NOT NULL,
          intensity NUMERIC(8, 4) NOT NULL,
          start_time BIGINT NOT NULL,
          end_time BIGINT NOT NULL,
          status VARCHAR(16) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          action VARCHAR(64) NOT NULL,
          details TEXT NOT NULL,
          ip VARCHAR(64),
          request_id VARCHAR(64),
          status VARCHAR(32) NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS favorites (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          symbol VARCHAR(32) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS friends (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          friend_id VARCHAR(64) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS capital_history (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          equity NUMERIC(16, 4) NOT NULL,
          timestamp BIGINT NOT NULL
        );
      `);
    } finally {
      client.release();
    }
  }

  // --- Users ---
  async getUser(id: string): Promise<User | null> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (!res.rows.length) return null;
      return this.mapUser(res.rows[0]);
    }
    return this.localData.users.find(u => u.id === id) || null;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
      if (!res.rows.length) return null;
      return this.mapUser(res.rows[0]);
    }
    return this.localData.users.find(u => u.telegram_id === telegramId) || null;
  }

  async createUser(user: User): Promise<User> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO users (id, telegram_id, username, first_name, photo_url, balance, locked_balance, is_admin, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [user.id, user.telegram_id, user.username, user.first_name, user.photo_url || null, user.balance, user.locked_balance, user.is_admin, user.created_at, user.updated_at]
      );
      return user;
    }
    this.localData.users.push(user);
    this.saveLocal();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    if (this.isPg && this.pgPool) {
      const keys = Object.keys(updates);
      if (!keys.length) return this.getUser(id);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map(k => (updates as any)[k]);
      await this.pgPool.query(`UPDATE users SET ${setClauses}, updated_at = $${keys.length + 2} WHERE id = $1`, [id, ...values, Date.now()]);
      return this.getUser(id);
    }
    const idx = this.localData.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.localData.users[idx] = { ...this.localData.users[idx], ...updates, updated_at: Date.now() };
    this.saveLocal();
    return this.localData.users[idx];
  }

  async getAllUsers(): Promise<User[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM users');
      return res.rows.map(this.mapUser);
    }
    return [...this.localData.users];
  }

  // --- Positions ---
  async getPosition(id: string): Promise<Position | null> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM positions WHERE id = $1', [id]);
      return res.rows.length ? this.mapPosition(res.rows[0]) : null;
    }
    return this.localData.positions.find(p => p.id === id) || null;
  }

  async getUserPositions(userId: string, battleId?: string | null): Promise<Position[]> {
    if (this.isPg && this.pgPool) {
      let query = 'SELECT * FROM positions WHERE user_id = $1 AND status = $2';
      const params: any[] = [userId, 'OPEN'];
      if (battleId) {
        query += ' AND battle_id = $3';
        params.push(battleId);
      } else {
        query += ' AND battle_id IS NULL';
      }
      const res = await this.pgPool.query(query, params);
      return res.rows.map(this.mapPosition);
    }
    return this.localData.positions.filter(p => {
      if (p.user_id !== userId || p.status !== 'OPEN') return false;
      if (battleId) return p.battle_id === battleId;
      return !p.battle_id;
    });
  }

  async getAllOpenPositions(): Promise<Position[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query("SELECT * FROM positions WHERE status = 'OPEN'");
      return res.rows.map(this.mapPosition);
    }
    return this.localData.positions.filter(p => p.status === 'OPEN');
  }

  async createPosition(pos: Position): Promise<Position> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO positions (id, user_id, symbol, side, entry_price, size, leverage, margin, maintenance_margin, liquidation_price, stop_loss, take_profit, status, entry_fee, battle_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [pos.id, pos.user_id, pos.symbol, pos.side, pos.entry_price, pos.size, pos.leverage, pos.margin, pos.maintenance_margin, pos.liquidation_price, pos.stop_loss || null, pos.take_profit || null, pos.status, pos.entry_fee, pos.battle_id || null, pos.created_at]
      );
      return pos;
    }
    this.localData.positions.push(pos);
    this.saveLocal();
    return pos;
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | null> {
    if (this.isPg && this.pgPool) {
      const keys = Object.keys(updates);
      if (!keys.length) return this.getPosition(id);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map(k => (updates as any)[k]);
      await this.pgPool.query(`UPDATE positions SET ${setClauses} WHERE id = $1`, [id, ...values]);
      return this.getPosition(id);
    }
    const idx = this.localData.positions.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.localData.positions[idx] = { ...this.localData.positions[idx], ...updates };
    this.saveLocal();
    return this.localData.positions[idx];
  }

  // --- Orders ---
  async getOrder(id: string): Promise<Order | null> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM orders WHERE id = $1', [id]);
      return res.rows.length ? this.mapOrder(res.rows[0]) : null;
    }
    return this.localData.orders.find(o => o.id === id) || null;
  }

  async getUserOrders(userId: string, battleId?: string | null): Promise<Order[]> {
    if (this.isPg && this.pgPool) {
      let query = 'SELECT * FROM orders WHERE user_id = $1 AND status = $2';
      const params: any[] = [userId, 'PENDING'];
      if (battleId) {
        query += ' AND battle_id = $3';
        params.push(battleId);
      } else {
        query += ' AND battle_id IS NULL';
      }
      const res = await this.pgPool.query(query, params);
      return res.rows.map(this.mapOrder);
    }
    return this.localData.orders.filter(o => {
      if (o.user_id !== userId || o.status !== 'PENDING') return false;
      if (battleId) return o.battle_id === battleId;
      return !o.battle_id;
    });
  }

  async getPendingOrders(): Promise<Order[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query("SELECT * FROM orders WHERE status = 'PENDING'");
      return res.rows.map(this.mapOrder);
    }
    return this.localData.orders.filter(o => o.status === 'PENDING');
  }

  async createOrder(order: Order): Promise<Order> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO orders (id, user_id, symbol, type, side, price, size, leverage, margin, locked_amount, stop_loss, take_profit, status, battle_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [order.id, order.user_id, order.symbol, order.type, order.side, order.price, order.size, order.leverage, order.margin, order.locked_amount, order.stop_loss || null, order.take_profit || null, order.status, order.battle_id || null, order.created_at]
      );
      return order;
    }
    this.localData.orders.push(order);
    this.saveLocal();
    return order;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
    if (this.isPg && this.pgPool) {
      const keys = Object.keys(updates);
      if (!keys.length) return this.getOrder(id);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map(k => (updates as any)[k]);
      await this.pgPool.query(`UPDATE orders SET ${setClauses} WHERE id = $1`, [id, ...values]);
      return this.getOrder(id);
    }
    const idx = this.localData.orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    this.localData.orders[idx] = { ...this.localData.orders[idx], ...updates };
    this.saveLocal();
    return this.localData.orders[idx];
  }

  // --- Trades (History) ---
  async createTrade(trade: Trade): Promise<Trade> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO trades (id, position_id, user_id, symbol, side, entry_price, exit_price, size, leverage, pnl, roi, close_reason, total_fee, battle_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [trade.id, trade.position_id, trade.user_id, trade.symbol, trade.side, trade.entry_price, trade.exit_price, trade.size, trade.leverage, trade.pnl, trade.roi, trade.close_reason, trade.total_fee, trade.battle_id || null, trade.created_at]
      );
      return trade;
    }
    this.localData.trades.unshift(trade);
    this.saveLocal();
    return trade;
  }

  async getUserTrades(userId: string, limit = 50): Promise<Trade[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
      return res.rows.map(this.mapTrade);
    }
    return this.localData.trades
      .filter(t => t.user_id === userId)
      .slice(0, limit);
  }

  // --- Battles ---
  async getBattles(status?: string): Promise<Battle[]> {
    if (this.isPg && this.pgPool) {
      const query = status ? 'SELECT * FROM battles WHERE status = $1 ORDER BY start_time DESC' : 'SELECT * FROM battles ORDER BY start_time DESC';
      const res = await this.pgPool.query(query, status ? [status] : []);
      return res.rows.map(this.mapBattle);
    }
    if (status) {
      return this.localData.battles.filter(b => b.status === status);
    }
    return [...this.localData.battles];
  }

  async getBattle(id: string): Promise<Battle | null> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM battles WHERE id = $1', [id]);
      return res.rows.length ? this.mapBattle(res.rows[0]) : null;
    }
    return this.localData.battles.find(b => b.id === id) || null;
  }

  async createBattle(battle: Battle): Promise<Battle> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO battles (id, title, symbol, duration_minutes, starting_balance, max_players, status, start_time, end_time, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [battle.id, battle.title, battle.symbol, battle.duration_minutes, battle.starting_balance, battle.max_players, battle.status, battle.start_time, battle.end_time, battle.created_at]
      );
      return battle;
    }
    this.localData.battles.push(battle);
    this.saveLocal();
    return battle;
  }

  async updateBattle(id: string, updates: Partial<Battle>): Promise<Battle | null> {
    if (this.isPg && this.pgPool) {
      const keys = Object.keys(updates);
      if (!keys.length) return this.getBattle(id);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map(k => (updates as any)[k]);
      await this.pgPool.query(`UPDATE battles SET ${setClauses} WHERE id = $1`, [id, ...values]);
      return this.getBattle(id);
    }
    const idx = this.localData.battles.findIndex(b => b.id === id);
    if (idx === -1) return null;
    this.localData.battles[idx] = { ...this.localData.battles[idx], ...updates };
    this.saveLocal();
    return this.localData.battles[idx];
  }

  async getBattleParticipants(battleId: string): Promise<BattleParticipant[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM battle_participants WHERE battle_id = $1 ORDER BY roi DESC', [battleId]);
      return res.rows.map(this.mapBattleParticipant);
    }
    return this.localData.battle_participants
      .filter(bp => bp.battle_id === battleId)
      .sort((a, b) => b.roi - a.roi);
  }

  async getBattleParticipant(battleId: string, userId: string): Promise<BattleParticipant | null> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM battle_participants WHERE battle_id = $1 AND user_id = $2', [battleId, userId]);
      return res.rows.length ? this.mapBattleParticipant(res.rows[0]) : null;
    }
    return this.localData.battle_participants.find(bp => bp.battle_id === battleId && bp.user_id === userId) || null;
  }

  async addBattleParticipant(bp: BattleParticipant): Promise<BattleParticipant> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO battle_participants (id, battle_id, user_id, username, first_name, balance, locked_balance, final_equity, roi, rank, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [bp.id, bp.battle_id, bp.user_id, bp.username, bp.first_name, bp.balance, bp.locked_balance, bp.final_equity || null, bp.roi, bp.rank || null, bp.created_at]
      );
      return bp;
    }
    this.localData.battle_participants.push(bp);
    this.saveLocal();
    return bp;
  }

  async updateBattleParticipant(id: string, updates: Partial<BattleParticipant>): Promise<BattleParticipant | null> {
    if (this.isPg && this.pgPool) {
      const keys = Object.keys(updates);
      if (!keys.length) return null;
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map(k => (updates as any)[k]);
      await this.pgPool.query(`UPDATE battle_participants SET ${setClauses} WHERE id = $1`, [id, ...values]);
      const res = await this.pgPool.query('SELECT * FROM battle_participants WHERE id = $1', [id]);
      return res.rows.length ? this.mapBattleParticipant(res.rows[0]) : null;
    }
    const idx = this.localData.battle_participants.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.localData.battle_participants[idx] = { ...this.localData.battle_participants[idx], ...updates };
    this.saveLocal();
    return this.localData.battle_participants[idx];
  }

  // --- Market News & Events ---
  async getMarketNews(limit = 30): Promise<MarketNews[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM market_news ORDER BY created_at DESC LIMIT $1', [limit]);
      return res.rows.map(this.mapMarketNews);
    }
    return [...this.localData.market_news].slice(0, limit);
  }

  async createMarketNews(news: MarketNews): Promise<MarketNews> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO market_news (id, symbol, title, description, type, importance, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [news.id, news.symbol, news.title, news.description, news.type, news.importance, news.created_at]
      );
      return news;
    }
    this.localData.market_news.unshift(news);
    if (this.localData.market_news.length > 200) {
      this.localData.market_news = this.localData.market_news.slice(0, 200);
    }
    this.saveLocal();
    return news;
  }

  async getActiveEvents(): Promise<MarketEvent[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query("SELECT * FROM market_events WHERE status = 'ACTIVE'");
      return res.rows.map(this.mapMarketEvent);
    }
    return this.localData.market_events.filter(e => e.status === 'ACTIVE');
  }

  async createMarketEvent(event: MarketEvent): Promise<MarketEvent> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO market_events (id, type, symbol, phase, intensity, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [event.id, event.type, event.symbol || null, event.phase, event.intensity, event.start_time, event.end_time, event.status]
      );
      return event;
    }
    this.localData.market_events.push(event);
    this.saveLocal();
    return event;
  }

  async updateMarketEvent(id: string, updates: Partial<MarketEvent>): Promise<MarketEvent | null> {
    if (this.isPg && this.pgPool) {
      const keys = Object.keys(updates);
      if (!keys.length) return null;
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = keys.map(k => (updates as any)[k]);
      await this.pgPool.query(`UPDATE market_events SET ${setClauses} WHERE id = $1`, [id, ...values]);
      const res = await this.pgPool.query('SELECT * FROM market_events WHERE id = $1', [id]);
      return res.rows.length ? this.mapMarketEvent(res.rows[0]) : null;
    }
    const idx = this.localData.market_events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this.localData.market_events[idx] = { ...this.localData.market_events[idx], ...updates };
    this.saveLocal();
    return this.localData.market_events[idx];
  }

  // --- Audit Log ---
  async createAuditLog(log: AuditLog): Promise<void> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO audit_logs (id, user_id, action, details, ip, request_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [log.id, log.user_id || null, log.action, log.details, log.ip || null, log.request_id || null, log.status, log.created_at]
      );
      return;
    }
    this.localData.audit_logs.unshift(log);
    if (this.localData.audit_logs.length > 500) {
      this.localData.audit_logs = this.localData.audit_logs.slice(0, 500);
    }
    this.saveLocal();
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
      return res.rows.map(this.mapAuditLog);
    }
    return this.localData.audit_logs.slice(0, limit);
  }

  // --- Favorites ---
  async getFavorites(userId: string): Promise<string[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT symbol FROM favorites WHERE user_id = $1', [userId]);
      return res.rows.map(r => r.symbol);
    }
    return this.localData.favorites.filter(f => f.user_id === userId).map(f => f.symbol);
  }

  async addFavorite(userId: string, symbol: string): Promise<void> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        'INSERT INTO favorites (id, user_id, symbol) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [`${userId}_${symbol}`, userId, symbol]
      );
      return;
    }
    if (!this.localData.favorites.some(f => f.user_id === userId && f.symbol === symbol)) {
      this.localData.favorites.push({ id: `${userId}_${symbol}`, user_id: userId, symbol });
      this.saveLocal();
    }
  }

  async removeFavorite(userId: string, symbol: string): Promise<void> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query('DELETE FROM favorites WHERE user_id = $1 AND symbol = $2', [userId, symbol]);
      return;
    }
    this.localData.favorites = this.localData.favorites.filter(f => !(f.user_id === userId && f.symbol === symbol));
    this.saveLocal();
  }

  // --- Friends ---
  async getFriends(userId: string): Promise<User[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query(
        `SELECT u.* FROM users u
         JOIN friends f ON f.friend_id = u.id
         WHERE f.user_id = $1`,
        [userId]
      );
      return res.rows.map(this.mapUser);
    }
    const friendIds = this.localData.friends.filter(f => f.user_id === userId).map(f => f.friend_id);
    return this.localData.users.filter(u => friendIds.includes(u.id));
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) return;
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        'INSERT INTO friends (id, user_id, friend_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [`${userId}_${friendId}`, userId, friendId]
      );
      return;
    }
    if (!this.localData.friends.some(f => f.user_id === userId && f.friend_id === friendId)) {
      this.localData.friends.push({ id: `${userId}_${friendId}`, user_id: userId, friend_id: friendId });
      this.saveLocal();
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    if (this.isPg && this.pgPool) {
      await this.pgPool.query('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2', [userId, friendId]);
      return;
    }
    this.localData.friends = this.localData.friends.filter(f => !(f.user_id === userId && f.friend_id === friendId));
    this.saveLocal();
  }

  // --- Capital History ---
  async getCapitalHistory(userId: string): Promise<CapitalPoint[]> {
    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query('SELECT * FROM capital_history WHERE user_id = $1 ORDER BY timestamp ASC', [userId]);
      return res.rows.map(this.mapCapitalPoint);
    }
    return this.localData.capital_history
      .filter(c => c.user_id === userId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async addCapitalPoint(userId: string, equity: number): Promise<void> {
    const pt: CapitalPoint = {
      id: `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      equity: Number(equity.toFixed(2)),
      timestamp: Date.now()
    };
    if (this.isPg && this.pgPool) {
      await this.pgPool.query(
        'INSERT INTO capital_history (id, user_id, equity, timestamp) VALUES ($1, $2, $3, $4)',
        [pt.id, pt.user_id, pt.equity, pt.timestamp]
      );
      return;
    }
    this.localData.capital_history.push(pt);
    this.saveLocal();
  }

  // Type mappers for Postgres numeric to float
  private mapUser(r: any): User {
    return {
      id: r.id,
      telegram_id: r.telegram_id,
      username: r.username,
      first_name: r.first_name,
      photo_url: r.photo_url,
      balance: parseFloat(r.balance),
      locked_balance: parseFloat(r.locked_balance),
      is_admin: parseInt(r.is_admin, 10),
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at)
    };
  }

  private mapPosition(r: any): Position {
    return {
      id: r.id,
      user_id: r.user_id,
      symbol: r.symbol,
      side: r.side,
      entry_price: parseFloat(r.entry_price),
      size: parseFloat(r.size),
      leverage: parseInt(r.leverage, 10),
      margin: parseFloat(r.margin),
      maintenance_margin: parseFloat(r.maintenance_margin),
      liquidation_price: parseFloat(r.liquidation_price),
      stop_loss: r.stop_loss ? parseFloat(r.stop_loss) : null,
      take_profit: r.take_profit ? parseFloat(r.take_profit) : null,
      status: r.status,
      close_price: r.close_price ? parseFloat(r.close_price) : null,
      realized_pnl: r.realized_pnl ? parseFloat(r.realized_pnl) : null,
      entry_fee: parseFloat(r.entry_fee),
      close_fee: r.close_fee ? parseFloat(r.close_fee) : null,
      battle_id: r.battle_id,
      created_at: Number(r.created_at),
      closed_at: r.closed_at ? Number(r.closed_at) : null
    };
  }

  private mapOrder(r: any): Order {
    return {
      id: r.id,
      user_id: r.user_id,
      symbol: r.symbol,
      type: r.type,
      side: r.side,
      price: parseFloat(r.price),
      size: parseFloat(r.size),
      leverage: parseInt(r.leverage, 10),
      margin: parseFloat(r.margin),
      locked_amount: parseFloat(r.locked_amount),
      stop_loss: r.stop_loss ? parseFloat(r.stop_loss) : null,
      take_profit: r.take_profit ? parseFloat(r.take_profit) : null,
      status: r.status,
      battle_id: r.battle_id,
      created_at: Number(r.created_at),
      filled_at: r.filled_at ? Number(r.filled_at) : null
    };
  }

  private mapTrade(r: any): Trade {
    return {
      id: r.id,
      position_id: r.position_id,
      user_id: r.user_id,
      symbol: r.symbol,
      side: r.side,
      entry_price: parseFloat(r.entry_price),
      exit_price: parseFloat(r.exit_price),
      size: parseFloat(r.size),
      leverage: parseInt(r.leverage, 10),
      pnl: parseFloat(r.pnl),
      roi: parseFloat(r.roi),
      close_reason: r.close_reason,
      total_fee: parseFloat(r.total_fee),
      battle_id: r.battle_id,
      created_at: Number(r.created_at)
    };
  }

  private mapBattle(r: any): Battle {
    return {
      id: r.id,
      title: r.title,
      symbol: r.symbol,
      duration_minutes: parseInt(r.duration_minutes, 10),
      starting_balance: parseFloat(r.starting_balance),
      max_players: parseInt(r.max_players, 10),
      status: r.status,
      start_time: Number(r.start_time),
      end_time: Number(r.end_time),
      created_at: Number(r.created_at)
    };
  }

  private mapBattleParticipant(r: any): BattleParticipant {
    return {
      id: r.id,
      battle_id: r.battle_id,
      user_id: r.user_id,
      username: r.username,
      first_name: r.first_name,
      balance: parseFloat(r.balance),
      locked_balance: parseFloat(r.locked_balance),
      final_equity: r.final_equity ? parseFloat(r.final_equity) : null,
      roi: parseFloat(r.roi),
      rank: r.rank ? parseInt(r.rank, 10) : null,
      created_at: Number(r.created_at)
    };
  }

  private mapMarketNews(r: any): MarketNews {
    return {
      id: r.id,
      symbol: r.symbol,
      title: r.title,
      description: r.description,
      type: r.type,
      importance: r.importance,
      created_at: Number(r.created_at)
    };
  }

  private mapMarketEvent(r: any): MarketEvent {
    return {
      id: r.id,
      type: r.type,
      symbol: r.symbol,
      phase: r.phase,
      intensity: parseFloat(r.intensity),
      start_time: Number(r.start_time),
      end_time: Number(r.end_time),
      status: r.status
    };
  }

  private mapAuditLog(r: any): AuditLog {
    return {
      id: r.id,
      user_id: r.user_id,
      action: r.action,
      details: r.details,
      ip: r.ip,
      request_id: r.request_id,
      status: r.status,
      created_at: Number(r.created_at)
    };
  }

  private mapCapitalPoint(r: any): CapitalPoint {
    return {
      id: r.id,
      user_id: r.user_id,
      equity: parseFloat(r.equity),
      timestamp: Number(r.timestamp)
    };
  }
}

export const db = new DatabaseService();
