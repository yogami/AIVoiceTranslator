import type { Server as HttpServer } from 'http';
import type { IStorage } from '../storage.interface';
import type { IRealtimeTransport } from './IRealtimeTransport';
import { WebSocketTransportAdapter } from './WebSocketTransportAdapter';
import { withConnectionGuards } from './WebSocketRealtimeAppAdapter';
import { WebRTCTransportAdapter } from './WebRTCTransportAdapter';

export function createRealtimeTransport(server: HttpServer, storage: IStorage): IRealtimeTransport {
  const transport = (
    process.env.REALTIME_TRANSPORT ||
    process.env.COMMUNICATION_PROTOCOL ||
    'websocket'
  ).toLowerCase();
  switch (transport) {
    case 'webrtc':
      if (process.env.REALTIME_WEBRTC_ALLOW_EXPERIMENT === '1') {
        console.warn('[RealtimeTransport] Using experimental WebRTC transport');
        return new WebRTCTransportAdapter();
      }
      console.warn('[RealtimeTransport] WebRTC transport not enabled; falling back to WebSocket');
      return new WebSocketTransportAdapter(server, storage);
    case 'websocket':
    default: {
      const adapter = new WebSocketTransportAdapter(server, storage) as any;
      try {
        const legacy = adapter.legacy?.getWebSocketServer?.();
        if (legacy && typeof legacy.on === 'function') {
          withConnectionGuards(legacy);
        }
      } catch {}
      return adapter;
    }
  }
}


