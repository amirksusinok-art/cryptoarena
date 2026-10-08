import { Telegraf, Markup } from 'telegraf';
import { CONFIG } from '../config.js';
import { db } from '../db/index.js';
import { notifier } from './notifier.js';
import { orderEngine } from '../engine/orderEngine.js';
import { eventsEngine } from '../engine/eventsEngine.js';
import { User } from '../db/types.js';

export function setupTelegramBot(): Telegraf | null {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    console.log('[TelegramBot] No TELEGRAM_BOT_TOKEN provided, running in mock/demo mode.');
    return null;
  }

  const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);
  notifier.setBot(bot);

  // --- /start Command ---
  bot.command('start', async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      const telegramId = from.id.toString();
      let user = await db.getUserByTelegramId(telegramId);

      if (!user) {
        const isAdmin = CONFIG.ADMIN_TELEGRAM_IDS.includes(telegramId) ? 1 : 0;
        const newUser: User = {
          id: `u_${telegramId}`,
          telegram_id: telegramId,
          username: from.username || `trader_${telegramId.substring(0, 5)}`,
          first_name: from.first_name || 'Trader',
          photo_url: undefined,
          balance: CONFIG.STARTING_BALANCE,
          locked_balance: 0,
          is_admin: isAdmin,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        user = await db.createUser(newUser);
        await db.addCapitalPoint(user.id, user.balance);
      }

      // Calculate stats
      const trades = await db.getUserTrades(user.id);
      const totalTrades = trades.length;
      const winningTrades = trades.filter(t => t.pnl > 0).length;
      const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;
      const roi = (((user.balance - CONFIG.STARTING_BALANCE) / CONFIG.STARTING_BALANCE) * 100).toFixed(2);

      const webAppUrl = CONFIG.APP_URL;

      const messageText = 
        `⚔️ <b>CryptoArena — Виртуальная Биржа</b>\n\n` +
        `Добро пожаловать в соревновательный симулятор криптовалютной торговли внутри Telegram!\n\n` +
        `💰 <b>Баланс:</b> $${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `📊 <b>ROI:</b> ${Number(roi) >= 0 ? '+' : ''}${roi}%\n` +
        `🎯 <b>Win Rate:</b> ${winRate}%\n` +
        `🔒 <b>Заблокировано:</b> $${user.locked_balance.toFixed(2)}\n\n` +
        `⚡ <i>Торгуйте с изолированной маржой до x100, ловите Pump и переживите Black Monday!</i>`;

      await ctx.reply(messageText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 ОТКРЫТЬ БИРЖУ', webAppUrl)],
          [
            Markup.button.callback('💼 ПОРТФЕЛЬ', 'btn_portfolio'),
            Markup.button.callback('🏆 РЕЙТИНГ', 'btn_leaderboard')
          ]
        ])
      });
    } catch (err) {
      console.error('[TelegramBot] Error handling /start:', err);
      await ctx.reply('Произошла ошибка при запуске. Пожалуйста, попробуйте еще раз.');
    }
  });

  // --- Portfolio Button Callback ---
  bot.action('btn_portfolio', async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const user = await db.getUserByTelegramId(from.id.toString());
      if (!user) {
        await ctx.answerCbQuery('Профиль не найден. Нажмите /start');
        return;
      }

      const positions = await db.getUserPositions(user.id);
      const orders = await db.getUserOrders(user.id);

      let text = `💼 <b>Ваш Портфель:</b>\n\n`;
      text += `💵 <b>Доступно:</b> $${(user.balance - user.locked_balance).toFixed(2)}\n`;
      text += `🔒 <b>В ордерах:</b> $${user.locked_balance.toFixed(2)}\n`;
      text += `📈 <b>Открытых позиций:</b> ${positions.length}\n`;
      text += `⏳ <b>Активных лимитов:</b> ${orders.length}\n\n`;

      if (positions.length > 0) {
        text += `<b>Позиции:</b>\n`;
        for (const p of positions) {
          text += `• ${p.side === 'LONG' ? '🟢' : '🔴'} <b>${p.symbol}</b> (x${p.leverage}) — Вход: $${p.entry_price}\n`;
        }
      } else {
        text += `<i>Нет открытых позиций. Откройте биржу для первой сделки!</i>`;
      }

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 ОТКРЫТЬ БИРЖУ', CONFIG.APP_URL)],
          [Markup.button.callback('« Назад', 'btn_back')]
        ])
      });
      await ctx.answerCbQuery();
    } catch (e) {
      console.error(e);
      await ctx.answerCbQuery('Ошибка загрузки портфеля');
    }
  });

  // --- Leaderboard Button Callback ---
  bot.action('btn_leaderboard', async (ctx) => {
    try {
      const allUsers = await db.getAllUsers();
      const sorted = allUsers
        .map(u => ({
          username: u.username || u.first_name || 'Trader',
          roi: Number((((u.balance - CONFIG.STARTING_BALANCE) / CONFIG.STARTING_BALANCE) * 100).toFixed(2)),
          balance: u.balance
        }))
        .sort((a, b) => b.roi - a.roi)
        .slice(0, 5);

      let text = `🏆 <b>Топ Трейдеров CryptoArena:</b>\n\n`;
      sorted.forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        text += `${medal} <b>${index + 1}. ${item.username}</b>\n    ROI: <b>${item.roi >= 0 ? '+' : ''}${item.roi}%</b> | Капитал: $${item.balance.toFixed(0)}\n`;
      });

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 ВОРВАТЬСЯ В ТОП', CONFIG.APP_URL)],
          [Markup.button.callback('« Назад', 'btn_back')]
        ])
      });
      await ctx.answerCbQuery();
    } catch (e) {
      console.error(e);
      await ctx.answerCbQuery('Ошибка загрузки рейтинга');
    }
  });

  bot.action('btn_back', async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const user = await db.getUserByTelegramId(from.id.toString());
      if (!user) return;

      const roi = (((user.balance - CONFIG.STARTING_BALANCE) / CONFIG.STARTING_BALANCE) * 100).toFixed(2);
      const messageText = 
        `⚔️ <b>CryptoArena — Виртуальная Биржа</b>\n\n` +
        `💰 <b>Баланс:</b> $${user.balance.toFixed(2)}\n` +
        `📊 <b>ROI:</b> ${Number(roi) >= 0 ? '+' : ''}${roi}%\n\n` +
        `⚡ <i>Торгуйте с изолированной маржой до x100, ловите Pump и переживите Black Monday!</i>`;

      await ctx.editMessageText(messageText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 ОТКРЫТЬ БИРЖУ', CONFIG.APP_URL)],
          [
            Markup.button.callback('💼 ПОРТФЕЛЬ', 'btn_portfolio'),
            Markup.button.callback('🏆 РЕЙТИНГ', 'btn_leaderboard')
          ]
        ])
      });
      await ctx.answerCbQuery();
    } catch (e) {
      console.error(e);
    }
  });

  // --- Hook Engine Notification Events ---
  orderEngine.on('limit_filled', async ({ order, position, execPrice }) => {
    const user = await db.getUser(order.user_id);
    if (user && user.telegram_id) {
      const sideText = order.side === 'LONG' ? '🟢 BUY' : '🔴 SELL';
      const msg = 
        `⚡ <b>LIMIT ORDER FILLED!</b>\n\n` +
        `Пара: <b>${order.symbol}</b>\n` +
        `Тип: ${sideText}\n` +
        `Цена исполнения: <b>$${execPrice}</b>\n` +
        `Размер: $${order.size.toFixed(2)} (x${order.leverage})\n` +
        `Маржа: $${order.margin.toFixed(2)}`;
      await notifier.notifyUser(user.telegram_id, msg, `order_${order.id}_filled`);
    }
  });

  orderEngine.on('position_closed', async ({ position, trade, reason }) => {
    const user = await db.getUser(position.user_id);
    if (!user || !user.telegram_id) return;

    if (reason === 'STOP_LOSS') {
      const msg = 
        `🛑 <b>STOP-LOSS TRIGGERED</b>\n\n` +
        `Пара: <b>${position.symbol}</b>\n` +
        `Цена выхода: <b>$${trade.exit_price}</b>\n` +
        `PnL: <b style="color:red;">-$${Math.abs(trade.pnl).toFixed(2)}</b> (${trade.roi}%)`;
      await notifier.notifyUser(user.telegram_id, msg, `pos_${position.id}_sl`);
    } else if (reason === 'TAKE_PROFIT') {
      const msg = 
        `🎯 <b>TAKE-PROFIT TRIGGERED!</b>\n\n` +
        `Пара: <b>${position.symbol}</b>\n` +
        `Цена выхода: <b>$${trade.exit_price}</b>\n` +
        `Прибыль: <b>+$${trade.pnl.toFixed(2)}</b> (+${trade.roi}%)`;
      await notifier.notifyUser(user.telegram_id, msg, `pos_${position.id}_tp`);
    } else if (reason === 'LIQUIDATION') {
      const msg = 
        `💀 <b>POSITION LIQUIDATED!</b>\n\n` +
        `Пара: <b>${position.symbol}</b> (${position.side})\n` +
        `Цена ликвидации: <b>$${trade.exit_price}</b>\n` +
        `Убыток изолированной маржи: -$${position.margin.toFixed(2)}\n\n` +
        `<i>Свободный баланс защищён от дальнейших убытков.</i>`;
      await notifier.notifyUser(user.telegram_id, msg, `pos_${position.id}_liq`);
    }
  });

  orderEngine.on('liquidation_warning', async ({ position, currentPrice }) => {
    const user = await db.getUser(position.user_id);
    if (!user || !user.telegram_id) return;
    const msg = 
      `⚠️ <b>LIQUIDATION WARNING!</b>\n\n` +
      `Пара: <b>${position.symbol}</b> (${position.side})\n` +
      `Текущая цена ($${currentPrice}) опасно близка к цене ликвидации ($${position.liquidation_price})!\n` +
      `Рекомендуем сократить позицию или установить защитный Stop-Loss.`;
    await notifier.notifyUser(user.telegram_id, msg, `liq_warn_${position.id}`);
  });

  eventsEngine.on('event_started', async ({ event, news }) => {
    const alertMsg = 
      `🚨 <b>РЫНОЧНОЕ СОБЫТИЕ: ${event.type}!</b>\n\n` +
      `<b>${news.title}</b>\n` +
      `${news.description}\n\n` +
      `⚡ Проверьте свои позиции в терминале CryptoArena!`;
    await notifier.broadcast(alertMsg, `event_${event.id}`);
  });

  return bot;
}
