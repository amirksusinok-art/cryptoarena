import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, ColorType } from 'lightweight-charts';
import { Maximize2, BarChart2, TrendingUp, Info } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';
import { useTrade } from '../../context/TradeContext.js';
import { Candle, Position } from '../../types/index.js';
import { OrderBook } from './OrderBook.js';
import { formatPrice, formatCompactNumber } from '../../utils/formatters.js';

interface ChartTerminalProps {
  onOpenFullscreen: () => void;
  isFullscreen?: boolean;
}

export type ChartPaneTab = 'chart' | 'orderbook' | 'info';

export const ChartTerminal: React.FC<ChartTerminalProps> = ({ onOpenFullscreen, isFullscreen = false }) => {
  const { activeSymbol, currentTicker, latestCandleUpdate } = useMarket();
  const { portfolio } = useTrade();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [activePaneTab, setActivePaneTab] = useState<ChartPaneTab>('chart');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [loading, setLoading] = useState(true);

  // Initialize and load historical candles
  useEffect(() => {
    if (activePaneTab !== 'chart' || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#848e9c',
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace"
      },
      grid: {
        vertLines: { color: 'rgba(30, 36, 51, 0.4)' },
        horzLines: { color: 'rgba(30, 36, 51, 0.4)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#0ea5e9', width: 1, style: 3 },
        horzLine: { color: '#0ea5e9', width: 1, style: 3 }
      },
      rightPriceScale: {
        borderColor: '#1e2433',
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.22 }
      },
      timeScale: {
        borderColor: '#1e2433',
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: true,
      handleScale: true
    });

    chartRef.current = chart;

    // Volume histogram on lower overlay
    const volumeSeries = chart.addHistogramSeries({
      color: 'rgba(14, 203, 129, 0.35)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 }
    });
    volumeSeriesRef.current = volumeSeries;

    // Price series (Candles or Line)
    let series: any;
    if (chartType === 'candle') {
      series = chart.addCandlestickSeries({
        upColor: '#0ecb81',
        downColor: '#f6465d',
        borderVisible: false,
        wickUpColor: '#0ecb81',
        wickDownColor: '#f6465d'
      });
    } else {
      series = chart.addLineSeries({
        color: '#0ecb81',
        lineWidth: 2,
        crosshairMarkerVisible: true
      });
    }

    seriesRef.current = series;

    // Fetch initial candles
    setLoading(true);
    fetch(`/api/market/candles?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        if (data.candles && data.candles.length > 0) {
          const formatted = data.candles.map((c: Candle) => {
            if (chartType === 'candle') {
              return {
                time: c.time as UTCTimestamp,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
              };
            } else {
              return {
                time: c.time as UTCTimestamp,
                value: c.close
              };
            }
          });

          const volumeData = data.candles.map((c: Candle) => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(14, 203, 129, 0.35)' : 'rgba(246, 70, 93, 0.35)'
          }));

          series.setData(formatted);
          volumeSeries.setData(volumeData);
          chart.timeScale().fitContent();
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Handle container resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [activeSymbol, timeframe, chartType, activePaneTab]);

  // Handle incoming real-time candle updates
  useEffect(() => {
    if (!latestCandleUpdate || !seriesRef.current) return;
    if (latestCandleUpdate.symbol !== activeSymbol || latestCandleUpdate.timeframe !== timeframe) return;

    const c = latestCandleUpdate.candle;
    try {
      if (chartType === 'candle') {
        seriesRef.current.update({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
        });
      } else {
        seriesRef.current.update({
          time: c.time as UTCTimestamp,
          value: c.close
        });
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)'
        });
      }
    } catch (e) {}
  }, [latestCandleUpdate, activeSymbol, timeframe, chartType]);

  // Overlay Position Entry, Stop Loss, and Take Profit lines
  useEffect(() => {
    if (!seriesRef.current || !currentTicker) return;

    // Clear previous lines
    priceLinesRef.current.forEach(line => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    const activePositions = portfolio?.positions?.filter(p => p.symbol === activeSymbol) || [];
    const curPrice = currentTicker.price;

    activePositions.forEach((pos: Position) => {
      // Guard: Only display price line if it is within 25% of current price to prevent squishing chart
      if (Math.abs(pos.entry_price - curPrice) / curPrice < 0.25) {
        const entryLine = seriesRef.current?.createPriceLine({
          price: pos.entry_price,
          color: pos.side === 'LONG' ? '#38bdf8' : '#f97316',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `${pos.side} ВХОД`
        });
        if (entryLine) priceLinesRef.current.push(entryLine);
      }

      if (pos.stop_loss && Math.abs(pos.stop_loss - curPrice) / curPrice < 0.25) {
        const slLine = seriesRef.current?.createPriceLine({
          price: pos.stop_loss,
          color: '#f6465d',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: 'SL'
        });
        if (slLine) priceLinesRef.current.push(slLine);
      }

      if (pos.take_profit && Math.abs(pos.take_profit - curPrice) / curPrice < 0.25) {
        const tpLine = seriesRef.current?.createPriceLine({
          price: pos.take_profit,
          color: '#0ecb81',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: 'TP'
        });
        if (tpLine) priceLinesRef.current.push(tpLine);
      }
    });
  }, [portfolio?.positions, activeSymbol, currentTicker]);

  const timeframes: ('1m' | '5m' | '15m' | '1h' | '4h' | '1d')[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <div className={`flex flex-col bg-dark-bg border-b border-dark-border ${isFullscreen ? 'h-full' : 'h-[310px]'}`}>
      {/* 1. Top Mode Selector: [ График ] | [ Стакан ] | [ Инфо ] */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-border/60 bg-dark-card/90 text-xs select-none">
          <div className="flex bg-dark-surface p-0.5 rounded-lg border border-dark-border/70 text-[11px]">
            <button
              onClick={() => setActivePaneTab('chart')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activePaneTab === 'chart' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              График
            </button>
            <button
              onClick={() => setActivePaneTab('orderbook')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activePaneTab === 'orderbook' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Стакан
            </button>
            <button
              onClick={() => setActivePaneTab('info')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activePaneTab === 'info' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Инфо
            </button>
          </div>

          {/* Timeframes Bar (visible if Chart tab active) */}
          {activePaneTab === 'chart' && (
            <div className="flex items-center space-x-1">
              {timeframes.map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-medium transition-colors ${
                    timeframe === tf
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}

              <button
                onClick={() => setChartType(chartType === 'candle' ? 'line' : 'candle')}
                title="Тип графика"
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-surface transition-colors"
              >
                {chartType === 'candle' ? <BarChart2 className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onOpenFullscreen}
                title="Полноэкранный режим"
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-surface transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Pane Content */}
      <div className="relative flex-1 w-full overflow-hidden">
        {activePaneTab === 'chart' && (
          <div className="w-full h-full relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/60 z-10 text-xs text-slate-400 font-mono">
                Загрузка свечей...
              </div>
            )}
            <div ref={chartContainerRef} className="w-full h-full" />
          </div>
        )}

        {activePaneTab === 'orderbook' && (
          <div className="h-full overflow-y-auto">
            <OrderBook />
          </div>
        )}

        {activePaneTab === 'info' && currentTicker && (
          <div className="p-4 space-y-3 font-mono text-xs text-slate-300">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>Параметры инструмента {currentTicker.symbol}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-dark-card border border-dark-border p-3 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">24h Максимум:</span>
                <span className="text-emerald-400 font-bold">{formatPrice(currentTicker.high24h, currentTicker.symbol)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">24h Минимум:</span>
                <span className="text-rose-400 font-bold">{formatPrice(currentTicker.low24h, currentTicker.symbol)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">24h Объём:</span>
                <span className="text-white font-bold">{formatCompactNumber(currentTicker.volume24h)} USDT</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">Рыночный спред:</span>
                <span className="text-white font-bold">{(currentTicker.spread * 100).toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">Макс. плечо:</span>
                <span className="text-emerald-400 font-bold">x{currentTicker.maxLeverage}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">Статус рынка:</span>
                <span className="text-emerald-400 font-bold">АКТИВЕН</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
