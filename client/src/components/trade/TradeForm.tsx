import React, { useState } from 'react';
import { ChevronDown, Sliders, X, ShieldAlert } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';
import { useTrade } from '../../context/TradeContext.js';
import { formatMoney, formatPrice } from '../../utils/formatters.js';

export const TradeForm: React.FC = () => {
  const { activeSymbol, currentTicker } = useMarket();
  const { portfolio, placeOrder, isSubmitting } = useTrade();

  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');

  // Input mode: 'margin' (user enters collateral $) or 'notional' (user enters position size)
  const [inputMode, setInputMode] = useState<'margin' | 'notional'>('margin');
  const [amountInput, setAmountInput] = useState<string>('100'); // default $100 margin
  const [sliderPercent, setSliderPercent] = useState<number>(10);
  const [limitPriceInput, setLimitPriceInput] = useState<string>('');

  // Leverage & Bottom Sheet Modal
  const [leverage, setLeverage] = useState<number>(10);
  const [tempLeverage, setTempLeverage] = useState<number>(10);
  const [leverageModalOpen, setLeverageModalOpen] = useState(false);

  // TP / SL Accordion & Modal
  const [showSLTP, setShowSLTP] = useState<boolean>(false);
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = portfolio?.availableBalance || 0;
  const currentPrice = currentTicker?.price || 100;
  const maxLeverage = currentTicker?.maxLeverage || 100;

  // Calculate Notional Size and Required Margin based on inputMode
  const parsedAmount = parseFloat(amountInput) || 0;
  let notionalSize = 0;
  let requiredMargin = 0;

  if (inputMode === 'margin') {
    requiredMargin = parsedAmount;
    notionalSize = parsedAmount * leverage;
  } else {
    notionalSize = parsedAmount;
    requiredMargin = leverage > 0 ? parsedAmount / leverage : 0;
  }

  const estimatedFee = notionalSize * 0.0010; // 0.10%
  const totalRequiredFromBalance = requiredMargin + estimatedFee;

  // Estimated Liquidation Price Preview
  const basePrice = orderType === 'LIMIT' && parseFloat(limitPriceInput) > 0 ? parseFloat(limitPriceInput) : currentPrice;
  let estimatedLiqPrice = 0;
  if (side === 'LONG') {
    estimatedLiqPrice = Math.max(0.00001, basePrice * (1 - 1 / leverage + 0.01 + 0.001));
  } else {
    estimatedLiqPrice = basePrice * (1 + 1 / leverage - 0.01 - 0.001);
  }

  // Handle Percentage Slider
  const handleSliderChange = (pct: number) => {
    setSliderPercent(pct);
    if (availableBalance > 0) {
      if (inputMode === 'margin') {
        const val = Math.max(5, Math.floor((availableBalance * pct) / 100));
        setAmountInput(val.toString());
      } else {
        const marginVal = (availableBalance * pct) / 100;
        const val = Math.max(20, Math.floor(marginVal * leverage));
        setAmountInput(val.toString());
      }
    }
  };

  // Estimated TP / SL PnL preview
  const estimatedTpPnL = takeProfitInput && parseFloat(takeProfitInput) > 0
    ? side === 'LONG'
      ? notionalSize * ((parseFloat(takeProfitInput) - basePrice) / basePrice)
      : notionalSize * ((basePrice - parseFloat(takeProfitInput)) / basePrice)
    : 0;

  const estimatedSlPnL = stopLossInput && parseFloat(stopLossInput) > 0
    ? side === 'LONG'
      ? notionalSize * ((parseFloat(stopLossInput) - basePrice) / basePrice)
      : notionalSize * ((basePrice - parseFloat(stopLossInput)) / basePrice)
    : 0;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (notionalSize <= 0 || requiredMargin <= 0) {
      setErrorMsg('Укажите корректную сумму ордера');
      return;
    }
    if (availableBalance < totalRequiredFromBalance) {
      setErrorMsg(`Недостаточно средств. Требуется $${totalRequiredFromBalance.toFixed(2)}, доступно $${availableBalance.toFixed(2)}`);
      return;
    }

    const limitPrice = orderType === 'LIMIT' ? parseFloat(limitPriceInput || currentPrice.toString()) : undefined;
    const stopLoss = showSLTP && parseFloat(stopLossInput) > 0 ? parseFloat(stopLossInput) : null;
    const takeProfit = showSLTP && parseFloat(takeProfitInput) > 0 ? parseFloat(takeProfitInput) : null;

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
      setErrorMsg(null);
    }
  };

  return (
    <div className="bg-dark-card border-b border-dark-border p-3.5 space-y-3 pb-28 select-none">
      {/* 1. Direction Tabs: Green Long vs Red Short */}
      <div className="grid grid-cols-2 gap-2 bg-dark-bg p-1 rounded-xl border border-dark-border/80">
        <button
          onClick={() => setSide('LONG')}
          className={`py-2 rounded-lg font-bold text-xs tracking-wider transition-all flex items-center justify-center space-x-1 ${
            side === 'LONG'
              ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>КУПИТЬ (LONG)</span>
        </button>
        <button
          onClick={() => setSide('SHORT')}
          className={`py-2 rounded-lg font-bold text-xs tracking-wider transition-all flex items-center justify-center space-x-1 ${
            side === 'SHORT'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>ПРОДАТЬ (SHORT)</span>
        </button>
      </div>

      {/* 2. Order Type & Compact Leverage Badge Button */}
      <div className="flex items-center justify-between">
        {/* Order Type Toggle */}
        <div className="flex bg-dark-surface p-0.5 rounded-lg border border-dark-border/80 text-xs font-semibold">
          <button
            onClick={() => setOrderType('MARKET')}
            className={`px-3 py-1 rounded transition-colors ${
              orderType === 'MARKET' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Рыночный (Market)
          </button>
          <button
            onClick={() => {
              setOrderType('LIMIT');
              if (!limitPriceInput) setLimitPriceInput(currentPrice.toString());
            }}
            className={`px-3 py-1 rounded transition-colors ${
              orderType === 'LIMIT' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Лимитный (Limit)
          </button>
        </div>

        {/* Compact Leverage Badge Button [ x10 ▾ ] */}
        <button
          onClick={() => {
            setTempLeverage(leverage);
            setLeverageModalOpen(true);
          }}
          className="flex items-center space-x-1 px-3 py-1 bg-dark-surface hover:bg-dark-border/80 border border-emerald-500/40 rounded-lg text-emerald-400 font-mono font-bold text-xs transition-colors shadow-sm"
        >
          <span>x{leverage}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Limit Price Input (if Limit order selected) */}
      {orderType === 'LIMIT' && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400 uppercase font-semibold">
            <span>Цена исполнения (Limit Price)</span>
            <span className="font-mono text-slate-300">Рыночная: {formatPrice(currentPrice, activeSymbol)}</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={limitPriceInput}
              onChange={e => setLimitPriceInput(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => setLimitPriceInput(currentPrice.toString())}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded"
            >
              ТЕКУЩАЯ
            </button>
          </div>
        </div>
      )}

      {/* 4. Amount Input with Mode Switch (Margin vs Notional) */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px]">
          {/* Mode Switcher */}
          <div className="flex items-center space-x-1 bg-dark-surface p-0.5 rounded border border-dark-border">
            <button
              onClick={() => {
                if (inputMode !== 'margin') {
                  setInputMode('margin');
                  setAmountInput(requiredMargin > 0 ? requiredMargin.toFixed(0) : '100');
                }
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                inputMode === 'margin' ? 'bg-emerald-500 text-black font-bold' : 'text-slate-400'
              }`}
            >
              Маржа (свои $)
            </button>
            <button
              onClick={() => {
                if (inputMode !== 'notional') {
                  setInputMode('notional');
                  setAmountInput(notionalSize > 0 ? notionalSize.toFixed(0) : '1000');
                }
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                inputMode === 'notional' ? 'bg-emerald-500 text-black font-bold' : 'text-slate-400'
              }`}
            >
              Объём (с плечом)
            </button>
          </div>

          <span className="text-slate-400">
            Свободно: <b className="text-white font-mono">{formatMoney(availableBalance)}</b>
          </span>
        </div>

        {/* Amount Input */}
        <div className="relative">
          <input
            type="number"
            min="1"
            value={amountInput}
            onChange={e => {
              setAmountInput(e.target.value);
            }}
            className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
            USDT
          </span>
        </div>

        {/* 5. Percentage Slider with quick step ticks */}
        <div className="space-y-1 pt-1">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderPercent}
            onChange={e => handleSliderChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-dark-surface rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-400 px-0.5">
            {[0, 25, 50, 75, 100].map(step => (
              <button
                key={step}
                onClick={() => handleSliderChange(step)}
                className={`hover:text-white transition-colors ${
                  sliderPercent === step ? 'text-emerald-400 font-bold' : ''
                }`}
              >
                {step}%
              </button>
            ))}
          </div>
        </div>

        {/* Margin vs Notional Breakdown Hint */}
        <div className="flex justify-between text-[10px] font-mono text-slate-400 bg-dark-bg/60 p-2 rounded-lg border border-dark-border/40">
          <span>Спишется (Маржа): <b className="text-emerald-400">{formatMoney(requiredMargin)}</b></span>
          <span>Объем позы: <b className="text-white">{formatMoney(notionalSize)}</b></span>
        </div>
      </div>

      {/* 6. Collapsible Accordion for TP / SL */}
      <div className="bg-dark-surface/60 border border-dark-border/70 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSLTP(!showSLTP)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <div className="flex items-center space-x-1.5">
            <span>Take-Profit / Stop-Loss</span>
            {(takeProfitInput || stopLossInput) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-400">
            <span>
              {takeProfitInput || stopLossInput ? 'Настроено' : 'Не задано'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSLTP ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showSLTP && (
          <div className="p-3 border-t border-dark-border/60 space-y-2.5 bg-dark-bg/40">
            {/* Take-Profit input */}
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-emerald-400 font-bold">Take-Profit (USDT)</span>
                {estimatedTpPnL !== 0 && (
                  <span className="font-mono text-emerald-400 font-bold">
                    Прибыль: +{formatMoney(Math.abs(estimatedTpPnL))}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                placeholder={formatPrice(side === 'LONG' ? basePrice * 1.05 : basePrice * 0.95, activeSymbol)}
                value={takeProfitInput}
                onChange={e => setTakeProfitInput(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Stop-Loss input */}
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-rose-400 font-bold">Stop-Loss (USDT)</span>
                {estimatedSlPnL !== 0 && (
                  <span className="font-mono text-rose-400 font-bold">
                    Убыток: -{formatMoney(Math.abs(estimatedSlPnL))}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                placeholder={formatPrice(side === 'LONG' ? basePrice * 0.95 : basePrice * 1.05, activeSymbol)}
                value={stopLossInput}
                onChange={e => setStopLossInput(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium flex items-center space-x-1.5">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 7. STICKY BOTTOM ACTION BAR (Directly above Bottom Nav) */}
      <div className="fixed bottom-[56px] left-0 right-0 max-w-md mx-auto px-3.5 py-2 bg-dark-card/95 backdrop-blur-md border-t border-dark-border z-30 shadow-2xl">
        {/* Single Compact Summary Line */}
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-300 mb-1.5 px-0.5">
          <span>Маржа: <b className="text-white">{formatMoney(requiredMargin)}</b></span>
          <span>Ликвидация: <b className="text-rose-400">{formatPrice(estimatedLiqPrice, activeSymbol)}</b></span>
          <span>Ком: <b className="text-slate-300">{formatMoney(estimatedFee)}</b></span>
        </div>

        {/* Big Action Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || notionalSize <= 0}
          className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all shadow-lg flex items-center justify-center space-x-2 active:scale-[0.98] ${
            side === 'LONG'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
              : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span>
            {isSubmitting
              ? 'Исполнение сделки...'
              : side === 'LONG'
              ? `ОТКРЫТЬ LONG ${activeSymbol}`
              : `ОТКРЫТЬ SHORT ${activeSymbol}`}
          </span>
        </button>
      </div>

      {/* 8. Bottom Sheet Modal: Leverage Selector */}
      {leverageModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center p-0">
          <div className="bg-dark-card border-t border-dark-border rounded-t-3xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Настройка Кредитного Плеча</span>
              </div>
              <button
                onClick={() => setLeverageModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-2">
              <span className="text-3xl font-black font-mono text-emerald-400">
                x{tempLeverage}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                Изолированная маржа. Максимум для {activeSymbol}: x{maxLeverage}
              </p>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="1"
              max={maxLeverage}
              value={tempLeverage}
              onChange={e => setTempLeverage(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-dark-surface rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            {/* Quick Chips */}
            <div className="grid grid-cols-6 gap-1.5 pt-1">
              {[1, 5, 10, 25, 50, 100]
                .filter(l => l <= maxLeverage)
                .map(l => (
                  <button
                    key={l}
                    onClick={() => setTempLeverage(l)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                      tempLeverage === l
                        ? 'bg-emerald-500 text-black'
                        : 'bg-dark-surface text-slate-400 hover:text-white border border-dark-border'
                    }`}
                  >
                    x{l}
                  </button>
                ))}
            </div>

            <button
              onClick={() => {
                setLeverage(tempLeverage);
                setLeverageModalOpen(false);
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl tracking-wider transition-colors"
            >
              ПРИМЕНИТЬ ПЛЕЧО x{tempLeverage}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
