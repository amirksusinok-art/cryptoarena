# ⚔️ CryptoArena — Telegram Mini App (Crypto Exchange Simulator)

> **CryptoArena** — высокопроизводительный симулятор криптовалютной биржи внутри Telegram Mini App с серверным ценовым движком, изолированной маржой до x100, интерактивными графиками TradingView, рыночными событиями (*Pump*, *Dump*, *Market Panic*, *Black Monday*), турнирами *Trading Battles* и уведомлениями в Telegram.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-emerald)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![React](https://img.shields.io/badge/React-18-cyan)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📖 Содержание
- [1. Концепция и ключевые особенности](#1-концепция-и-ключевые-особенности)
- [2. Архитектура и стек технологий](#2-архитектура-и-стек-технологий)
- [3. Экономика и торговый движок](#3-экономика-и-торговый-движок)
  - [Изолированная маржа (Isolated Margin)](#изолированная-маржа-isolated-margin)
  - [Ликвидация и Maintenance Margin](#ликвидация-и-maintenance-margin)
  - [Комиссии и ордера](#комиссии-и-ордера)
- [4. События рынка (Market Events)](#4-события-рынка-market-events)
- [5. Trading Battles и Рейтинг](#5-trading-battles-и-рейтинг)
- [6. Локальный запуск (Local Development)](#6-локальный-запуск-local-development)
- [7. Настройка Telegram Бота (@BotFather)](#7-настройка-telegram-бота-botfather)
- [8. Публикация на GitHub и Деплой на Render](#8-публикация-на-github-и-деплой-на-render)
- [9. Панель администратора](#9-панель-администратора)

---

## 1. Концепция и ключевые особенности

Каждый игрок начинает с виртуальным депозитом **\$10 000** и торгует в изолированной серверной симуляции:
- **Server-Authoritative виртуальный рынок**: Сервер — единственный источник истины для цен исполнения, PnL, свечей и ликвидаций. Клиент не может подделать баланс или цену.
- **TradingView Lightweight Charts**: Интерактивные свечные и линейные графики (1m, 5m, 15m, 1h, 4h, 1d) со встроенным отображением линий входа, Stop-Loss и Take-Profit прямо на графике.
- **Полноэкранный режим графиков (Fullscreen Chart)** для мобильного трейдинга.
- **Стакан котировок (Order Book)** в реальном времени.
- **Telegram Haptic Feedback** на поддерживаемых мобильных устройствах.
- **Встроенный режим Dev Mock** для удобного тестирования прямо в браузере ПК без обязательного открытия Telegram.

---

## 2. Архитектура и стек технологий

```
nuts/
├── server/                    # Node.js + Express + WebSockets + Telegraf
│   ├── engine/
│   │   ├── priceEngine.ts     # Авторитетный генератор цен, тиков и свечей (GBM)
│   │   ├── eventsEngine.ts    # Движок Pump, Dump, Market Panic, Black Monday
│   │   ├── orderEngine.ts     # Исполнение ордеров, маржа, лимиты, стопы, ликвидации
│   │   └── battleEngine.ts    # Движок соревнований Trading Battles
│   ├── db/                    # Унифицированный слой базы данных (PostgreSQL + SQLite/JSON)
│   ├── bot/                   # Telegram бот (/start, WebApp кнопки, очередь уведомлений)
│   ├── routes/                # REST API (auth, trade, market, portfolio, social, admin)
│   └── ws/                    # WebSocket сервер трансляции котировок и стакана
├── client/                    # React 18 + Vite + Tailwind CSS SPA
│   ├── src/
│   │   ├── components/trade/  # Терминал, графики TradingView, стакан, форма ордеров
│   │   ├── components/markets/# Список монет, Top Gainers, Top Losers, Избранное
│   │   ├── components/news/   # Лента новостей и баннеры событий
│   │   ├── components/portfolio/ # Капитал, история сделок, кривая роста депозита
│   │   ├── components/profile/# Статистика трейдера, Battles, Топ, You vs Friend
│   │   └── components/admin/  # Панель вызова Pump/Dump/Black Monday в 1 клик
│   └── ...
├── Dockerfile                 # Многоэтапный Docker-образ для любого облака
├── docker-compose.yml         # Локальный запуск с PostgreSQL
└── render.yaml                # Render Blueprint (Web Service + PostgreSQL)
```

---

## 3. Экономика и торговый движок

### Изолированная маржа (Isolated Margin)
Каждая позиция изолирована от остального баланса:
$$\text{Margin} = \frac{\text{Position Size}}{\text{Leverage}}$$
- Если позиция закрывается по ликвидации, убыток строго ограничен маржой этой позиции.
- Свободный баланс и средства других позиций **никогда не списываются**.
- Общий баланс пользователя физически не может стать отрицательным.

### Ликвидация и Maintenance Margin
Ликвидация происходит, когда капитал позиции опускается ниже Maintenance Margin (1%) + комиссия закрытия:
- **Для LONG**:
  $$\text{LiqPrice} = \text{EntryPrice} \times \left(1 - \frac{1}{\text{Leverage}} + \text{MaintenanceRate} + \text{FeeRate}\right)$$
- **Для SHORT**:
  $$\text{LiqPrice} = \text{EntryPrice} \times \left(1 + \frac{1}{\text{Leverage}} - \text{MaintenanceRate} - \text{FeeRate}\right)$$

### Комиссии и ордера
- **Комиссия**: 0.10% от полного номинального объема позиции (Notional Value) на входе и выходе.
- **Limit Orders**: Резервируют необходимую маржу + максимальную комиссию на входе.
- **Защита от гэпов**: Buy Limit исполняется по установленной цене или ниже (выгоднее для покупателя); Sell Limit — по установленной цене или выше.

---

## 4. События рынка (Market Events)

1. **🚀 Pump**: Временный аномальный взлёт выбранного актива (например, TON +20%).
2. **🔻 Dump**: Стремительное падение выбранного актива с повышенным риском ликвидаций.
3. **🚨 Market Panic**: Резкий всплеск волатильности по всем инструментам одновременно.
4. **💀 Black Monday**: Крупнейший крах сезона с фазами:
   - `WARNING`: Предупреждения об аномалиях в ленте новостей.
   - `CRASH`: Массовый синхронный обвал всех активов (BTC -24%, ETH -29%, TON -34%).
   - `PANIC`: Пик ликвидаций и волатильности.
   - `RECOVERY`: Стабилизация и выкуп дна.

---

## 5. Trading Battles и Рейтинг

- **Trading Battles**: Отдельные временные соревнования (10-30 минут).
- Каждый участник получает изолированный субсчет **\$10 000**, который никак не связан с основным портфелем.
- В конце битвы фиксируется финальный ROI и раздаются ранги.
- **You vs Friend**: Возможность сравнить статистику любого друга (Винрейт, ROI, количество сделок, позиция в топе) в виде карточки дуэли.

---

## 6. Локальный запуск (Local Development)

### Требования
- Node.js 20+
- npm 10+

### Шаги установки

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/your-username/cryptoarena.git
   cd cryptoarena
   ```

2. Установите зависимости:
   ```bash
   npm run install:all
   ```

3. Создайте файл `.env` (скопируйте из `.env.example`):
   ```bash
   cp .env.example .env
   ```
   *(По умолчанию база данных будет использовать встроенный быстрый локальный файл `data/cryptoarena_store.json`, поэтому настраивать PostgreSQL локально не обязательно!)*

4. Запустите в режиме разработки:
   ```bash
   npm run dev
   ```
   - Фронтенд (Vite): [http://localhost:5173](http://localhost:5173)
   - Бэкенд API и WebSockets: [http://localhost:3000](http://localhost:3000)

---

## 7. Настройка Telegram Бота (@BotFather)

1. Откройте в Telegram [@BotFather](https://t.me/botfather).
2. Создайте нового бота командой `/newbot`, укажите имя и username.
3. Скопируйте полученный **HTTP API Token** и вставьте в `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRstuVWXyz
   ```
4. Включите Web App в [@BotFather](https://t.me/botfather):
   - Отправьте команду `/newapp`.
   - Выберите вашего бота.
   - Укажите название: `CryptoArena`.
   - Введите описание.
   - Загрузите иконку (640x360).
   - В поле **Web App URL** укажите URL вашего приложения (например, `https://cryptoarena-xxxx.onrender.com` после деплоя, или ngrok при локальных тестах).
   - Укажите короткое имя приложения (short name).
5. Настройте кнопку меню бота:
   - В меню бота выполните `/setmenubutton`.
   - Укажите URL приложения.

---

## 8. Публикация на GitHub и Деплой на Render

### 1. Отправка на GitHub
```bash
git init
git add .
git commit -m "feat: initial commit CryptoArena Telegram Mini App"
git branch -M main
git remote add origin https://github.com/your-username/cryptoarena.git
git push -u origin main
```

### 2. Деплой на Render через Blueprint (1-Click)
Проект содержит готовый файл `render.yaml`!

1. Зарегистрируйтесь на [Render.com](https://render.com).
2. Перейдите в **Blueprints** → **New Blueprint Instance**.
3. Подключите ваш GitHub репозиторий `cryptoarena`.
4. Render автоматически создаст:
   - **Web Service** (Node.js) со сборкой `npm run install:all && npm run build` и стартом `npm start`.
   - **PostgreSQL Database** (`cryptoarena-db`).
5. В переменных окружения Web Service добавьте:
   - `TELEGRAM_BOT_TOKEN` — ваш токен бота.
   - `ADMIN_TELEGRAM_IDS` — ваш Telegram ID (чтобы открыть админку в боте).
6. Нажмите **Apply**.
7. После успешного деплоя скопируйте выданный Render адрес (например `https://cryptoarena.onrender.com`) и укажите его в @BotFather!

---

## 9. Панель администратора

Панель администратора доступна:
1. В браузере по кнопке щита в правом верхнем углу интерфейса (или по вызову `x-admin-key`).
2. Ключ администратора по умолчанию:
   ```env
   ADMIN_SECRET_KEY=admin_secret_super_key_2026
   ```
3. Возможности:
   - Запуск **PUMP** на любой паре с регулировкой времени и силы.
   - Запуск **DUMP**.
   - Активация **MARKET PANIC**.
   - Активация **BLACK MONDAY**.
   - Создание турниров **Trading Battles**.
   - Добавление новых торговых пар (например, `SOL/USDT`).

---

## Лицензия
MIT License. Создано для Telegram Mini Apps Ecosystem.
