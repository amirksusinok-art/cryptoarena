import React from 'react';
import { useTrade } from '../../context/TradeContext.js';
import { formatPrice, formatMoney } from '../../utils/formatters.js';

export const OrderList: React.FC = () => {
  const { portfolio, cancelOrder } = useTrade();
  const orders = portfolio?.orders || [];

  if (orders.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs">
        Нет активных лимитных ордеров
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {orders.map((ord) => {
        const isLong = ord.side === 'LONG';
        return (
          <div
            key={ord.id}
            className="bg-dark-card border border-dark-border rounded-xl p-3 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  LIMIT {ord.side}
                </span>
                <span className="font-bold text-xs text-white">{ord.symbol}</span>
                <span className="text-[10px] font-mono text-slate-400">x{ord.leverage}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-300 mt-1">
                Цена: <b className="text-white">{formatPrice(ord.price, ord.symbol)}</b> | Зарезервировано: {formatMoney(ord.locked_amount)}
              </div>
            </div>

            <button
              onClick={() => cancelOrder(ord.id)}
              className="px-2.5 py-1 text-xs text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg transition-colors font-medium"
            >
              Отменить
            </button>
          </div>
        );
      })}
    </div>
  );
};
