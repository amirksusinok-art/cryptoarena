import { EventEmitter } from 'events';
import { CONFIG } from '../config.js';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
}

export interface Ticker {
  symbol: string;
  name: string;
  price: number;
  bid: number;
  ask: number;
  open24h: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  spread: number;
  maxLeverage: number;
  lastUpdated: number;
  historyMini: number[]; // Last 20 points for mini charts
}

export interface PriceTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  volume: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400
};

export class PriceEngine extends EventEmitter {
  private tickers: Map<string, Ticker> = new Map();
  // symbol -> timeframe -> candles
  private candles: Map<string, Map<Timeframe, Candle[]>> = new Map();
  private volatilityModifiers: Map<string, { drift: number; volatilityMultiplier: number }> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    super();
    this.initTickers();
  }

  private initTickers() {
    for (const p of CONFIG.BASE_PAIRS) {
      const halfSpread = (p.spread * p.basePrice) / 2;
      this.tickers.set(p.symbol, {
        symbol: p.symbol,
        name: p.name,
        price: p.basePrice,
        bid: Number((p.basePrice - halfSpread).toFixed(this.getDecimals(p.symbol))),
        ask: Number((p.basePrice + halfSpread).toFixed(this.getDecimals(p.symbol))),
        open24h: p.basePrice,
        change24h: 0,
        change24hPercent: 0,
        high24h: p.basePrice * 1.02,
        low24h: p.basePrice * 0.98,
        volume24h: 1250000 + Math.random() * 500000,
        spread: p.spread,
        maxLeverage: p.maxLeverage,
        lastUpdated: Date.now(),
        historyMini: [p.basePrice]
      });

      this.volatilityModifiers.set(p.symbol, { drift: 0, volatilityMultiplier: 1.0 });

      // Generate initial candles
      this.initCandlesForSymbol(p.symbol, p.basePrice);
    }
  }

  private initCandlesForSymbol(symbol: string, basePrice: number) {
    const symbolCandles = new Map<Timeframe, Candle[]>();

    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const nowSec = Math.floor(Date.now() / 1000);

    for (const tf of timeframes) {
      const step = TIMEFRAME_SECONDS[tf];
      const count = 120; // 120 historical candles
      const list: Candle[] = [];
      let currentPrice = basePrice * (1 + (Math.random() - 0.5) * 0.05);

      for (let i = count; i >= 1; i--) {
        const cTime = Math.floor((nowSec - i * step) / step) * step;
        const volatility = tf === '1m' ? 0.0015 : tf === '1d' ? 0.025 : 0.006;
        const delta = (Math.random() - 0.495) * volatility * currentPrice;
        const open = currentPrice;
        const close = Math.max(0.0001, currentPrice + delta);
        const high = Math.max(open, close) + Math.random() * Math.abs(delta) * 0.8;
        const low = Math.max(0.0001, Math.min(open, close) - Math.random() * Math.abs(delta) * 0.8);
        const volume = (currentPrice * (5 + Math.random() * 15)) / (step / 60);

        list.push({
          time: cTime,
          open: Number(open.toFixed(this.getDecimals(symbol))),
          high: Number(high.toFixed(this.getDecimals(symbol))),
          low: Number(low.toFixed(this.getDecimals(symbol))),
          close: Number(close.toFixed(this.getDecimals(symbol))),
          volume: Number(volume.toFixed(2))
        });
        currentPrice = close;
      }

      symbolCandles.set(tf, list);
    }

    this.candles.set(symbol, symbolCandles);

    // Update ticker 24h stats from candles
    const dayCandles = symbolCandles.get('1d');
    if (dayCandles && dayCandles.length > 0) {
      const last = dayCandles[dayCandles.length - 1];
      const ticker = this.tickers.get(symbol);
      if (ticker) {
        ticker.price = last.close;
        ticker.open24h = dayCandles[0].open;
        ticker.high24h = Math.max(...dayCandles.map(c => c.high));
        ticker.low24h = Math.min(...dayCandles.map(c => c.low));
        ticker.change24h = ticker.price - ticker.open24h;
        ticker.change24hPercent = Number(((ticker.change24h / ticker.open24h) * 100).toFixed(2));
        ticker.historyMini = dayCandles.slice(-20).map(c => c.close);
      }
    }
  }

  public getDecimals(symbol: string): number {
    if (symbol.startsWith('DOGE') || symbol.startsWith('PEPE')) return 5;
    if (symbol.startsWith('TON')) return 3;
    if (symbol.startsWith('ETH') || symbol.startsWith('SOL')) return 2;
    return 2;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[PriceEngine] Virtual market started (1 tick/sec)');

    // Tick every 1000ms
    this.tickInterval = setInterval(() => {
      this.generateTicks();
    }, 1000);
  }

  public stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.isRunning = false;
  }

  public setModifier(symbol: string, drift: number, volatilityMultiplier: number) {
    this.volatilityModifiers.set(symbol, { drift, volatilityMultiplier });
  }

  public resetModifier(symbol: string) {
    this.volatilityModifiers.set(symbol, { drift: 0, volatilityMultiplier: 1.0 });
  }

  public resetAllModifiers() {
    for (const [symbol] of this.tickers) {
      this.volatilityModifiers.set(symbol, { drift: 0, volatilityMultiplier: 1.0 });
    }
  }

  private generateTicks() {
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);

    for (const [symbol, ticker] of this.tickers) {
      const mod = this.volatilityModifiers.get(symbol) || { drift: 0, volatilityMultiplier: 1.0 };

      // Base Geometric Brownian Motion step
      // sigma around 0.15% per tick normal
      const baseSigma = 0.0012 * mod.volatilityMultiplier;
      const gaussianNoise = (Math.random() + Math.random() + Math.random() - 1.5) * 2; // Approximate normal dist
      const returnPct = mod.drift + gaussianNoise * baseSigma;

      const oldPrice = ticker.price;
      let newPrice = oldPrice * (1 + returnPct);

      // Guard against zero / negative
      if (newPrice <= 0.00001) newPrice = 0.00001;

      const decimals = this.getDecimals(symbol);
      newPrice = Number(newPrice.toFixed(decimals));

      // Calculate spread, bid, ask
      const halfSpread = (ticker.spread * newPrice) / 2;
      const bid = Number((newPrice - halfSpread).toFixed(decimals));
      const ask = Number((newPrice + halfSpread).toFixed(decimals));

      // Tick volume
      const tickVol = Number(((newPrice * (0.5 + Math.random() * 2.5))).toFixed(2));

      // Update ticker
      ticker.price = newPrice;
      ticker.bid = bid;
      ticker.ask = ask;
      ticker.lastUpdated = now;
      ticker.volume24h += tickVol;
      if (newPrice > ticker.high24h) ticker.high24h = newPrice;
      if (newPrice < ticker.low24h) ticker.low24h = newPrice;
      ticker.change24h = newPrice - ticker.open24h;
      ticker.change24hPercent = Number(((ticker.change24h / ticker.open24h) * 100).toFixed(2));

      // Update mini history (keep 20 points)
      ticker.historyMini.push(newPrice);
      if (ticker.historyMini.length > 20) ticker.historyMini.shift();

      // Update candle bars
      this.updateCandles(symbol, newPrice, tickVol, nowSec);

      // Emit tick event
      const tick: PriceTick = {
        symbol,
        price: newPrice,
        bid,
        ask,
        timestamp: now,
        volume: tickVol
      };

      this.emit('tick', tick);
    }

    this.emit('tickers', this.getAllTickers());
  }

  private updateCandles(symbol: string, price: number, volume: number, nowSec: number) {
    const symbolMap = this.candles.get(symbol);
    if (!symbolMap) return;

    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

    for (const tf of timeframes) {
      const step = TIMEFRAME_SECONDS[tf];
      const candleBucket = Math.floor(nowSec / step) * step;
      let list = symbolMap.get(tf);
      if (!list) {
        list = [];
        symbolMap.set(tf, list);
      }

      const last = list[list.length - 1];

      if (!last || last.time < candleBucket) {
        // Create new candle
        const newCandle: Candle = {
          time: candleBucket,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume
        };
        list.push(newCandle);
        if (list.length > 300) list.shift();
        this.emit('candle', { symbol, timeframe: tf, candle: newCandle, isNew: true });
      } else {
        // Update current candle
        if (price > last.high) last.high = price;
        if (price < last.low) last.low = price;
        last.close = price;
        last.volume = Number((last.volume + volume).toFixed(2));
        this.emit('candle', { symbol, timeframe: tf, candle: last, isNew: false });
      }
    }
  }

  // --- Public Getters ---
  public getTicker(symbol: string): Ticker | undefined {
    return this.tickers.get(symbol);
  }

  public getAllTickers(): Ticker[] {
    return Array.from(this.tickers.values());
  }

  public getCandles(symbol: string, timeframe: Timeframe): Candle[] {
    const map = this.candles.get(symbol);
    if (!map) return [];
    return map.get(timeframe) || [];
  }

  public getOrderBook(symbol: string): OrderBook {
    const ticker = this.tickers.get(symbol);
    const price = ticker ? ticker.price : 100;
    const decimals = this.getDecimals(symbol);

    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    let totalBid = 0;
    let totalAsk = 0;

    // Generate 8 bid and ask levels
    for (let i = 1; i <= 8; i++) {
      const bidDiff = price * (0.0003 * i + Math.random() * 0.0002);
      const askDiff = price * (0.0003 * i + Math.random() * 0.0002);

      const bidPrice = Number((price - bidDiff).toFixed(decimals));
      const askPrice = Number((price + askDiff).toFixed(decimals));

      const bidAmount = Number(((1000 / price) * (0.5 + Math.random() * 2)).toFixed(4));
      const askAmount = Number(((1000 / price) * (0.5 + Math.random() * 2)).toFixed(4));

      totalBid += bidAmount;
      totalAsk += askAmount;

      bids.push({ price: bidPrice, amount: bidAmount, total: Number(totalBid.toFixed(4)) });
      asks.push({ price: askPrice, amount: askAmount, total: Number(totalAsk.toFixed(4)) });
    }

    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now()
    };
  }

  public addCustomPair(symbol: string, name: string, basePrice: number, spread = 0.0004, maxLeverage = 50) {
    if (this.tickers.has(symbol)) return false;

    const halfSpread = (spread * basePrice) / 2;
    this.tickers.set(symbol, {
      symbol,
      name,
      price: basePrice,
      bid: Number((basePrice - halfSpread).toFixed(this.getDecimals(symbol))),
      ask: Number((basePrice + halfSpread).toFixed(this.getDecimals(symbol))),
      open24h: basePrice,
      change24h: 0,
      change24hPercent: 0,
      high24h: basePrice * 1.02,
      low24h: basePrice * 0.98,
      volume24h: 500000,
      spread,
      maxLeverage,
      lastUpdated: Date.now(),
      historyMini: [basePrice]
    });

    this.volatilityModifiers.set(symbol, { drift: 0, volatilityMultiplier: 1.0 });
    this.initCandlesForSymbol(symbol, basePrice);
    return true;
  }
}

export const priceEngine = new PriceEngine();
