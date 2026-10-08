import React from 'react';
import { useMarket } from '../../context/MarketContext.js';
import { formatPrice } from '../../utils/formatters.js';

export const OrderBook: React.FC = () => {
  const { orderBook, activeSymbol, currentTicker } = useMarket();

  const bids = orderBook?.bids?.slice(0, 8) || [];
  const asks = orderBook?.asks?.slice(0, 8).reverse() || [];

  const maxTotal = Math.max(
    ...bids.map(b => b.total),
    ...asks.map(a => a.total),
    1
  );

  return (
    <div className="bg-dark-bg p-3 text-xs select-none space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
        <span>Книга ордеров (Стакан)</span>
        <span className="font-mono text-slate-300 text-[10px]">
          Спред: {((currentTicker?.spread || 0.0004) * 100).toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Bids Column (Green / Buyers) */}
        <div className="bg-dark-card border border-dark-border/80 rounded-xl p-2 shadow">
          <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 border-b border-dark-border/50 pb-1 mb-1">
            <span className="text-emerald-400">Покупка</span>
            <span>Объём</span>
          </div>
          <div className="space-y-1">
            {bids.map((b, idx) => {
              const depthPct = Math.min(100, Math.round((b.total / maxTotal) * 100));
              return (
                <div key={idx} className="relative flex justify-between items-center font-mono text-xs py-1 px-1.5 rounded overflow-hidden">
                  {/* Vivid Depth Bar */}
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500/20 border-r border-emerald-500/40 transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 text-emerald-400 font-bold tracking-tight">
                    {formatPrice(b.price, activeSymbol)}
                  </span>
                  <span className="relative z-10 text-slate-200 text-[11px] font-medium">
                    {b.amount.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asks Column (Red / Sellers) */}
        <div className="bg-dark-card border border-dark-border/80 rounded-xl p-2 shadow">
          <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 border-b border-dark-border/50 pb-1 mb-1">
            <span className="text-rose-400">Продажа</span>
            <span>Объём</span>
          </div>
          <div className="space-y-1">
            {asks.map((a, idx) => {
              const depthPct = Math.min(100, Math.round((a.total / maxTotal) * 100));
              return (
                <div key={idx} className="relative flex justify-between items-center font-mono text-xs py-1 px-1.5 rounded overflow-hidden">
                  {/* Vivid Depth Bar */}
                  <div
                    className="absolute inset-y-0 right-0 bg-rose-500/20 border-l border-rose-500/40 transition-all duration-300"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 text-rose-400 font-bold tracking-tight">
                    {formatPrice(a.price, activeSymbol)}
                  </span>
                  <span className="relative z-10 text-slate-200 text-[11px] font-medium">
                    {a.amount.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
