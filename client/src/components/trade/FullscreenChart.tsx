import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ChartTerminal } from './ChartTerminal.js';
import { useMarket } from '../../context/MarketContext.js';
import { formatPrice, formatPercent } from '../../utils/formatters.js';

interface FullscreenChartProps {
  onClose: () => void;
}

export const FullscreenChart: React.FC<FullscreenChartProps> = ({ onClose }) => {
  const { activeSymbol, currentTicker } = useMarket();
  const isUp = (currentTicker?.change24hPercent || 0) >= 0;

  return (
    <div className="fixed inset-0 bg-dark-bg z-50 flex flex-col select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-dark-card border-b border-dark-border">
        <button
          onClick={onClose}
          className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-dark-surface"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </button>

        <div className="flex items-center space-x-3 text-right">
          <div className="font-bold text-sm text-white">{activeSymbol}</div>
          <div className="font-mono text-xs font-bold text-white">
            {formatPrice(currentTicker?.price || 0, activeSymbol)}
          </div>
          <div className={`font-mono text-xs font-semibold ${isUp ? 'text-trade-up' : 'text-trade-down'}`}>
            {formatPercent(currentTicker?.change24hPercent || 0)}
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 w-full overflow-hidden">
        <ChartTerminal onOpenFullscreen={() => {}} isFullscreen={true} />
      </div>
    </div>
  );
};
