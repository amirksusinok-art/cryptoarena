import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { db } from '../db/index.js';
import { User } from '../db/types.js';

export const authRouter = Router();

// Validate Telegram Mini App initData according to Telegram specification
function verifyTelegramInitData(initData: string, botToken: string): { isValid: boolean; userData?: any } {
  if (!botToken || !initData) return { isValid: false };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { isValid: false };

    params.delete('hash');

    // Sort parameters alphabetically
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(k => `${k}=${params.get(k)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return { isValid: false };
    }

    const userRaw = params.get('user');
    const userData = userRaw ? JSON.parse(userRaw) : null;
    return { isValid: true, userData };
  } catch (err) {
    return { isValid: false };
  }
}

// POST /api/auth/telegram
authRouter.post('/telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({ error: 'Параметр initData отсутствует' });
      return;
    }

    // If bot token is configured, do strict cryptographic validation
    let telegramId: string;
    let username: string;
    let firstName: string;
    let photoUrl: string | undefined;

    if (CONFIG.TELEGRAM_BOT_TOKEN) {
      const verification = verifyTelegramInitData(initData, CONFIG.TELEGRAM_BOT_TOKEN);
      if (!verification.isValid || !verification.userData) {
        res.status(401).json({ error: 'Неверная подпись Telegram initData' });
        return;
      }
      telegramId = verification.userData.id.toString();
      username = verification.userData.username || `trader_${telegramId.substring(0, 5)}`;
      firstName = verification.userData.first_name || 'Trader';
      photoUrl = verification.userData.photo_url;
    } else {
      // In dev mode when no bot token is set, parse initData safely
      try {
        const params = new URLSearchParams(initData);
        const userRaw = params.get('user');
        const parsed = userRaw ? JSON.parse(userRaw) : { id: 10001, first_name: 'Demo Trader', username: 'demotrader' };
        telegramId = parsed.id.toString();
        username = parsed.username || 'demotrader';
        firstName = parsed.first_name || 'Demo Trader';
        photoUrl = parsed.photo_url;
      } catch {
        telegramId = '10001';
        username = 'demotrader';
        firstName = 'Demo Trader';
      }
    }

    let user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      const isAdmin = CONFIG.ADMIN_TELEGRAM_IDS.includes(telegramId) ? 1 : 0;
      const newUser: User = {
        id: `u_${telegramId}`,
        telegram_id: telegramId,
        username,
        first_name: firstName,
        photo_url: photoUrl,
        balance: CONFIG.STARTING_BALANCE,
        locked_balance: 0,
        is_admin: isAdmin,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      user = await db.createUser(newUser);
      await db.addCapitalPoint(user.id, user.balance);
    } else {
      // Update username or photo if changed
      if (username !== user.username || firstName !== user.first_name) {
        user = (await db.updateUser(user.id, { username, first_name: firstName, photo_url: photoUrl })) || user;
      }
    }

    res.json({
      success: true,
      user,
      token: `sess_${user.id}_${Date.now()}`
    });
  } catch (err: any) {
    console.error('[Auth] Error in /telegram auth:', err);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

// POST /api/auth/dev-mock (For testing in regular browser outside Telegram)
authRouter.post('/dev-mock', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mockId = 'demo_user_1', name = 'Crypto Whale', username = 'crypto_whale' } = req.body;
    const telegramId = `mock_${mockId}`;

    let user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      const newUser: User = {
        id: `u_${mockId}`,
        telegram_id: telegramId,
        username,
        first_name: name,
        photo_url: undefined,
        balance: CONFIG.STARTING_BALANCE,
        locked_balance: 0,
        is_admin: 1, // Dev mock user has admin capabilities for easy testing
        created_at: Date.now(),
        updated_at: Date.now()
      };
      user = await db.createUser(newUser);
      await db.addCapitalPoint(user.id, user.balance);
    }

    res.json({
      success: true,
      user,
      token: `sess_${user.id}_${Date.now()}`,
      isDevMock: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка dev авторизации' });
  }
});
