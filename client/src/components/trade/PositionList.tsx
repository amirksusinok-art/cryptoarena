import React, { useState } from 'react';
import { AlertTriangle, Edit3, X } from 'lucide-react';
import { useTrade } from '../../context/TradeContext.js';
import { Position } from '../../types/index.js';
import { formatPrice, formatMoney, formatMoneyWithSign, formatPercent } from '../../utils/formatters.js';

export const PositionList: React.FC = () => {
  const { portfolio, closePosition, updateSLTP } = useTrade();
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editSL, setEditSL] = useState<string>('');
  const [editTP, setEditTP] = useState<string>('');

  const positions = portfolio?.positions || [];

  if (positions.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs">
        Нет открытых позиций
      </div>
    );
  }

  const handleOpenEdit = (pos: Position) => {
    setEditingPos(pos);
    setEditSL(pos.stop_loss ? pos.stop_loss.toString() : '');
    setEditTP(pos.take_profit ? pos.take_profit.toString() : '');
  };

  const handleSaveSLTP = async () => {
    if (!editingPos) return;
    const sl = editSL ? parseFloat(editSL) : null;
    const tp = editTP ? parseFloat(editTP) : null;
    await updateSLTP(editingPos.id, sl, tp);
    setEditingPos(null);
  };

  return (
    <div className="space-y-2 p-3">
      {positions.map((pos) => {
        const isLong = pos.side === 'LONG';
        const pnl = pos.unrealized_pnl || 0;
        const roi = pos.roi || 0;
        const isProfitable = pnl >= 0;

        // Check if price is within 3% of liquidation price (warning level)
        const currentPrice = pos.current_price || pos.entry_price;
        const distToLiq = Math.abs(currentPrice - pos.liquidation_price) / pos.entry_price;
        const isDangerLiq = distToLiq < 0.03;

        return (
          <div
            key={pos.id}
            className={`bg-dark-card border rounded-xl p-3 space-y-2.5 transition-all ${
              isDangerLiq ? 'border-rose-500/70 shadow-lg shadow-rose-500/10' : 'border-dark-border'
            }`}
          >
            {/* Header: Symbol, Side, Leverage, ROI & PnL */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono ${
                    isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {pos.side} x{pos.leverage}
                </span>
                <span className="font-bold text-sm text-white">{pos.symbol}</span>
                {pos.battle_id && (
                  <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                    BATTLE
                  </span>
                )}
              </div>

              {/* Unrealized PnL & ROI */}
              <div className="text-right">
                <div className={`font-mono text-sm font-bold ${isProfitable ? 'text-trade-up' : 'text-trade-down'}`}>
                  {formatMoneyWithSign(pnl)}
                </div>
                <div className={`font-mono text-[10px] font-semibold ${isProfitable ? 'text-trade-up' : 'text-trade-down'}`}>
                  {formatPercent(roi)}
                </div>
              </div>
            </div>

            {/* Grid of Entry, Current, Margin, Liquidation */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-dark-surface/60 rounded-lg p-2 font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Вход:</span>
                <span className="text-slate-200">{formatPrice(pos.entry_price, pos.symbol)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Текущая:</span>
                <span className="text-slate-200">{formatPrice(currentPrice, pos.symbol)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Маржа (Размер):</span>
                <span className="text-slate-200">{formatMoney(pos.margin)} <span className="text-[9px] text-slate-400">({formatMoney(pos.size)})</span></span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] flex items-center space-x-1">
                  <span>Ликвидация:</span>
                  {isDangerLiq && <AlertTriangle className="w-3 h-3 text-rose-400 animate-bounce" />}
                </span>
                <span className={`font-bold ${isDangerLiq ? 'text-rose-400' : 'text-rose-300'}`}>
                  {formatPrice(pos.liquidation_price, pos.symbol)}
                </span>
              </div>
            </div>

            {/* SL / TP Badges & Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2 text-[10px] font-mono">
                {pos.take_profit ? (
                  <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    TP: {formatPrice(pos.take_profit, pos.symbol)}
                  </span>
                ) : (
                  <span className="text-slate-500">TP: —</span>
                )}

                {pos.stop_loss ? (
                  <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                    SL: {formatPrice(pos.stop_loss, pos.symbol)}
                  </span>
                ) : (
                  <span className="text-slate-500">SL: —</span>
                )}

                <button
                  onClick={() => handleOpenEdit(pos)}
                  title="Изменить TP/SL"
                  className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => closePosition(pos.id)}
                className="px-3 py-1 bg-dark-surface hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-dark-border hover:border-rose-500/40 rounded-lg text-xs font-semibold transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        );
      })}

      {/* Edit SL/TP Modal */}
      {editingPos && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">
                Настройка TP / SL для {editingPos.symbol}
              </h3>
              <button onClick={() => setEditingPos(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-emerald-400 block mb-1">
                  Take-Profit (цена закрытия с прибылью)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Оставьте пустым для отмены"
                  value={editTP}
                  onChange={e => setEditTP(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-rose-400 block mb-1">
                  Stop-Loss (цена закрытия с ограничением убытка)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Оставьте пустым для отмены"
                  value={editSL}
                  onChange={e => setEditSL(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setEditingPos(null)}
                className="flex-1 py-2 bg-dark-surface hover:bg-dark-border text-xs text-slate-300 rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveSLTP}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-black rounded-xl"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
