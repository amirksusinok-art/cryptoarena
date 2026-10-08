import React, { useState } from 'react';
import { X, Flame, Shield, Swords, PlusCircle } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';

interface AdminModalProps {
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  const { tickers, activeEvents } = useMarket();
  const [adminKey, setAdminKey] = useState('admin_secret_super_key_2026');
  const [selectedSymbol, setSelectedSymbol] = useState('TON/USDT');
  const [duration, setDuration] = useState('120');
  const [battleTitle, setBattleTitle] = useState('🔥 Flash Battle');
  const [battleDuration, setBattleDuration] = useState('15');

  // Add coin inputs
  const [newSymbol, setNewSymbol] = useState('SOL/USDT');
  const [newName, setNewName] = useState('Solana');
  const [newPrice, setNewPrice] = useState('150');

  const [message, setMessage] = useState<string | null>(null);

  const sendAdminRequest = async (endpoint: string, body: any) => {
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Действие успешно выполнено!');
      } else {
        setMessage(`Ошибка: ${data.error || 'Не удалось выполнить'}`);
      }
    } catch (e: any) {
      setMessage(`Ошибка сети: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 select-none">
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-dark-surface border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Панель Администратора (Admin Control)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {/* Admin Secret Key Input */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Admin Secret Key
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 font-mono text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {message && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 font-medium">
              {message}
            </div>
          )}

          {/* Section 1: Market Events Controls (Section 42) */}
          <div className="bg-dark-bg/60 border border-dark-border/80 rounded-xl p-3 space-y-3">
            <h4 className="font-bold text-slate-200 flex items-center space-x-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Запуск Рыночных Событий</span>
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Актив для Pump / Dump</label>
                <select
                  value={selectedSymbol}
                  onChange={e => setSelectedSymbol(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs"
                >
                  {tickers.map(t => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Длительность (сек)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 font-mono text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => sendAdminRequest('/api/admin/events/pump', { symbol: selectedSymbol, duration })}
                className="py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-xl font-bold transition-colors"
              >
                🚀 Запустить PUMP
              </button>

              <button
                onClick={() => sendAdminRequest('/api/admin/events/dump', { symbol: selectedSymbol, duration })}
                className="py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/50 rounded-xl font-bold transition-colors"
              >
                🔻 Запустить DUMP
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sendAdminRequest('/api/admin/events/panic', { duration })}
                className="py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/50 rounded-xl font-bold transition-colors"
              >
                🚨 MARKET PANIC
              </button>

              <button
                onClick={() => sendAdminRequest('/api/admin/events/black-monday', {})}
                className="py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/60 rounded-xl font-bold transition-colors"
              >
                💀 BLACK MONDAY
              </button>
            </div>

            {activeEvents.length > 0 && (
              <div className="pt-1">
                {activeEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => sendAdminRequest('/api/admin/events/end', { eventId: ev.id })}
                    className="w-full py-1.5 bg-dark-surface hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-dark-border rounded-lg font-medium transition-colors"
                  >
                    Остановить активный {ev.type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Create Trading Battle */}
          <div className="bg-dark-bg/60 border border-dark-border/80 rounded-xl p-3 space-y-3">
            <h4 className="font-bold text-slate-200 flex items-center space-x-1.5">
              <Swords className="w-4 h-4 text-purple-400" />
              <span>Создать Trading Battle</span>
            </h4>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Название битвы..."
                value={battleTitle}
                onChange={e => setBattleTitle(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-2.5 py-1.5 text-white text-xs"
              />

              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Минут"
                  value={battleDuration}
                  onChange={e => setBattleDuration(e.target.value)}
                  className="w-1/2 bg-dark-surface border border-dark-border rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                />
                <button
                  onClick={() =>
                    sendAdminRequest('/api/admin/battles/create', {
                      title: battleTitle,
                      symbol: selectedSymbol,
                      durationMinutes: battleDuration,
                      maxPlayers: 25
                    })
                  }
                  className="w-1/2 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
                >
                  Создать Битву
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Add Custom Coin */}
          <div className="bg-dark-bg/60 border border-dark-border/80 rounded-xl p-3 space-y-3">
            <h4 className="font-bold text-slate-200 flex items-center space-x-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Добавить Новую Торговую Пару</span>
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="SOL/USDT"
                value={newSymbol}
                onChange={e => setNewSymbol(e.target.value)}
                className="bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs"
              />
              <input
                type="text"
                placeholder="Solana"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs"
              />
              <input
                type="number"
                placeholder="Цена"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                className="bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-white font-mono text-xs"
              />
            </div>

            <button
              onClick={() =>
                sendAdminRequest('/api/admin/pairs/add', {
                  symbol: newSymbol,
                  name: newName,
                  basePrice: newPrice,
                  spread: 0.0004,
                  maxLeverage: 50
                })
              }
              className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-colors"
            >
              Добавить Пару
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-dark-surface border-t border-dark-border">
          <button
            onClick={onClose}
            className="w-full py-2 bg-dark-card hover:bg-dark-border text-slate-300 rounded-xl text-xs font-semibold"
          >
            Закрыть Панель
          </button>
        </div>
      </div>
    </div>
  );
};
