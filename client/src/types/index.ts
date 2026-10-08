export interface Ticker {
  symbol: string;
  name: string;
  price: number;
  open24h: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  spread: number;
  maxLeverage: number;
  lastUpdated: number;
  historyMini: number[];
}

export interface Candle {
  time: number;
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

export interface Position {
  id: string;
  user_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  current_price?: number;
  size: number;
  leverage: number;
  margin: number;
  maintenance_margin: number;
  liquidation_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  unrealized_pnl?: number;
  roi?: number;
  entry_fee: number;
  battle_id?: string | null;
  created_at: number;
}

export interface Order {
  id: string;
  user_id: string;
  symbol: string;
  type: 'LIMIT';
  side: 'LONG' | 'SHORT';
  price: number;
  size: number;
  leverage: number;
  margin: number;
  locked_amount: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  battle_id?: string | null;
  created_at: number;
}

export interface Trade {
  id: string;
  position_id: string;
  user_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  size: number;
  leverage: number;
  pnl: number;
  roi: number;
  close_reason: 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIQUIDATION';
  total_fee: number;
  battle_id?: string | null;
  created_at: number;
}

export interface MarketNews {
  id: string;
  symbol: string;
  title: string;
  description: string;
  type: 'PUMP' | 'DUMP' | 'PANIC' | 'BLACK_MONDAY' | 'VOLATILITY' | 'INFO';
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_at: number;
}

export interface MarketEvent {
  id: string;
  type: 'PUMP' | 'DUMP' | 'PANIC' | 'BLACK_MONDAY';
  symbol?: string | null;
  phase: 'WARNING' | 'CRASH' | 'PANIC' | 'RECOVERY' | 'ACTIVE' | 'ENDED';
  intensity: number;
  start_time: number;
  end_time: number;
  status: 'ACTIVE' | 'ENDED';
}

export interface User {
  id: string;
  telegram_id: string;
  username: string;
  first_name: string;
  photo_url?: string;
  balance: number;
  locked_balance: number;
  is_admin: number;
  created_at: number;
  updated_at: number;
}

export interface Battle {
  id: string;
  title: string;
  symbol: string;
  duration_minutes: number;
  starting_balance: number;
  max_players: number;
  status: 'UPCOMING' | 'ACTIVE' | 'FINISHED';
  start_time: number;
  end_time: number;
  created_at: number;
}

export interface BattleParticipant {
  id: string;
  battle_id: string;
  user_id: string;
  username: string;
  first_name: string;
  balance: number;
  locked_balance: number;
  currentEquity?: number;
  final_equity?: number | null;
  roi: number;
  rank?: number | null;
  created_at: number;
}
