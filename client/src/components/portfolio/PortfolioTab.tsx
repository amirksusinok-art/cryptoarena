import React, { useState } from 'react';
import { TrendingUp, History, Clock } from 'lucide-react';
import { useTrade } from '../../context/TradeContext.js';
import { PositionList } from '../trade/PositionList.js';
import { OrderList } from '../trade/OrderList.js';
import { formatMoney, formatMoneyWithSign, formatPercent, formatPrice, formatDate } from '../../utils/formatters.js';

export const PortfolioTab: React.FC = () => {
  const { portfolio } = useTrade();
  const [subTab, setSubTab] = useState<'positions' | 'orders' | 'history'>('positions');

  const equity = portfolio?.totalEquity || 10000;
  const available = portfolio?.availableBalance || 10000;
  const locked = portfolio?.lockedBalance || 0;
  const usedMargin = portfolio?.usedMargin || 0;
  const unrealizedPnL = portfolio?.unrealizedPnL || 0;
  const realizedPnL = portfolio?.realizedPnL || 0;
  const trades = portfolio?.trades || [];

  const capitalHistory = portfolio?.capitalHistory || [];

  return (
    <div className="p-3.5 space-y-4 pb-20 select-none">
      {/* Portfolio Overview Card */}
      <div className="bg-gradient-to-br from-dark-card to-dark-surface border border-dark-border rounded-2xl p-4 shadow-xl space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Общий Капитал (Total Equity)
          </div>
          <div className="text-2xl font-mono font-black text-white mt-0.5">
            {formatMoney(equity)}
          </div>
        </div>

        {/* 4-Item Grid Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dark-border/60 text-xs font-mono">
          <div className="bg-dark-bg/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-sans">Свободно:</span>
            <span className="text-emerald-400 font-bold">{formatMoney(available)}</span>
          </div>
          <div className="bg-dark-bg/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-sans">В ордерах:</span>
            <span className="text-amber-400 font-bold">{formatMoney(locked)}</span>
          </div>
          <div className="bg-dark-bg/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-sans">В позициях (Маржа):</span>
            <span className="text-slate-200 font-bold">{formatMoney(usedMargin)}</span>
          </div>
          <div className="bg-dark-bg/60 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-sans">Нереализованный PnL:</span>
            <span className={`font-bold ${unrealizedPnL >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
              {formatMoneyWithSign(unrealizedPnL)}
            </span>
          </div>
        </div>

        {/* Realized PnL summary */}
        <div className="flex justify-between items-center text-xs text-slate-400 font-mono pt-1">
          <span>Реализованный PnL:</span>
          <span className={`font-bold ${realizedPnL >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
            {formatMoneyWithSign(realizedPnL)}
          </span>
        </div>
      </div>

      {/* Capital History Curve Visualizer (Section 25) */}
      {capitalHistory.length > 1 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-3 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>История изменения капитала</span>
          </div>
          <div className="h-16 flex items-end space-x-1 bg-dark-surface/40 p-2 rounded-lg overflow-x-auto">
            {capitalHistory.slice(-25).map((pt, i) => {
              const minEq = Math.min(...capitalHistory.map(c => c.equity)) * 0.98;
              const maxEq = Math.max(...capitalHistory.map(c => c.equity)) * 1.02;
              const range = maxEq - minEq || 1;
              const heightPct = Math.max(10, Math.min(100, Math.round(((pt.equity - minEq) / range) * 100)));
              const isProfit = pt.equity >= 10000;

              return (
                <div
                  key={pt.id || i}
                  title={`${formatMoney(pt.equity)} (${formatDate(pt.timestamp)})`}
                  className="flex-1 min-w-[6px] rounded-t transition-all hover:opacity-100 opacity-80"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: isProfit ? '#22c55e' : '#ef4444'
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Sub Tabs: Positions, Orders, History */}
      <div className="flex space-x-1 bg-dark-card p-1 rounded-xl border border-dark-border text-xs">
        <button
          onClick={() => setSubTab('positions')}
          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            subTab === 'positions' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Позиции</span>
          {portfolio?.positions?.length ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
              {portfolio.positions.length}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setSubTab('orders')}
          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            subTab === 'orders' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Лимиты</span>
          {portfolio?.orders?.length ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
              {portfolio.orders.length}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            subTab === 'history' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>История</span>
        </button>
      </div>

      {/* Sub Tab Contents */}
      {subTab === 'positions' && <PositionList />}
      {subTab === 'orders' && <OrderList />}
      {subTab === 'history' && (
        <div className="space-y-2">
          {trades.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              История сделок пуста
            </div>
          ) : (
            trades.map((t) => {
              const isWin = t.pnl >= 0;
              let reasonBadge = 'Закрыто вручную';
              if (t.close_reason === 'STOP_LOSS') reasonBadge = '🛑 Stop-Loss';
              if (t.close_reason === 'TAKE_PROFIT') reasonBadge = '🎯 Take-Profit';
              if (t.close_reason === 'LIQUIDATION') reasonBadge = '💀 Ликвидация';

              return (
                <div
                  key={t.id}
                  className="bg-dark-card border border-dark-border rounded-xl p-3 space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 font-sans">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        t.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {t.side} x{t.leverage}
                      </span>
                      <span className="font-bold text-white">{t.symbol}</span>
                    </div>
                    <div className={`font-bold ${isWin ? 'text-trade-up' : 'text-trade-down'}`}>
                      {formatMoneyWithSign(t.pnl)} ({formatPercent(t.roi)})
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Вход: {formatPrice(t.entry_price, t.symbol)}</span>
                    <span>Выход: {formatPrice(t.exit_price, t.symbol)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-dark-border/40 text-slate-400">
                    <span className="text-amber-400 font-sans font-medium">{reasonBadge}</span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(t.created_at)}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
