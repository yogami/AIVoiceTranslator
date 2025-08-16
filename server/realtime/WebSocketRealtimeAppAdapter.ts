import type { IRealtimeTransport } from './IRealtimeTransport';
import { RealtimeApp } from './RealtimeApp';
import { SpeechPipelineOrchestrator } from '../application/services/SpeechPipelineOrchestrator';

/**
 * Thin adapter to run the protocol-agnostic dispatcher on top of the existing
 * WebSocketTransportAdapter in parallel with legacy routing. Behind a feature
 * flag: REALTIME_APP_ENABLED = '1'.
 */
export class WebSocketRealtimeAppAdapter {
  private started = false;
  private app?: RealtimeApp;

  constructor(private readonly transport: IRealtimeTransport) {}

  enableIfFlagged(): void {
    if (this.started) return;
    if (process.env.REALTIME_APP_ENABLED === '1') {
      const orchestrator = SpeechPipelineOrchestrator.createWithDefaultServices();
      this.app = new RealtimeApp(this.transport, {
        audioDeps: {
          transcribeAudio: (buf, lang) => orchestrator.transcribeAudio(buf, lang),
        },
        ttsDeps: {
          synthesize: (text, options) => orchestrator.synthesize(text, { language: options?.language }),
        },
        translationDeps: {
          translate: (text, src, dst) => orchestrator.translateText(text, src, dst),
        },
      });
      this.app.start();
      this.started = true;
    }
  }

  stop(): void {
    if (!this.started) return;
    this.app?.stop();
    this.started = false;
  }
}

// Enforce IP allowlist and beta gate at websocket handshake level via wrapper
export function withConnectionGuards<T extends { on(event: string, handler: (...args: any[]) => void): any }>(
  server: T
): T {
  const allowedIpsRaw = (process.env.ALLOWED_IPS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const betaEnabled = (process.env.BETA_ENABLED || '').toLowerCase();
  const betaToken = process.env.BETA_ACCESS_TOKEN || '';

  const originalOn = (server as any).on.bind(server);
  (server as any).on = (event: string, handler: (...args: any[]) => void) => {
    if (event !== 'connection') return originalOn(event, handler);
    return originalOn('connection', (ws: any, req: any, ...rest: any[]) => {
      if (allowedIpsRaw.length) {
        const xf = (req?.headers?.['x-forwarded-for'] as string) || '';
        const ip = (xf.split(',')[0] || '').trim() || req?.socket?.remoteAddress || '';
        const ok = allowedIpsRaw.some((allowed: string) => {
          if (allowed.endsWith('.*')) {
            const prefix = allowed.slice(0, -1);
            return (ip || '').startsWith(prefix);
          }
          return ip === allowed;
        });
        if (!ok) {
          try { ws.close(1008, 'Access denied: IP not authorized'); } catch {}
          return;
        }
      }
      if (betaEnabled === '1' || betaEnabled === 'true' || betaEnabled === 'yes' || betaEnabled === 'on') {
        if (!betaToken) {
          try { ws.close(1013, 'Service unavailable'); } catch {}
          return;
        }
        const url = new URL(req?.url || '', `http://${req?.headers?.host || 'localhost'}`);
        const provided = req?.headers?.authorization?.toString().replace(/^Bearer\s+/i, '')
          || url.searchParams.get('beta')
          || (req?.headers?.['sec-websocket-protocol'] as string);
        if (provided !== betaToken) {
          try { ws.close(1008, 'Beta access required'); } catch {}
          return;
        }
      }
      handler(ws, req, ...rest);
    });
  };
  return server;
}


