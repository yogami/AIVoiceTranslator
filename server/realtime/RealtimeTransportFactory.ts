import type { Server as HttpServer } from 'http';
import type { IStorage } from '../storage.interface';
import type { IRealtimeTransport } from './IRealtimeTransport';
import { WebSocketTransportAdapter } from './WebSocketTransportAdapter';

export function createRealtimeTransport(server: HttpServer, storage: IStorage): IRealtimeTransport {
  const transport = (process.env.REALTIME_TRANSPORT || 'websocket').toLowerCase();
  switch (transport) {
    case 'webrtc':
      // Placeholder: will be implemented in a follow-up
      // For now, fall back to WebSocket with a console notice
      console.warn('[RealtimeTransport] WebRTC transport not yet implemented; falling back to WebSocket');
      return new WebSocketTransportAdapter(server, storage);
    case 'websocket':
    default:
      return new WebSocketTransportAdapter(server, storage);
  }
}


