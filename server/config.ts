import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'http://localhost:3000',
  
  // Telegram Bot
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  BOT_MODE: (process.env.BOT_MODE || (process.env.RENDER_EXTERNAL_URL ? 'webhook' : 'polling')) as 'polling' | 'webhook',
  
  // Security
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'cryptoarena_admin_secret_key_2026',
  ADMIN_TELEGRAM_IDS: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Trading Engine defaults
  STARTING_BALANCE: parseFloat(process.env.STARTING_BALANCE || '10000'),
  DEFAULT_COMMISSION_RATE: parseFloat(process.env.DEFAULT_COMMISSION_RATE || '0.0010'), // 0.10%
  MAINTENANCE_MARGIN_RATE: parseFloat(process.env.DEFAULT_MAINTENANCE_MARGIN_RATE || '0.0100'), // 1.0%
  MAX_LEVERAGE: 100,
  DEFAULT_LEVERAGES: [1, 2, 5, 10, 25, 50, 100],
  
  // Base Pairs
  BASE_PAIRS: [
    { symbol: 'BTC/USDT', name: 'Bitcoin', basePrice: 67840.0, spread: 0.0002, maxLeverage: 100 },
    { symbol: 'ETH/USDT', name: 'Ethereum', basePrice: 3520.0, spread: 0.0003, maxLeverage: 75 },
    { symbol: 'TON/USDT', name: 'Toncoin', basePrice: 5.45, spread: 0.0005, maxLeverage: 50 },
    { symbol: 'DOGE/USDT', name: 'Dogecoin', basePrice: 0.165, spread: 0.0006, maxLeverage: 50 },
    { symbol: 'SOL/USDT', name: 'Solana', basePrice: 154.20, spread: 0.0004, maxLeverage: 75 }
  ]
};
