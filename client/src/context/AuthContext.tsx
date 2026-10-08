import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { tg } from '../utils/telegram.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isDevMock: boolean;
  switchDevUser: (mockId: string, name: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isDevMock: false,
  switchDevUser: async () => {},
  refreshUser: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDevMock, setIsDevMock] = useState(false);

  const initAuth = async (overrideDevId?: string, overrideDevName?: string) => {
    setIsLoading(true);
    try {
      tg.init();
      const initData = tg.getInitData();

      if (initData && !overrideDevId) {
        // Authenticate via Telegram Mini App initData
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData })
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          setToken(data.token);
          setIsDevMock(false);
        }
      } else {
        // Running in desktop browser outside Telegram or explicit switch
        const mockId = overrideDevId || localStorage.getItem('cryptoarena_mock_user') || 'trader_alpha';
        const name = overrideDevName || (mockId === 'trader_alpha' ? 'Alpha Trader' : 'Beta Whale');

        const res = await fetch('/api/auth/dev-mock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mockId, name, username: mockId })
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          setToken(data.token);
          setIsDevMock(true);
          localStorage.setItem('cryptoarena_mock_user', mockId);
        }
      }
    } catch (err) {
      console.error('[AuthContext] Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchDevUser = async (mockId: string, name: string) => {
    await initAuth(mockId, name);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/portfolio?userId=${user.id}`);
      const data = await res.json();
      if (data && data.totalBalance !== undefined) {
        setUser(prev => prev ? { ...prev, balance: data.availableBalance + data.lockedBalance, locked_balance: data.lockedBalance } : null);
      }
    } catch (e) {}
  };

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isDevMock, switchDevUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
