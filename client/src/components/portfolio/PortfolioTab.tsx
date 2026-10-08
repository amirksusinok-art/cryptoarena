import React, { useState } from 'react';
import { TrendingUp, History, Clock } from 'lucide-react';
import { useTrade } from '../../context/TradeContext.js';
import { PositionList } from '../trade/PositionList.js';
import { OrderList } from '../trade/OrderList.js';
import { formatMoney, formatMoneyWithSign, formatPercent, formatPrice, formatDate } from '../../utils/formatters.js';

interface PortfolioTabProps {
  onNavigateToTrade?: () => void;
}

export const PortfolioTab: React.FC<PortfolioTabProps> = ({ onNavigateToTrade }) => {
  const { portfolio } = useTrade();
  const [subTab, setSubTab] = useState<'positions' | 'orders' | 'history'>('positions');

  const equity = portfolio?.totalEquity || 10000;
  const available = portfolio?.availableBalance || 10000;
  const locked = portfolio?.lockedBalance || 0;
  const usedMargin = portfolio?.usedMargin || 0;
  const unrealizedPnL = portfolio?.unrealizedPnL || 0;
  const realizedPnL = portfolio?.realizedPnL || 0;
  const trades = portfolio?.trades || [];

  const rawHistory = portfolio?.capitalHistory || [];
  // Ensure we have at least 2 points for a nice area curve
  const capitalHistory = rawHistory.length > 1
    ? rawHistory
    : [
        { id: 'h_start', equity: 10000, timestamp: Date.now() - 3600000 * 4 },
        { id: 'h_current', equity, timestamp: Date.now() }
      ];

  const totalRoi = ((equity - 10000) / 10000) * 100;
  const isOverallProfit = equity >= 10000;

  // Compute SVG Area Chart Points
  const equities = capitalHistory.map(c => c.equity);
  const minEq = Math.min(9900, Math.min(...equities)) * 0.995;
  const maxEq = Math.max(10100, Math.max(...equities)) * 1.005;
  const range = maxEq - minEq || 1;

  const svgWidth = 320;
  const svgHeight = 75;
  const paddingX = 12;
  const paddingY = 8;
  const usableWidth = svgWidth - paddingX * 2;
  const usableHeight = svgHeight - paddingY * 2;

  const points = capitalHistory.map((pt, idx) => {
    const x = paddingX + (idx / Math.max(1, capitalHistory.length - 1)) * usableWidth;
    const y = paddingY + usableHeight - ((pt.equity - minEq) / range) * usableHeight;
    return { x, y, equity: pt.equity, time: pt.timestamp };
  });

  // Build SVG path
  const linePath = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = points[i - 1];
    const cx = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');

  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPt.x.toFixed(1)} ${svgHeight} L ${firstPt.x.toFixed(1)} ${svgHeight} Z`;

  const strokeColor = isOverallProfit ? '#10b981' : '#f43f5e';
  const gradId = `equityGrad_${isOverallProfit ? 'profit' : 'loss'}`;

  return (
    <div className="p-3.5 space-y-4 pb-20 select-none">
      {/* Portfolio Overview Card */}
      <div className="bg-gradient-to-br from-dark-card to-dark-surface border border-dark-border rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Общий Капитал (Total Equity)
            </div>
            <div className="text-2xl font-mono font-black text-white mt-0.5">
              {formatMoney(equity)}
            </div>
          </div>
          <div className={`px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 ${
            isOverallProfit ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            <span>{isOverallProfit ? '+' : ''}{totalRoi.toFixed(2)}%</span>
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

      {/* Sleek SVG Equity Curve Area Chart */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-white">
            <TrendingUp className={`w-4 h-4 ${isOverallProfit ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span>Кривая доходности</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Старт: <span className="text-slate-200 font-semibold">$10 000</span>
          </div>
        </div>

        {/* SVG Graphic */}
        <div className="relative w-full overflow-hidden bg-dark-surface/40 rounded-xl pt-2">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-24 overflow-visible">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Subtle horizontal grid lines */}
            <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#1e2433" strokeDasharray="3 3" />
            <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#1e2433" strokeDasharray="3 3" />
            <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#1e2433" strokeDasharray="3 3" />

            {/* Gradient Area */}
            <path d={areaPath} fill={`url(#${gradId})`} />

            {/* Curve Line */}
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

            {/* Pulse Dot at Current Equity */}
            {lastPt && (
              <>
                <circle cx={lastPt.x} cy={lastPt.y} r="5" fill={strokeColor} opacity="0.3" className="animate-ping" />
                <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill={strokeColor} />
              </>
            )}
          </svg>

          <div className="flex justify-between items-center px-2.5 pb-2 text-[10px] font-mono text-slate-400 border-t border-dark-border/40 pt-1.5 mt-1">
            <span>Мин: {formatMoney(minEq)}</span>
            <span className={`font-bold ${isOverallProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              Текущий: {formatMoney(equity)}
            </span>
            <span>Макс: {formatMoney(maxEq)}</span>
          </div>
        </div>
      </div>

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
      {subTab === 'positions' && <PositionList onNavigateToTrade={onNavigateToTrade} />}
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
