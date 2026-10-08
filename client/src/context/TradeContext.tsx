import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Position, Order, Trade } from '../types/index.js';
import { useAuth } from './AuthContext.js';
import { tg } from '../utils/telegram.js';

interface PortfolioData {
  totalBalance: number;
  totalEquity: number;
  availableBalance: number;
  lockedBalance: number;
  usedMargin: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
  capitalHistory: { id: string; equity: number; timestamp: number }[];
}

interface TradeContextType {
  portfolio: PortfolioData | null;
  isLoading: boolean;
  isSubmitting: boolean;
  activeBattleId: string | null;
  setActiveBattleId: (id: string | null) => void;
  placeOrder: (params: {
    symbol: string;
    type: 'MARKET' | 'LIMIT';
    side: 'LONG' | 'SHORT';
    size: number;
    leverage: number;
    limitPrice?: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
  }) => Promise<{ success: boolean; error?: string }>;
  closePosition: (positionId: string) => Promise<{ success: boolean; error?: string }>;
  cancelOrder: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  updateSLTP: (positionId: string, stopLoss?: number | null, takeProfit?: number | null) => Promise<{ success: boolean; error?: string }>;
  refreshPortfolio: () => Promise<void>;
}

const TradeContext = createContext<TradeContextType>({
  portfolio: null,
  isLoading: true,
  isSubmitting: false,
  activeBattleId: null,
  setActiveBattleId: () => {},
  placeOrder: async () => ({ success: false }),
  closePosition: async () => ({ success: false }),
  cancelOrder: async () => ({ success: false }),
  updateSLTP: async () => ({ success: false }),
  refreshPortfolio: async () => {}
});

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);

  const debounceTimeout = useRef<boolean>(false);

  const refreshPortfolio = useCallback(async () => {
    if (!user?.id) return;
    try {
      const url = activeBattleId
        ? `/api/portfolio?userId=${user.id}&battleId=${activeBattleId}`
        : `/api/portfolio?userId=${user.id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.totalBalance !== undefined) {
        setPortfolio(data);
      }
    } catch (err) {
      console.error('[TradeContext] Failed refreshing portfolio:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activeBattleId]);

  // Periodic refresh every 1000ms for live PnL and equity updates
  useEffect(() => {
    refreshPortfolio();
    const interval = setInterval(() => {
      refreshPortfolio();
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshPortfolio]);

  const placeOrder = async (params: {
    symbol: string;
    type: 'MARKET' | 'LIMIT';
    side: 'LONG' | 'SHORT';
    size: number;
    leverage: number;
    limitPrice?: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Пожалуйста, авторизуйтесь' };
    if (debounceTimeout.current) {
      return { success: false, error: 'Пожалуйста, подождите 1 секунду...' };
    }

    debounceTimeout.current = true;
    setIsSubmitting(true);
    tg.selection();

    setTimeout(() => {
      debounceTimeout.current = false;
      setIsSubmitting(false);
    }, 1000);

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          ...params,
          battleId: activeBattleId,
          requestId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        tg.notification('error');
        return { success: false, error: data.error || 'Ошибка при создании ордера' };
      }

      tg.notification('success');
      tg.impact('heavy');
      await refreshPortfolio();
      return { success: true };
    } catch (err: any) {
      tg.notification('error');
      return { success: false, error: err.message || 'Ошибка сети' };
    }
  };

  const closePosition = async (positionId: string): Promise<{ success: boolean; error?: string }> => {
    tg.selection();
    try {
      const res = await fetch('/api/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        tg.notification('error');
        return { success: false, error: data.error || 'Ошибка закрытия' };
      }
      tg.notification('success');
      tg.impact('medium');
      await refreshPortfolio();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка сети' };
    }
  };

  const cancelOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Unauthorized' };
    tg.selection();
    try {
      const res = await fetch('/api/trade/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, userId: user.id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Ошибка отмены' };
      }
      tg.impact('light');
      await refreshPortfolio();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateSLTP = async (
    positionId: string,
    stopLoss?: number | null,
    takeProfit?: number | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch('/api/trade/sltp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, userId: user.id, stopLoss, takeProfit })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Ошибка обновления SL/TP' };
      }
      tg.notification('success');
      await refreshPortfolio();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <TradeContext.Provider
      value={{
        portfolio,
        isLoading,
        isSubmitting,
        activeBattleId,
        setActiveBattleId,
        placeOrder,
        closePosition,
        cancelOrder,
        updateSLTP,
        refreshPortfolio
      }}
    >
      {children}
    </TradeContext.Provider>
  );
};

export const useTrade = () => useContext(TradeContext);
