import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, ColorType } from 'lightweight-charts';
import { Maximize2, BarChart2, TrendingUp } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';
import { useTrade } from '../../context/TradeContext.js';
import { Candle, Position } from '../../types/index.js';

interface ChartTerminalProps {
  onOpenFullscreen: () => void;
  isFullscreen?: boolean;
}

export const ChartTerminal: React.FC<ChartTerminalProps> = ({ onOpenFullscreen, isFullscreen = false }) => {
  const { activeSymbol, latestCandleUpdate } = useMarket();
  const { portfolio } = useTrade();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [loading, setLoading] = useState(true);

  // Initialize and load historical candles
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#94a3b8',
        fontSize: 10
      },
      grid: {
        vertLines: { color: 'rgba(42, 50, 75, 0.4)' },
        horzLines: { color: 'rgba(42, 50, 75, 0.4)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#38bdf8', width: 1, style: 3 },
        horzLine: { color: '#38bdf8', width: 1, style: 3 }
      },
      rightPriceScale: {
        borderColor: '#2a324b',
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: '#2a324b',
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: true,
      handleScale: true
    });

    chartRef.current = chart;

    let series: any;
    if (chartType === 'candle') {
      series = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444'
      });
    } else {
      series = chart.addLineSeries({
        color: '#38bdf8',
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
          series.setData(formatted);
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
    };
  }, [activeSymbol, timeframe, chartType]);

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
    } catch (e) {}
  }, [latestCandleUpdate, activeSymbol, timeframe, chartType]);

  // Overlay Position Entry, Stop Loss, and Take Profit lines directly on the chart! (Section 15)
  useEffect(() => {
    if (!seriesRef.current) return;

    // Clear previous lines
    priceLinesRef.current.forEach(line => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    const activePositions = portfolio?.positions?.filter(p => p.symbol === activeSymbol) || [];

    activePositions.forEach((pos: Position) => {
      // Entry Line
      const entryLine = seriesRef.current?.createPriceLine({
        price: pos.entry_price,
        color: pos.side === 'LONG' ? '#38bdf8' : '#f97316',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `${pos.side} ENTRY`
      });
      if (entryLine) priceLinesRef.current.push(entryLine);

      // Stop Loss Line
      if (pos.stop_loss) {
        const slLine = seriesRef.current?.createPriceLine({
          price: pos.stop_loss,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          axisLabelVisible: true,
          title: 'SL'
        });
        if (slLine) priceLinesRef.current.push(slLine);
      }

      // Take Profit Line
      if (pos.take_profit) {
        const tpLine = seriesRef.current?.createPriceLine({
          price: pos.take_profit,
          color: '#22c55e',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: 'TP'
        });
        if (tpLine) priceLinesRef.current.push(tpLine);
      }

      // Liquidation Price Line
      if (pos.liquidation_price) {
        const liqLine = seriesRef.current?.createPriceLine({
          price: pos.liquidation_price,
          color: '#e11d48',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: 'LIQ'
        });
        if (liqLine) priceLinesRef.current.push(liqLine);
      }
    });
  }, [portfolio?.positions, activeSymbol]);

  const timeframes: ('1m' | '5m' | '15m' | '1h' | '4h' | '1d')[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <div className={`flex flex-col bg-dark-bg border-b border-dark-border ${isFullscreen ? 'h-full' : 'h-[280px]'}`}>
      {/* Controls Bar: Timeframes, Chart Type, Fullscreen */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-border/60 bg-dark-card/60 text-xs select-none">
        <div className="flex items-center space-x-1">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {/* Switch Candlestick vs Line */}
          <button
            onClick={() => setChartType(chartType === 'candle' ? 'line' : 'candle')}
            title="Переключить тип графика"
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-surface transition-colors"
          >
            {chartType === 'candle' ? <BarChart2 className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Button */}
          {!isFullscreen && (
            <button
              onClick={onOpenFullscreen}
              title="Полноэкранный режим"
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-surface transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative flex-1 w-full overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/60 z-10 text-xs text-slate-400">
            Загрузка свечей...
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
