import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { priceEngine, PriceTick, Candle } from '../engine/priceEngine.js';
import { eventsEngine } from '../engine/eventsEngine.js';
import { orderEngine } from '../engine/orderEngine.js';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  activeSymbol?: string;
  isAlive: boolean;
}

export class WebSocketHandler {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      const client: ClientConnection = {
        ws,
        isAlive: true
      };
      this.clients.add(client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(client, data);
        } catch (e) {
          // ignore invalid JSON
        }
      });

      ws.on('close', () => {
        this.clients.delete(client);
      });

      // Send initial snapshot immediately upon connect
      ws.send(JSON.stringify({
        type: 'SNAPSHOT',
        tickers: priceEngine.getAllTickers(),
        events: eventsEngine.getActiveEventsList()
      }));
    });

    // Heartbeat ping every 25 seconds
    setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 25000);

    this.setupEngineSubscriptions();
    console.log('[WS] WebSocket server initialized on path /ws');
  }

  private handleClientMessage(client: ClientConnection, data: any) {
    if (data.type === 'SUBSCRIBE_SYMBOL') {
      client.activeSymbol = data.symbol;
      // Send immediate order book and current ticker for this symbol
      if (data.symbol) {
        const ob = priceEngine.getOrderBook(data.symbol);
        client.ws.send(JSON.stringify({ type: 'ORDERBOOK', data: ob }));
      }
    } else if (data.type === 'AUTH') {
      client.userId = data.userId;
    }
  }

  private setupEngineSubscriptions() {
    // 1. Broadcast price ticks (aggregated with tickers)
    priceEngine.on('tickers', (tickers) => {
      this.broadcast({
        type: 'TICKERS',
        data: tickers
      });
    });

    // 2. Broadcast single candle updates
    priceEngine.on('candle', (candleData) => {
      for (const client of this.clients) {
        if (!client.activeSymbol || client.activeSymbol === candleData.symbol) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'CANDLE_UPDATE',
              data: candleData
            }));
          }
        }
      }
    });

    // 3. Broadcast order book updates periodically (every 1 second)
    setInterval(() => {
      for (const client of this.clients) {
        if (client.activeSymbol && client.ws.readyState === WebSocket.OPEN) {
          const ob = priceEngine.getOrderBook(client.activeSymbol);
          client.ws.send(JSON.stringify({
            type: 'ORDERBOOK',
            data: ob
          }));
        }
      }
    }, 1000);

    // 4. Broadcast market events
    eventsEngine.on('event_started', (payload) => {
      this.broadcast({ type: 'MARKET_EVENT', action: 'STARTED', ...payload });
    });

    eventsEngine.on('event_phase', (payload) => {
      this.broadcast({ type: 'MARKET_EVENT', action: 'PHASE', ...payload });
    });

    eventsEngine.on('event_ended', (payload) => {
      this.broadcast({ type: 'MARKET_EVENT', action: 'ENDED', ...payload });
    });

    // 5. User-specific trading events
    orderEngine.on('position_opened', (pos) => {
      this.sendToUser(pos.user_id, { type: 'POSITION_OPENED', data: pos });
    });

    orderEngine.on('position_closed', ({ position, trade, reason }) => {
      this.sendToUser(position.user_id, { type: 'POSITION_CLOSED', data: { position, trade, reason } });
    });

    orderEngine.on('order_created', (order) => {
      this.sendToUser(order.user_id, { type: 'ORDER_CREATED', data: order });
    });

    orderEngine.on('limit_filled', ({ order, position }) => {
      this.sendToUser(order.user_id, { type: 'ORDER_FILLED', data: { order, position } });
    });

    orderEngine.on('order_cancelled', (order) => {
      this.sendToUser(order.user_id, { type: 'ORDER_CANCELLED', data: order });
    });
  }

  public broadcast(payload: any) {
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  public sendToUser(userId: string, payload: any) {
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }
}

export const wsHandler = new WebSocketHandler();
