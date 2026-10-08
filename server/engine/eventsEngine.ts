import { EventEmitter } from 'events';
import { db } from '../db/index.js';
import { MarketEvent, MarketNews } from '../db/types.js';
import { priceEngine } from './priceEngine.js';

export class EventsEngine extends EventEmitter {
  private activeEvents: Map<string, MarketEvent> = new Map();
  private eventTimers: Map<string, NodeJS.Timeout> = new Map();
  private blackMondayState: {
    eventId?: string;
    phase?: 'WARNING' | 'CRASH' | 'PANIC' | 'RECOVERY' | 'ENDED';
    timer?: NodeJS.Timeout;
    stats?: Record<string, { startPrice: number; endPrice: number }>;
  } = {};

  constructor() {
    super();
  }

  public init() {
    console.log('[EventsEngine] Market events engine initialized');
  }

  // --- Pump Event ---
  public async triggerPump(symbol: string, durationSeconds = 120, intensity = 1.8): Promise<MarketEvent> {
    const id = `pump_${Date.now()}`;
    const startTime = Date.now();
    const endTime = startTime + durationSeconds * 1000;

    const event: MarketEvent = {
      id,
      type: 'PUMP',
      symbol,
      phase: 'ACTIVE',
      intensity,
      start_time: startTime,
      end_time: endTime,
      status: 'ACTIVE'
    };

    this.activeEvents.set(id, event);
    await db.createMarketEvent(event);

    // Set upward drift on price engine: ~0.0035 per tick with high volatility
    const drift = 0.003 * intensity;
    priceEngine.setModifier(symbol, drift, 2.0);

    const news: MarketNews = {
      id: `news_${Date.now()}`,
      symbol,
      title: `⚡ PUMP DETECTED: ${symbol}`,
      description: `На рынке обнаружен мощный покупательский импульс по ${symbol}. Ожидается аномальный рост котировок!`,
      type: 'PUMP',
      importance: 'HIGH',
      created_at: Date.now()
    };
    await db.createMarketNews(news);

    this.emit('event_started', { event, news });

    // Schedule cleanup
    const timer = setTimeout(async () => {
      await this.endEvent(id);
    }, durationSeconds * 1000);
    this.eventTimers.set(id, timer);

    return event;
  }

  // --- Dump Event ---
  public async triggerDump(symbol: string, durationSeconds = 120, intensity = 1.8): Promise<MarketEvent> {
    const id = `dump_${Date.now()}`;
    const startTime = Date.now();
    const endTime = startTime + durationSeconds * 1000;

    const event: MarketEvent = {
      id,
      type: 'DUMP',
      symbol,
      phase: 'ACTIVE',
      intensity,
      start_time: startTime,
      end_time: endTime,
      status: 'ACTIVE'
    };

    this.activeEvents.set(id, event);
    await db.createMarketEvent(event);

    // Set downward drift on price engine: ~ -0.0035 per tick with high volatility
    const drift = -0.003 * intensity;
    priceEngine.setModifier(symbol, drift, 2.2);

    const news: MarketNews = {
      id: `news_${Date.now()}`,
      symbol,
      title: `🔻 DUMP DETECTED: ${symbol}`,
      description: `Массовый сброс позиций по ${symbol}! Резкий рост риска для Long-позиций и каскадных ликвидаций!`,
      type: 'DUMP',
      importance: 'HIGH',
      created_at: Date.now()
    };
    await db.createMarketNews(news);

    this.emit('event_started', { event, news });

    const timer = setTimeout(async () => {
      await this.endEvent(id);
    }, durationSeconds * 1000);
    this.eventTimers.set(id, timer);

    return event;
  }

  // --- Market Panic ---
  public async triggerPanic(durationSeconds = 180): Promise<MarketEvent> {
    const id = `panic_${Date.now()}`;
    const startTime = Date.now();
    const endTime = startTime + durationSeconds * 1000;

    const event: MarketEvent = {
      id,
      type: 'PANIC',
      symbol: null,
      phase: 'ACTIVE',
      intensity: 2.5,
      start_time: startTime,
      end_time: endTime,
      status: 'ACTIVE'
    };

    this.activeEvents.set(id, event);
    await db.createMarketEvent(event);

    // Boost volatility on all symbols with wild fluctuations
    const tickers = priceEngine.getAllTickers();
    for (const t of tickers) {
      priceEngine.setModifier(t.symbol, -0.001, 3.5);
    }

    const news: MarketNews = {
      id: `news_${Date.now()}`,
      symbol: 'GLOBAL',
      title: `🚨 MARKET PANIC: Всплеск волатильности!`,
      description: `Глобальная рыночная паника охватила все торговые пары. Свечи становятся резкими, проверьте свои уровни маржи!`,
      type: 'PANIC',
      importance: 'CRITICAL',
      created_at: Date.now()
    };
    await db.createMarketNews(news);

    this.emit('event_started', { event, news });

    const timer = setTimeout(async () => {
      await this.endEvent(id);
    }, durationSeconds * 1000);
    this.eventTimers.set(id, timer);

    return event;
  }

  // --- Black Monday (Multi-Phase) ---
  public async triggerBlackMonday(): Promise<MarketEvent> {
    const id = `black_monday_${Date.now()}`;
    const startTime = Date.now();
    const totalDuration = 240; // 4 minutes total across phases
    const endTime = startTime + totalDuration * 1000;

    const event: MarketEvent = {
      id,
      type: 'BLACK_MONDAY',
      symbol: null,
      phase: 'WARNING',
      intensity: 3.0,
      start_time: startTime,
      end_time: endTime,
      status: 'ACTIVE'
    };

    this.activeEvents.set(id, event);
    await db.createMarketEvent(event);

    // Track starting prices for final stats
    this.blackMondayState = {
      eventId: id,
      phase: 'WARNING',
      stats: {}
    };
    for (const t of priceEngine.getAllTickers()) {
      this.blackMondayState.stats![t.symbol] = { startPrice: t.price, endPrice: t.price };
    }

    // Phase 1: WARNING (40s)
    const news1: MarketNews = {
      id: `news_${Date.now()}`,
      symbol: 'GLOBAL',
      title: `⚠️ BLACK MONDAY WARNING: Аномалия рынка`,
      description: `Система регистрирует критические сбои ликвидности. Крупнейшее падение сезона может начаться в любую минуту!`,
      type: 'BLACK_MONDAY',
      importance: 'CRITICAL',
      created_at: Date.now()
    };
    await db.createMarketNews(news1);
    this.emit('event_phase', { event, phase: 'WARNING', news: news1 });

    // Transition to Phase 2: CRASH after 35s
    setTimeout(async () => {
      if (event.status !== 'ACTIVE') return;
      event.phase = 'CRASH';
      await db.updateMarketEvent(id, { phase: 'CRASH' });

      // Plunge all assets hard!
      for (const t of priceEngine.getAllTickers()) {
        priceEngine.setModifier(t.symbol, -0.005, 3.0);
      }

      const news2: MarketNews = {
        id: `news_${Date.now()}`,
        symbol: 'GLOBAL',
        title: `🔥 BLACK MONDAY CRASH: Массовый обвал!`,
        description: `Рынок падает по всем фронтам! BTC, ETH, TON и альткоины пробивают ключевые поддержки!`,
        type: 'BLACK_MONDAY',
        importance: 'CRITICAL',
        created_at: Date.now()
      };
      await db.createMarketNews(news2);
      this.emit('event_phase', { event, phase: 'CRASH', news: news2 });
    }, 35000);

    // Transition to Phase 3: PANIC after 90s
    setTimeout(async () => {
      if (event.status !== 'ACTIVE') return;
      event.phase = 'PANIC';
      await db.updateMarketEvent(id, { phase: 'PANIC' });

      for (const t of priceEngine.getAllTickers()) {
        priceEngine.setModifier(t.symbol, -0.002, 4.5);
      }

      const news3: MarketNews = {
        id: `news_${Date.now()}`,
        symbol: 'GLOBAL',
        title: `💀 BLACK MONDAY PANIC: Пик ликвидаций`,
        description: `Экстремальная волатильность. Массовые ликвидации позиций и срабатывание стоп-лоссов.`,
        type: 'BLACK_MONDAY',
        importance: 'CRITICAL',
        created_at: Date.now()
      };
      await db.createMarketNews(news3);
      this.emit('event_phase', { event, phase: 'PANIC', news: news3 });
    }, 90000);

    // Transition to Phase 4: RECOVERY after 160s
    setTimeout(async () => {
      if (event.status !== 'ACTIVE') return;
      event.phase = 'RECOVERY';
      await db.updateMarketEvent(id, { phase: 'RECOVERY' });

      for (const t of priceEngine.getAllTickers()) {
        priceEngine.setModifier(t.symbol, 0.002, 2.0); // Mild rebound
      }

      const news4: MarketNews = {
        id: `news_${Date.now()}`,
        symbol: 'GLOBAL',
        title: `🌱 BLACK MONDAY RECOVERY: Дно пройдено`,
        description: `Падение остановилось. Покупатели выкупают просадку, рынок начинает стабилизироваться.`,
        type: 'BLACK_MONDAY',
        importance: 'HIGH',
        created_at: Date.now()
      };
      await db.createMarketNews(news4);
      this.emit('event_phase', { event, phase: 'RECOVERY', news: news4 });
    }, 160000);

    // End after 220s
    setTimeout(async () => {
      await this.endEvent(id);
    }, 220000);

    return event;
  }

  // --- End Event ---
  public async endEvent(id: string) {
    const event = this.activeEvents.get(id);
    if (!event) return;

    event.status = 'ENDED';
    event.phase = 'ENDED';
    this.activeEvents.delete(id);

    const timer = this.eventTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.eventTimers.delete(id);
    }

    if (event.symbol) {
      priceEngine.resetModifier(event.symbol);
    } else {
      priceEngine.resetAllModifiers();
    }

    await db.updateMarketEvent(id, { status: 'ENDED', phase: 'ENDED' });

    let summary = `Событие ${event.type} завершено. Рынок вернулся в штатный режим торговли.`;
    if (event.type === 'BLACK_MONDAY') {
      const parts: string[] = [];
      for (const t of priceEngine.getAllTickers()) {
        const initial = this.blackMondayState.stats?.[t.symbol]?.startPrice || t.price;
        const changePct = (((t.price - initial) / initial) * 100).toFixed(1);
        parts.push(`${t.symbol}: ${Number(changePct) > 0 ? '+' : ''}${changePct}%`);
      }
      summary = `BLACK MONDAY ЗАВЕРШЕН! Итоги обвала: ${parts.join(' | ')}`;
    }

    const news: MarketNews = {
      id: `news_${Date.now()}`,
      symbol: event.symbol || 'GLOBAL',
      title: `✅ ${event.type} ЗАВЕРШЕНО`,
      description: summary,
      type: 'INFO',
      importance: 'MEDIUM',
      created_at: Date.now()
    };
    await db.createMarketNews(news);

    this.emit('event_ended', { event, news });
  }

  public getActiveEventsList(): MarketEvent[] {
    return Array.from(this.activeEvents.values());
  }
}

export const eventsEngine = new EventsEngine();
