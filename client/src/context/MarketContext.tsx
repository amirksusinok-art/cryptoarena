import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Ticker, OrderBook, MarketEvent, Candle } from '../types/index.js';
import { useAuth } from './AuthContext.js';

interface MarketContextType {
  activeSymbol: string;
  setActiveSymbol: (sym: string) => void;
  tickers: Ticker[];
  currentTicker: Ticker | undefined;
  orderBook: OrderBook | null;
  activeEvents: MarketEvent[];
  favorites: string[];
  toggleFavorite: (symbol: string) => Promise<void>;
  latestCandleUpdate: { symbol: string; timeframe: string; candle: Candle; isNew: boolean } | null;
  isConnected: boolean;
}

const MarketContext = createContext<MarketContextType>({
  activeSymbol: 'BTC/USDT',
  setActiveSymbol: () => {},
  tickers: [],
  currentTicker: undefined,
  orderBook: null,
  activeEvents: [],
  favorites: [],
  toggleFavorite: async () => {},
  latestCandleUpdate: null,
  isConnected: false
});

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeSymbol, setActiveSymbolState] = useState<string>('BTC/USDT');
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [activeEvents, setActiveEvents] = useState<MarketEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [latestCandleUpdate, setLatestCandleUpdate] = useState<{ symbol: string; timeframe: string; candle: Candle; isNew: boolean } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const setActiveSymbol = (symbol: string) => {
    setActiveSymbolState(symbol);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE_SYMBOL', symbol }));
    }
  };

  // Fetch initial tickers & favorites
  useEffect(() => {
    fetch('/api/market/tickers')
      .then(res => res.json())
      .then(data => {
        if (data.tickers) setTickers(data.tickers);
      })
      .catch(console.error);

    fetch('/api/market/events')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setActiveEvents(data);
      })
      .catch(console.error);

    if (user?.id) {
      fetch(`/api/market/favorites?userId=${user.id}`)
        .then(res => res.json())
        .then(favs => {
          if (Array.isArray(favs)) setFavorites(favs);
        })
        .catch(console.error);
    }
  }, [user?.id]);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let reconnectTimer: NodeJS.Timeout;

    const connectWs = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Subscribe to current symbol and auth
        ws.send(JSON.stringify({ type: 'SUBSCRIBE_SYMBOL', symbol: activeSymbol }));
        if (user?.id) {
          ws.send(JSON.stringify({ type: 'AUTH', userId: user.id }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SNAPSHOT') {
            if (msg.tickers) setTickers(msg.tickers);
            if (msg.events) setActiveEvents(msg.events);
          } else if (msg.type === 'TICKERS') {
            setTickers(msg.data);
          } else if (msg.type === 'ORDERBOOK') {
            setOrderBook(msg.data);
          } else if (msg.type === 'CANDLE_UPDATE') {
            setLatestCandleUpdate(msg.data);
          } else if (msg.type === 'MARKET_EVENT') {
            // Update active events list
            fetch('/api/market/events')
              .then(res => res.json())
              .then(data => {
                if (Array.isArray(data)) setActiveEvents(data);
              });
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeSymbol, user?.id]);

  const toggleFavorite = async (symbol: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/market/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, symbol })
      });
      const data = await res.json();
      if (data.isFavorite) {
        setFavorites(prev => [...prev, symbol]);
      } else {
        setFavorites(prev => prev.filter(s => s !== symbol));
      }
    } catch (e) {}
  };

  const currentTicker = tickers.find(t => t.symbol === activeSymbol) || tickers[0];

  return (
    <MarketContext.Provider
      value={{
        activeSymbol,
        setActiveSymbol,
        tickers,
        currentTicker,
        orderBook,
        activeEvents,
        favorites,
        toggleFavorite,
        latestCandleUpdate,
        isConnected
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => useContext(MarketContext);
