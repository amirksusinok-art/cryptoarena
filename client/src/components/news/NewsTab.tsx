import React, { useEffect, useState } from 'react';
import { Newspaper, AlertOctagon, Flame, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.js';
import { MarketNews } from '../../types/index.js';
import { formatDate } from '../../utils/formatters.js';

export const NewsTab: React.FC = () => {
  const { activeEvents } = useMarket();
  const [news, setNews] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/market/news?limit=40');
      const data = await res.json();
      if (Array.isArray(data)) setNews(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5000);
    return () => clearInterval(interval);
  }, []);

  const [filter, setFilter] = useState<'all' | 'events' | 'market'>('all');

  const filteredNews = news.filter(item => {
    if (filter === 'events') return item.type === 'PUMP' || item.type === 'DUMP' || item.type === 'PANIC' || item.type === 'BLACK_MONDAY';
    if (filter === 'market') return item.type === 'INFO' || item.type === 'VOLATILITY';
    return true;
  });

  const getImpactBadgeClass = (importance: string) => {
    if (importance.includes('🟢') || importance.includes('Институционал') || importance.includes('Рекорд') || importance.includes('Отток')) {
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }
    if (importance.includes('🔴') || importance === 'CRITICAL' || importance.includes('Ликвидация') || importance.includes('Дамп')) {
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    }
    if (importance.includes('🟡') || importance.includes('⚡') || importance === 'HIGH' || importance.includes('Волатильность')) {
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }
    if (importance.includes('🔥') || importance.includes('Ончейн') || importance.includes('PUMP')) {
      return 'bg-purple-500/15 text-purple-300 border border-purple-500/30';
    }
    return 'bg-dark-surface text-slate-300 border border-dark-border';
  };

  return (
    <div className="p-3.5 space-y-4 pb-20 select-none">
      {/* Active Major Events Banner (Pump, Dump, Panic, Black Monday) */}
      {activeEvents.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Flame className="w-4 h-4 animate-bounce text-amber-500" />
            <span>Активные рыночные события</span>
          </div>

          {activeEvents.map(ev => {
            const isPump = ev.type === 'PUMP';
            const isDump = ev.type === 'DUMP';
            const isPanic = ev.type === 'PANIC';
            const isBlackMonday = ev.type === 'BLACK_MONDAY';

            let bgColor = 'bg-dark-card border-dark-border';
            let title: string = ev.type;

            if (isPump) {
              bgColor = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';
              title = `🚀 PUMP DETECTED: ${ev.symbol}`;
            } else if (isDump) {
              bgColor = 'bg-rose-500/10 border-rose-500/40 text-rose-300';
              title = `🔻 DUMP DETECTED: ${ev.symbol}`;
            } else if (isPanic) {
              bgColor = 'bg-amber-500/10 border-amber-500/40 text-amber-300';
              title = `🚨 MARKET PANIC ACTIVE`;
            } else if (isBlackMonday) {
              bgColor = 'bg-purple-500/15 border-purple-500/50 text-purple-200';
              title = `💀 BLACK MONDAY [${ev.phase}]`;
            }

            return (
              <div key={ev.id} className={`border rounded-xl p-3 shadow-lg relative overflow-hidden ${bgColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-sm tracking-wide">{title}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-black/40 border border-current font-bold">
                    {ev.phase || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs opacity-90">
                  {isPump && 'Аномальный восходящий импульс. Повышенная интенсивность покупателей.'}
                  {isDump && 'Стремительное падение актива. Высокий риск ликвидаций Long.'}
                  {isPanic && 'Глобальная системная волатильность по всем торговым парам.'}
                  {isBlackMonday && 'Крупнейший биржевой крах сезона! Сохраняйте хладнокровие и контролируйте риски.'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Market News Feed Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-white font-bold text-sm">
          <Newspaper className="w-4 h-4 text-emerald-400" />
          <span>Лента рыночных событий</span>
        </div>
        <button
          onClick={fetchNews}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="Обновить"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex space-x-1.5 text-xs font-semibold">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filter === 'all' ? 'bg-emerald-500 text-black' : 'bg-dark-card border border-dark-border text-slate-400 hover:text-white'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setFilter('events')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filter === 'events' ? 'bg-emerald-500 text-black' : 'bg-dark-card border border-dark-border text-slate-400 hover:text-white'
          }`}
        >
          Импульсы & Паника
        </button>
        <button
          onClick={() => setFilter('market')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filter === 'market' ? 'bg-emerald-500 text-black' : 'bg-dark-card border border-dark-border text-slate-400 hover:text-white'
          }`}
        >
          Фоновые новости
        </button>
      </div>

      {/* News List */}
      <div className="space-y-2.5">
        {filteredNews.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-xs text-slate-500">
            {loading ? 'Загрузка новостей...' : 'Нет новостей по выбранному фильтру'}
          </div>
        ) : (
          filteredNews.map((item) => {
            const isPump = item.type === 'PUMP';
            const isDump = item.type === 'DUMP';
            const isPanic = item.type === 'PANIC' || item.type === 'BLACK_MONDAY';

            return (
              <div
                key={item.id}
                className="bg-dark-card border border-dark-border hover:border-slate-700 rounded-xl p-3 space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    {isPump && <ArrowUpRight className="w-4 h-4 text-emerald-400" />}
                    {isDump && <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                    {isPanic && <AlertOctagon className="w-4 h-4 text-amber-400" />}
                    <span className="font-bold text-xs text-white">{item.symbol}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getImpactBadgeClass(item.importance)}`}>
                      {item.importance}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">{formatDate(item.created_at)}</span>
                </div>

                <h4 className="font-bold text-xs text-slate-200">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
