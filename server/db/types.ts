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

export interface Position {
  id: string;
  user_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  size: number; // Notional position size in USDT
  leverage: number;
  margin: number; // Isolated margin
  maintenance_margin: number;
  liquidation_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  close_price?: number | null;
  realized_pnl?: number | null;
  entry_fee: number;
  close_fee?: number | null;
  battle_id?: string | null;
  created_at: number;
  closed_at?: number | null;
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
  locked_amount: number; // margin + estimated entry fee
  stop_loss?: number | null;
  take_profit?: number | null;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  battle_id?: string | null;
  created_at: number;
  filled_at?: number | null;
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
  final_equity?: number | null;
  roi: number;
  rank?: number | null;
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

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  details: string;
  ip?: string | null;
  request_id?: string | null;
  status: string;
  created_at: number;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: number;
}

export interface CapitalPoint {
  id: string;
  user_id: string;
  equity: number;
  timestamp: number;
}
