import React, { useState } from 'react';
import { Header } from './components/layout/Header.js';
import { VirtualMarketBanner } from './components/layout/VirtualMarketBanner.js';
import { BottomNavigation, TabType } from './components/layout/BottomNavigation.js';

import { ChartTerminal } from './components/trade/ChartTerminal.js';
import { FullscreenChart } from './components/trade/FullscreenChart.js';
import { TradeForm } from './components/trade/TradeForm.js';
import { PositionList } from './components/trade/PositionList.js';
import { OrderList } from './components/trade/OrderList.js';

import { MarketsTab } from './components/markets/MarketsTab.js';
import { NewsTab } from './components/news/NewsTab.js';
import { PortfolioTab } from './components/portfolio/PortfolioTab.js';
import { ProfileTab } from './components/profile/ProfileTab.js';
import { AdminModal } from './components/admin/AdminModal.js';

import { useMarket } from './context/MarketContext.js';
import { useTrade } from './context/TradeContext.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('trade');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const { setActiveSymbol } = useMarket();
  const { portfolio } = useTrade();

  const [tradeSubTab, setTradeSubTab] = useState<'positions' | 'orders'>('positions');

  const handleSelectPairFromMarkets = (symbol: string) => {
    setActiveSymbol(symbol);
    setActiveTab('trade');
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col font-sans max-w-md mx-auto shadow-2xl relative border-x border-dark-border/40 pb-16">
      {/* 1. Virtual Market Notice */}
      <VirtualMarketBanner />

      {/* 2. Top Header */}
      <Header onOpenAdmin={() => setAdminModalOpen(true)} activeTab={activeTab} />

      {/* 3. Main Content Router */}
      <main className="flex-1 overflow-y-auto">
        {/* TAB 1: TRADE TERMINAL */}
        {activeTab === 'trade' && (
          <div className="flex flex-col">
            {/* Interactive Chart & Sub-tabs (Chart, Orderbook, Info) */}
            <ChartTerminal onOpenFullscreen={() => setFullscreenOpen(true)} />

            {/* Trading Form */}
            <TradeForm />

            {/* Positions & Limit Orders Accordion */}
            <div className="border-t border-dark-border bg-dark-card/50">
              <div className="flex border-b border-dark-border text-xs font-semibold">
                <button
                  onClick={() => setTradeSubTab('positions')}
                  className={`flex-1 py-2 text-center transition-colors flex items-center justify-center space-x-1 ${
                    tradeSubTab === 'positions'
                      ? 'border-b-2 border-emerald-500 text-white bg-dark-surface/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Позиции</span>
                  {portfolio?.positions?.length ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      {portfolio.positions.length}
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() => setTradeSubTab('orders')}
                  className={`flex-1 py-2 text-center transition-colors flex items-center justify-center space-x-1 ${
                    tradeSubTab === 'orders'
                      ? 'border-b-2 border-emerald-500 text-white bg-dark-surface/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Лимитные ордера</span>
                  {portfolio?.orders?.length ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                      {portfolio.orders.length}
                    </span>
                  ) : null}
                </button>
              </div>

              {tradeSubTab === 'positions' ? <PositionList /> : <OrderList />}
            </div>
          </div>
        )}

        {/* TAB 2: MARKETS */}
        {activeTab === 'markets' && (
          <MarketsTab onSelectPair={handleSelectPairFromMarkets} />
        )}

        {/* TAB 3: NEWS & EVENTS */}
        {activeTab === 'news' && <NewsTab />}

        {/* TAB 4: PORTFOLIO */}
        {activeTab === 'portfolio' && <PortfolioTab onNavigateToTrade={() => setActiveTab('trade')} />}

        {/* TAB 5: PROFILE & BATTLES */}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* 4. Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Modals */}
      {fullscreenOpen && (
        <FullscreenChart onClose={() => setFullscreenOpen(false)} />
      )}

      {adminModalOpen && (
        <AdminModal onClose={() => setAdminModalOpen(false)} />
      )}
    </div>
  );
};
