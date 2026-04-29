import WebSocket from "ws";
import { createRequire } from "node:module";
import type http from "node:http";
import type { Logger } from "../middleware/logger.middleware.js";

export interface WsHub {
  broadcast(event: string, data: unknown): void;
  getClientCount(): number;
}

export function createWsHub({ server, logger }: { server: http.Server; logger: Logger }): WsHub {
  type WsClient = InstanceType<typeof WebSocket>;

  type WsServer = {
    on(event: string, listener: (...args: unknown[]) => void): WsServer;
  };

  // `ws` has `export = WebSocket` typings, but at runtime the module object
  // also exposes `WebSocketServer`/`WebSocketServer` constructors.
  const wsModule = createRequire(import.meta.url)("ws") as unknown as {
    WebSocketServer: new (opts: { server: http.Server; path?: string }) => WsServer;
  };

  const wss = new wsModule.WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WsClient>();

  wss.on("connection", (socket: unknown) => {
    const s = socket as WsClient;
    clients.add(s);
    logger.info("ws.connected", { clients: clients.size });

    s.on("close", () => {
      clients.delete(s);
      logger.info("ws.disconnected", { clients: clients.size });
    });
  });

  return {
    broadcast(event: string, data: unknown): void {
      const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
      for (const socket of clients) {
        if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      }
    },
    getClientCount(): number {
      return clients.size;
    },
  };
}

