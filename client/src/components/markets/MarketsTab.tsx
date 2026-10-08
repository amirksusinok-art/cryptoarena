import React, { useState } from 'react';
import { Search, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';
import { formatPrice, formatPercent, formatCompactNumber } from '../../utils/formatters.js';

interface MarketsTabProps {
  onSelectPair: (symbol: string) => void;
}

export const MarketsTab: React.FC<MarketsTabProps> = ({ onSelectPair }) => {
  const { tickers, favorites, toggleFavorite } = useMarket();
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers' | 'favorites'>('all');
  const [search, setSearch] = useState('');

  // Top gainers and losers
  const sorted = [...tickers].sort((a, b) => b.change24hPercent - a.change24hPercent);
  const topGainers = sorted.slice(0, 3);
  const topLosers = [...sorted].reverse().slice(0, 3);

  const filteredTickers = tickers.filter(t => {
    const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'favorites') return favorites.includes(t.symbol);
    if (filter === 'gainers') return t.change24hPercent > 0;
    if (filter === 'losers') return t.change24hPercent < 0;
    return true;
  });

  return (
    <div className="p-3.5 space-y-4 pb-20 select-none">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по тикеру или названию..."
          className="w-full bg-dark-card border border-dark-border rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Top Gainers & Top Losers Quick Cards (Section 11 & 12) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Top Gainers Card */}
        <div className="bg-dark-card border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span>Top Gainers</span>
          </div>
          <div className="space-y-1.5">
            {topGainers.map(t => (
              <button
                key={t.symbol}
                onClick={() => onSelectPair(t.symbol)}
                className="w-full flex items-center justify-between text-left hover:bg-dark-surface/60 p-1 rounded transition-colors"
              >
                <div>
                  <div className="font-bold text-xs text-white">{t.symbol}</div>
                  <div className="text-[10px] font-mono text-slate-400">{formatPrice(t.price, t.symbol)}</div>
                </div>
                <div className="text-xs font-mono font-bold text-trade-up">
                  {formatPercent(t.change24hPercent)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Top Losers Card */}
        <div className="bg-dark-card border border-rose-500/20 rounded-xl p-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-400 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span>Top Losers</span>
          </div>
          <div className="space-y-1.5">
            {topLosers.map(t => (
              <button
                key={t.symbol}
                onClick={() => onSelectPair(t.symbol)}
                className="w-full flex items-center justify-between text-left hover:bg-dark-surface/60 p-1 rounded transition-colors"
              >
                <div>
                  <div className="font-bold text-xs text-white">{t.symbol}</div>
                  <div className="text-[10px] font-mono text-slate-400">{formatPrice(t.price, t.symbol)}</div>
                </div>
                <div className="text-xs font-mono font-bold text-trade-down">
                  {formatPercent(t.change24hPercent)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-dark-card p-1 rounded-xl border border-dark-border text-xs">
        {[
          { id: 'all', label: 'Все' },
          { id: 'favorites', label: 'Избранные' },
          { id: 'gainers', label: 'Лидеры роста' },
          { id: 'losers', label: 'Падение' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === tab.id ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pairs List */}
      <div className="bg-dark-card border border-dark-border rounded-xl divide-y divide-dark-border/60 overflow-hidden">
        {filteredTickers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {filter === 'favorites' ? 'У вас пока нет избранных пар. Нажмите звезду на паре.' : 'Пары не найдены'}
          </div>
        ) : (
          filteredTickers.map(t => {
            const isUp = t.change24hPercent >= 0;
            const isFav = favorites.includes(t.symbol);

            return (
              <div
                key={t.symbol}
                className="p-3 flex items-center justify-between hover:bg-dark-surface/50 transition-colors"
              >
                {/* Left: Star & Symbol */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(t.symbol);
                    }}
                    className={`p-1 rounded ${isFav ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  <div onClick={() => onSelectPair(t.symbol)} className="cursor-pointer">
                    <div className="font-bold text-sm text-white flex items-center space-x-1.5">
                      <span>{t.symbol}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-dark-surface px-1 py-0.5 rounded border border-dark-border">
                        x{t.maxLeverage}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Объём: {formatCompactNumber(t.volume24h)} USDT
                    </div>
                  </div>
                </div>

                {/* Right: Price & 24h Change Pill */}
                <div
                  onClick={() => onSelectPair(t.symbol)}
                  className="text-right cursor-pointer"
                >
                  <div className="font-mono text-sm font-bold text-white">
                    {formatPrice(t.price, t.symbol)}
                  </div>
                  <div className="flex justify-end mt-0.5">
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isUp ? 'bg-emerald-500/20 text-trade-up' : 'bg-rose-500/20 text-trade-down'
                      }`}
                    >
                      {formatPercent(t.change24hPercent)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
