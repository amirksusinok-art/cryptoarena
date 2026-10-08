import React from 'react';
import { useMarket } from '../../context/MarketContext.js';
import { formatPrice } from '../../utils/formatters.js';

export const OrderBook: React.FC = () => {
  const { orderBook, activeSymbol, currentTicker } = useMarket();

  const bids = orderBook?.bids?.slice(0, 5) || [];
  const asks = orderBook?.asks?.slice(0, 5).reverse() || [];

  const maxTotal = Math.max(
    ...bids.map(b => b.total),
    ...asks.map(a => a.total),
    1
  );

  return (
    <div className="bg-dark-card border-b border-dark-border px-3 py-2 text-xs select-none">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
        <span>Стакан (Order Book)</span>
        <span className="font-mono text-slate-300">
          Спред: {((currentTicker?.spread || 0.0004) * 100).toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Bids Column (Green / Buyers) */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>Покупка</span>
            <span>Объём</span>
          </div>
          <div className="space-y-0.5">
            {bids.map((b, idx) => {
              const depthPct = Math.min(100, Math.round((b.total / maxTotal) * 100));
              return (
                <div key={idx} className="relative flex justify-between font-mono text-[11px] py-0.5 px-1 rounded overflow-hidden">
                  <div
                    className="absolute inset-0 bg-emerald-500/10 right-auto"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 text-emerald-400 font-medium">
                    {formatPrice(b.price, activeSymbol)}
                  </span>
                  <span className="relative z-10 text-slate-300 text-[10px]">
                    {b.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asks Column (Red / Sellers) */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>Продажа</span>
            <span>Объём</span>
          </div>
          <div className="space-y-0.5">
            {asks.map((a, idx) => {
              const depthPct = Math.min(100, Math.round((a.total / maxTotal) * 100));
              return (
                <div key={idx} className="relative flex justify-between font-mono text-[11px] py-0.5 px-1 rounded overflow-hidden">
                  <div
                    className="absolute inset-0 bg-rose-500/10 left-auto"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 text-rose-400 font-medium">
                    {formatPrice(a.price, activeSymbol)}
                  </span>
                  <span className="relative z-10 text-slate-300 text-[10px]">
                    {a.amount}
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
