import React from 'react';
import { TrendingUp, BarChart2, Newspaper, PieChart, User } from 'lucide-react';
import { useTrade } from '../../context/TradeContext.js';
import { useMarket } from '../../context/MarketContext.js';
import { tg } from '../../utils/telegram.js';

export type TabType = 'trade' | 'markets' | 'news' | 'portfolio' | 'profile';

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onChangeTab }) => {
  const { portfolio } = useTrade();
  const { activeEvents } = useMarket();

  const openPositionsCount = portfolio?.positions?.length || 0;
  const activeEventsCount = activeEvents?.length || 0;

  const handleTabClick = (tab: TabType) => {
    tg.selection();
    onChangeTab(tab);
  };

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'trade', label: 'Торговля', icon: TrendingUp, badge: openPositionsCount },
    { id: 'markets', label: 'Рынки', icon: BarChart2 },
    { id: 'news', label: 'Новости', icon: Newspaper, badge: activeEventsCount },
    { id: 'portfolio', label: 'Портфель', icon: PieChart },
    { id: 'profile', label: 'Профиль', icon: User }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-card/95 backdrop-blur-lg border-t border-dark-border py-1.5 px-2 z-40 select-none pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-black text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
