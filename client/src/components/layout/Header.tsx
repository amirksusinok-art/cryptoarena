import React, { useState } from 'react';
import { ChevronDown, Star, Shield, Users, Wifi, WifiOff } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useTrade } from '../../context/TradeContext.js';
import { formatPrice, formatPercent, formatMoney } from '../../utils/formatters.js';

interface HeaderProps {
  onOpenAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAdmin }) => {
  const { activeSymbol, setActiveSymbol, tickers, currentTicker, favorites, toggleFavorite, isConnected } = useMarket();
  const { user, isDevMock, switchDevUser } = useAuth();
  const { portfolio, activeBattleId, setActiveBattleId } = useTrade();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);

  const isFav = favorites.includes(activeSymbol);
  const isUp = (currentTicker?.change24hPercent || 0) >= 0;

  return (
    <header className="bg-dark-card border-b border-dark-border px-3.5 py-2.5 flex items-center justify-between relative z-30 select-none">
      {/* Pair Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 bg-dark-surface hover:bg-dark-border/60 transition-colors px-2.5 py-1.5 rounded-lg border border-dark-border/80"
        >
          <span className="font-bold text-sm tracking-wide text-white">{activeSymbol}</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 bg-dark-card border border-dark-border rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-md">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-dark-border/50">
              Торговые пары
            </div>
            <div className="max-h-60 overflow-y-auto">
              {tickers.map(t => {
                const up = t.change24hPercent >= 0;
                return (
                  <button
                    key={t.symbol}
                    onClick={() => {
                      setActiveSymbol(t.symbol);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left hover:bg-dark-surface/80 transition-colors ${
                      t.symbol === activeSymbol ? 'bg-dark-surface border-l-2 border-emerald-500' : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">{t.symbol}</div>
                      <div className="text-[10px] text-slate-400">{t.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-slate-200">{formatPrice(t.price, t.symbol)}</div>
                      <div className={`text-[10px] font-mono font-medium ${up ? 'text-trade-up' : 'text-trade-down'}`}>
                        {formatPercent(t.change24hPercent)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Active Battle Indicator or Price Badge */}
      {activeBattleId ? (
        <div className="flex items-center space-x-2 bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs font-semibold text-purple-200 uppercase tracking-wide">BATTLE MODE</span>
          <button
            onClick={() => setActiveBattleId(null)}
            className="text-[10px] text-purple-300 hover:text-white underline ml-1"
          >
            Выйти
          </button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toggleFavorite(activeSymbol)}
            className={`p-1.5 rounded-lg transition-colors ${
              isFav ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
          <div className="text-right">
            <div className="text-xs font-mono font-bold text-white">
              {formatPrice(currentTicker?.price || 0, activeSymbol)}
            </div>
            <div className={`text-[10px] font-mono font-semibold ${isUp ? 'text-trade-up' : 'text-trade-down'}`}>
              {formatPercent(currentTicker?.change24hPercent || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Equity & Settings / Admin Buttons */}
      <div className="flex items-center space-x-2">
        <div className="bg-dark-surface/90 border border-dark-border/80 px-2.5 py-1 rounded-lg text-right">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">Капитал</div>
          <div className="text-xs font-mono font-bold text-emerald-400">
            {formatMoney(portfolio?.totalEquity || user?.balance || 10000)}
          </div>
        </div>

        {/* Admin / Dev Controls */}
        <button
          onClick={onOpenAdmin}
          title="Панель администратора / Market Events"
          className="p-1.5 rounded-lg bg-dark-surface hover:bg-dark-border border border-dark-border text-slate-300 hover:text-white transition-colors"
        >
          <Shield className="w-4 h-4 text-emerald-400" />
        </button>

        {isDevMock && (
          <button
            onClick={() => setDevModalOpen(true)}
            title="Переключить тестового пользователя"
            className="p-1.5 rounded-lg bg-dark-surface hover:bg-dark-border border border-dark-border text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Users className="w-4 h-4" />
          </button>
        )}

        {/* Connection status indicator */}
        <div title={isConnected ? 'WebSocket Online' : 'WebSocket Reconnecting'}>
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Dev Switch User Modal */}
      {devModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Переключение Dev Аккаунта</span>
            </h3>
            <p className="text-xs text-slate-400">
              Позволяет переключаться между разными виртуальными трейдерами для тестирования Trading Battles и системы друзей.
            </p>
            <div className="space-y-2">
              {[
                { id: 'trader_alpha', name: 'Alpha Trader ($10 000)' },
                { id: 'trader_beta', name: 'Beta Whale ($10 000)' },
                { id: 'trader_gamma', name: 'Gamma Scalper ($10 000)' }
              ].map(u => (
                <button
                  key={u.id}
                  onClick={async () => {
                    await switchDevUser(u.id, u.name.split(' ')[0]);
                    setDevModalOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                    user?.username === u.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-dark-surface border-dark-border text-slate-300 hover:bg-dark-border'
                  }`}
                >
                  <span>{u.name}</span>
                  {user?.username === u.id && <span className="text-[10px] text-blue-400 font-bold">АКТИВЕН</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDevModalOpen(false)}
              className="w-full py-2 bg-dark-surface hover:bg-dark-border text-xs font-medium text-slate-300 rounded-xl"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
