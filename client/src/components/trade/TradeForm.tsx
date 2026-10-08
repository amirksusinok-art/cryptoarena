import React, { useState } from 'react';
import { useMarket } from '../../context/MarketContext.js';
import { useTrade } from '../../context/TradeContext.js';
import { formatMoney, formatPrice } from '../../utils/formatters.js';

export const TradeForm: React.FC = () => {
  const { activeSymbol, currentTicker } = useMarket();
  const { portfolio, placeOrder, isSubmitting } = useTrade();

  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [sizeInput, setSizeInput] = useState<string>('500');
  const [limitPriceInput, setLimitPriceInput] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(10);
  const [enableSLTP, setEnableSLTP] = useState<boolean>(false);
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = portfolio?.availableBalance || 0;
  const currentPrice = currentTicker?.price || 100;
  const notionalSize = parseFloat(sizeInput) || 0;

  // Leverage presets
  const leverageOptions = [1, 2, 5, 10, 25, 50, 100];
  const maxLeverage = currentTicker?.maxLeverage || 100;

  // Isolated Margin Calculation
  const requiredMargin = leverage > 0 ? notionalSize / leverage : 0;
  const estimatedFee = notionalSize * 0.0010; // 0.10%
  const totalRequired = requiredMargin + estimatedFee;

  // Estimated Liquidation Price Preview
  const basePrice = orderType === 'LIMIT' && parseFloat(limitPriceInput) > 0 ? parseFloat(limitPriceInput) : currentPrice;
  let estimatedLiqPrice = 0;
  if (side === 'LONG') {
    estimatedLiqPrice = Math.max(0.00001, basePrice * (1 - 1 / leverage + 0.01 + 0.001));
  } else {
    estimatedLiqPrice = basePrice * (1 + 1 / leverage - 0.01 - 0.001);
  }

  // Quick percent buttons
  const handlePercentClick = (pct: number) => {
    const marginToUse = (availableBalance * pct) / 100;
    const computedSize = Math.max(10, Math.floor(marginToUse * leverage));
    setSizeInput(computedSize.toString());
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (notionalSize <= 0) {
      setErrorMsg('Укажите корректный размер позиции');
      return;
    }
    if (availableBalance < totalRequired) {
      setErrorMsg(`Недостаточно средств. Требуется $${totalRequired.toFixed(2)}, доступно $${availableBalance.toFixed(2)}`);
      return;
    }

    const limitPrice = orderType === 'LIMIT' ? parseFloat(limitPriceInput || currentPrice.toString()) : undefined;
    const stopLoss = enableSLTP && parseFloat(stopLossInput) > 0 ? parseFloat(stopLossInput) : null;
    const takeProfit = enableSLTP && parseFloat(takeProfitInput) > 0 ? parseFloat(takeProfitInput) : null;

    const res = await placeOrder({
      symbol: activeSymbol,
      type: orderType,
      side,
      size: notionalSize,
      leverage,
      limitPrice,
      stopLoss,
      takeProfit
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Ошибка размещения ордера');
    } else {
      // Clear or reset fields
      setErrorMsg(null);
    }
  };

  return (
    <div className="bg-dark-card border-b border-dark-border p-3.5 space-y-3 select-none">
      {/* Order Type & Side Toggles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex bg-dark-surface p-0.5 rounded-lg border border-dark-border">
          <button
            onClick={() => setOrderType('MARKET')}
            className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${
              orderType === 'MARKET' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => {
              setOrderType('LIMIT');
              if (!limitPriceInput) setLimitPriceInput(currentPrice.toString());
            }}
            className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${
              orderType === 'LIMIT' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Limit
          </button>
        </div>

        <div className="flex bg-dark-surface p-0.5 rounded-lg border border-dark-border">
          <button
            onClick={() => setSide('LONG')}
            className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
              side === 'LONG' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            BUY / LONG
          </button>
          <button
            onClick={() => setSide('SHORT')}
            className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
              side === 'SHORT' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            SELL / SHORT
          </button>
        </div>
      </div>

      {/* Limit Price Input (if Limit order) */}
      {orderType === 'LIMIT' && (
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
            Лимитная цена (USDT)
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={limitPriceInput}
              onChange={e => setLimitPriceInput(e.target.value)}
              placeholder={currentPrice.toString()}
              className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => setLimitPriceInput(currentPrice.toString())}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
            >
              ТЕКУЩАЯ
            </button>
          </div>
        </div>
      )}

      {/* Position Size Input */}
      <div>
        <div className="flex justify-between items-center mb-1 text-[10px]">
          <span className="font-semibold text-slate-400 uppercase tracking-wider">Размер позиции (USDT)</span>
          <span className="text-slate-400">Доступно: <b className="text-white font-mono">{formatMoney(availableBalance)}</b></span>
        </div>
        <div className="relative">
          <input
            type="number"
            min="10"
            value={sizeInput}
            onChange={e => setSizeInput(e.target.value)}
            className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">USDT</span>
        </div>

        {/* Quick Percent Buttons */}
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              onClick={() => handlePercentClick(pct)}
              className="py-1 bg-dark-surface hover:bg-dark-border/80 border border-dark-border rounded text-[10px] font-mono text-slate-300 hover:text-white transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Leverage Selector */}
      <div>
        <div className="flex justify-between items-center mb-1 text-[10px]">
          <span className="font-semibold text-slate-400 uppercase tracking-wider">Кредитное плечо</span>
          <span className="font-mono font-bold text-emerald-400">x{leverage}</span>
        </div>
        <div className="flex space-x-1 overflow-x-auto pb-0.5">
          {leverageOptions
            .filter(lev => lev <= maxLeverage)
            .map(lev => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                className={`flex-1 min-w-[36px] py-1 rounded text-xs font-mono font-semibold transition-colors ${
                  leverage === lev
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-dark-surface text-slate-400 hover:text-slate-200 border border-dark-border'
                }`}
              >
                x{lev}
              </button>
            ))}
        </div>
      </div>

      {/* Stop Loss & Take Profit Toggle */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center space-x-2 cursor-pointer text-slate-300 text-[11px]">
            <input
              type="checkbox"
              checked={enableSLTP}
              onChange={e => setEnableSLTP(e.target.checked)}
              className="rounded bg-dark-surface border-dark-border text-emerald-500 focus:ring-0"
            />
            <span>Установить TP / SL</span>
          </label>
        </div>

        {enableSLTP && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-[10px] text-emerald-400 font-semibold mb-0.5 block">Take-Profit</span>
              <input
                type="number"
                step="any"
                placeholder={formatPrice(side === 'LONG' ? currentPrice * 1.05 : currentPrice * 0.95)}
                value={takeProfitInput}
                onChange={e => setTakeProfitInput(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-rose-400 font-semibold mb-0.5 block">Stop-Loss</span>
              <input
                type="number"
                step="any"
                placeholder={formatPrice(side === 'LONG' ? currentPrice * 0.95 : currentPrice * 1.05)}
                value={stopLossInput}
                onChange={e => setStopLossInput(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Margin and Risk Metrics (Isolated Margin info) */}
      <div className="bg-dark-surface/60 border border-dark-border/50 rounded-xl p-2.5 space-y-1 text-[11px]">
        <div className="flex justify-between text-slate-400">
          <span>Изолированная маржа:</span>
          <span className="font-mono text-white font-medium">{formatMoney(requiredMargin)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Комиссия входа (0.10%):</span>
          <span className="font-mono text-white font-medium">{formatMoney(estimatedFee)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Цена ликвидации (расчёт):</span>
          <span className="font-mono text-rose-400 font-bold">{formatPrice(estimatedLiqPrice, activeSymbol)}</span>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || notionalSize <= 0}
        className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all flex items-center justify-center space-x-2 ${
          side === 'LONG'
            ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 active:scale-[0.98]'
            : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20 active:scale-[0.98]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span>
          {isSubmitting
            ? 'Исполнение...'
            : side === 'LONG'
            ? `ОТКРЫТЬ LONG ${activeSymbol}`
            : `ОТКРЫТЬ SHORT ${activeSymbol}`}
        </span>
      </button>
    </div>
  );
};
