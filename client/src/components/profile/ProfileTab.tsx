import React, { useEffect, useState } from 'react';
import { Trophy, Swords, Users, Award, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useTrade } from '../../context/TradeContext.js';
import { Battle } from '../../types/index.js';
import { formatMoney, formatMoneyWithSign } from '../../utils/formatters.js';

export const ProfileTab: React.FC = () => {
  const { user } = useAuth();
  const { setActiveBattleId, activeBattleId } = useTrade();

  const [activeSection, setActiveSection] = useState<'stats' | 'battles' | 'leaderboard' | 'friends'>('stats');

  // Stats data
  const [profileData, setProfileData] = useState<any>(null);
  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  // Battles data
  const [battles, setBattles] = useState<Battle[]>([]);
  // Friends data
  const [friends, setFriends] = useState<any[]>([]);
  const [friendUsernameInput, setFriendUsernameInput] = useState('');
  const [compareData, setCompareData] = useState<any>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/social/profile/${user.id}`)
        .then(res => res.json())
        .then(data => setProfileData(data))
        .catch(console.error);

      fetch('/api/social/friends?userId=' + user.id)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setFriends(data);
        })
        .catch(console.error);
    }

    fetch('/api/social/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (data.leaderboard) setLeaderboard(data.leaderboard);
      })
      .catch(console.error);

    fetch('/api/battles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBattles(data);
      })
      .catch(console.error);
  }, [user?.id]);

  const handleJoinBattle = async (battleId: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/battles/${battleId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        setActiveBattleId(battleId);
        alert('Вы успешно вступили в Битву! Торговый терминал переключен на субсчёт $10,000.');
      } else {
        alert(data.error || 'Ошибка входа в битву');
      }
    } catch (e) {
      alert('Ошибка соединения');
    }
  };

  const handleAddFriend = async () => {
    if (!user?.id || !friendUsernameInput.trim()) return;
    try {
      const res = await fetch('/api/social/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUsername: friendUsernameInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setFriendUsernameInput('');
        const updated = await fetch('/api/social/friends?userId=' + user.id).then(r => r.json());
        if (Array.isArray(updated)) setFriends(updated);
      } else {
        alert(data.error || 'Пользователь не найден');
      }
    } catch (e) {
      alert('Ошибка запроса');
    }
  };

  const handleCompare = async (friendId: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/social/compare?userId=${user.id}&friendId=${friendId}`);
      const data = await res.json();
      setCompareData(data);
      setCompareModalOpen(true);
    } catch (e) {
      alert('Ошибка загрузки сравнения');
    }
  };

  const stats = profileData?.stats || {
    roi: 0,
    winRate: 0,
    pnl: 0,
    tradesCount: 0,
    avgProfit: 0,
    avgLoss: 0,
    bestTrade: 0,
    worstTrade: 0,
    maxDrawdown: 0
  };

  return (
    <div className="p-3.5 space-y-4 pb-20 select-none">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-dark-card to-dark-surface border border-dark-border rounded-2xl p-4 flex items-center space-x-3 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl font-black text-emerald-400">
          {user?.first_name ? user.first_name[0].toUpperCase() : 'T'}
        </div>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-base font-bold text-white truncate">
            {user?.first_name || 'Трейдер'}
          </h2>
          <div className="text-xs text-slate-400 font-mono">
            @{user?.username || 'user'}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded font-mono">
              ROI: {stats.roi >= 0 ? '+' : ''}{stats.roi}%
            </span>
            <span className="text-[10px] bg-dark-bg text-slate-300 font-semibold px-2 py-0.5 rounded border border-dark-border">
              {stats.tradesCount} сделок
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-dark-card p-1 rounded-xl border border-dark-border text-xs">
        <button
          onClick={() => setActiveSection('stats')}
          className={`py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            activeSection === 'stats' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Статы</span>
        </button>

        <button
          onClick={() => setActiveSection('battles')}
          className={`py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            activeSection === 'battles' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Битвы</span>
        </button>

        <button
          onClick={() => setActiveSection('leaderboard')}
          className={`py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            activeSection === 'leaderboard' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Топ</span>
        </button>

        <button
          onClick={() => setActiveSection('friends')}
          className={`py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-1 ${
            activeSection === 'friends' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Друзья</span>
        </button>
      </div>

      {/* SECTION 1: STATS (Section 24) */}
      {activeSection === 'stats' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-dark-card border border-dark-border p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-sans">Винрейт (Win Rate):</span>
              <span className="text-base font-bold text-emerald-400">{stats.winRate}%</span>
            </div>

            <div className="bg-dark-card border border-dark-border p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-sans">Чистый PnL:</span>
              <span className={`text-base font-bold ${stats.pnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                {formatMoneyWithSign(stats.pnl)}
              </span>
            </div>

            <div className="bg-dark-card border border-dark-border p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-sans">Лучшая сделка:</span>
              <span className="text-sm font-bold text-trade-up">
                +{formatMoney(stats.bestTrade)}
              </span>
            </div>

            <div className="bg-dark-card border border-dark-border p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-sans">Худшая сделка:</span>
              <span className="text-sm font-bold text-trade-down">
                {formatMoneyWithSign(stats.worstTrade)}
              </span>
            </div>

            <div className="bg-dark-card border border-dark-border p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-sans">Средняя прибыль:</span>
              <span className="text-sm font-bold text-slate-200">
                +{formatMoney(stats.avgProfit)}
              </span>
            </div>

            <div className="bg-dark-card border border-dark-border p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-sans">Макс. просадка:</span>
              <span className="text-sm font-bold text-rose-400">
                -{stats.maxDrawdown}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TRADING BATTLES (Section 27 & 28) */}
      {activeSection === 'battles' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 leading-relaxed bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
            🏆 <b>Trading Battles</b> — временные соревнования с отдельным изолированным субсчётом <b>$10 000</b>. Результат битвы не влияет на ваш основной баланс!
          </div>

          <div className="space-y-2">
            {battles.map((b) => (
              <div
                key={b.id}
                className="bg-dark-card border border-dark-border rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{b.title}</h4>
                    <span className="text-[11px] font-mono text-purple-400">{b.symbol} • {b.duration_minutes} мин</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    b.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                      : b.status === 'UPCOMING'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-dark-surface text-slate-400'
                  }`}>
                    {b.status}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    Стартовый субсчёт: <b className="text-white font-mono">$10 000</b>
                  </div>
                  {b.status !== 'FINISHED' && (
                    <button
                      onClick={() => handleJoinBattle(b.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                        activeBattleId === b.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                      }`}
                    >
                      {activeBattleId === b.id ? 'В БИТВЕ (Активна)' : 'Вступить ($10k)'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: LEADERBOARD (Section 29) */}
      {activeSection === 'leaderboard' && (
        <div className="space-y-2">
          <div className="bg-dark-card border border-dark-border rounded-xl divide-y divide-dark-border/60 overflow-hidden">
            {leaderboard.map((item, index) => {
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
              const isCurrentUser = item.id === user?.id;

              return (
                <div
                  key={item.id}
                  className={`p-3 flex items-center justify-between ${
                    isCurrentUser ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-sm text-slate-300 w-6 text-center">
                      {medal}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center space-x-1">
                        <span>{item.username}</span>
                        {isCurrentUser && <span className="text-[9px] text-emerald-400 font-mono">(ВЫ)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.tradesCount} сделок • WinRate {item.winRate}%
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className={`text-xs font-bold ${item.roi >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                      {item.roi >= 0 ? '+' : ''}{item.roi}%
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {formatMoney(item.balance)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: FRIENDS & YOU VS FRIEND (Section 26) */}
      {activeSection === 'friends' && (
        <div className="space-y-3">
          {/* Add Friend Form */}
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Username или ID друга..."
              value={friendUsernameInput}
              onChange={e => setFriendUsernameInput(e.target.value)}
              className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleAddFriend}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl flex items-center space-x-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </div>

          {/* Friends List */}
          <div className="bg-dark-card border border-dark-border rounded-xl divide-y divide-dark-border/60 overflow-hidden">
            {friends.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                У вас пока нет друзей в CryptoArena. Добавьте друга для сравнения результатов!
              </div>
            ) : (
              friends.map(f => (
                <div key={f.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-white">{f.username || f.firstName}</div>
                    <div className="text-[10px] font-mono text-emerald-400 font-semibold">
                      ROI: {f.roi >= 0 ? '+' : ''}{f.roi}% • WinRate: {f.winRate}%
                    </div>
                  </div>
                  <button
                    onClick={() => handleCompare(f.id)}
                    className="px-2.5 py-1 bg-dark-surface hover:bg-dark-border text-xs text-slate-200 border border-dark-border rounded-lg font-medium transition-colors"
                  >
                    You vs Friend ⚔️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Compare Modal (You vs Friend) */}
      {compareModalOpen && compareData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>⚔️ Битва Статистики: You vs Friend</span>
              </h3>
              <button onClick={() => setCompareModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              {/* You */}
              <div className="bg-dark-surface/80 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                <div className="font-bold text-emerald-400 truncate">{compareData.you.username} (ВЫ)</div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">ROI</span>
                  <span className="font-bold text-emerald-400">{compareData.you.roi}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Win Rate</span>
                  <span className="font-bold text-white">{compareData.you.winRate}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Сделок</span>
                  <span className="font-bold text-white">{compareData.you.tradesCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Ранг в Топе</span>
                  <span className="font-bold text-amber-400">#{compareData.you.rank}</span>
                </div>
              </div>

              {/* Friend */}
              <div className="bg-dark-surface/80 border border-dark-border rounded-xl p-3 space-y-2">
                <div className="font-bold text-purple-400 truncate">{compareData.friend.username}</div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">ROI</span>
                  <span className="font-bold text-purple-400">{compareData.friend.roi}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Win Rate</span>
                  <span className="font-bold text-white">{compareData.friend.winRate}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Сделок</span>
                  <span className="font-bold text-white">{compareData.friend.tradesCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Ранг в Топе</span>
                  <span className="font-bold text-amber-400">#{compareData.friend.rank}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCompareModalOpen(false)}
              className="w-full py-2 bg-dark-surface hover:bg-dark-border text-xs text-slate-300 rounded-xl"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
