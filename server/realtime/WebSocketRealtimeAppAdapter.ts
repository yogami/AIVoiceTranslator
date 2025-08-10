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


