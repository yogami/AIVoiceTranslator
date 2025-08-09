import type { IRealtimeTransport } from './IRealtimeTransport';
import { RealTimeCommunicationService } from './RealTimeCommunicationService';
import { registerPingHandler } from './handlers/PingHandler';
import { registerErrorHandler } from './handlers/ErrorHandler';
import { registerRegisterHandler } from './handlers/RegisterHandler';
import { registerRealtimeAudioHandler, type RealtimeAudioDependencies } from './handlers/RealtimeAudioHandler';
import { registerRealtimeTTSHandler, type RealtimeTTSDependencies } from './handlers/RealtimeTTSHandler';
import { RealtimeSessionRegistry } from './session/RealtimeSessionRegistry';
import { registerRealtimeSessionHandlers } from './handlers/RealtimeSessionHandlers';
import { registerRealtimeTranslationHandler, type RealtimeTranslationDependencies } from './handlers/RealtimeTranslationHandler';
import { registerRealtimeSignalingHandler } from './handlers/RealtimeSignalingHandler';
import { InMemorySignalingStore } from './signaling/InMemorySignalingStore';

/**
 * RealtimeApp wires a protocol-agnostic dispatcher onto the chosen transport,
 * and registers a baseline set of handlers. This is feature-flagged at server
 * startup to avoid impacting current flows until fully ready.
 */
export interface RealtimeAppOptions {
  audioDeps?: RealtimeAudioDependencies;
  ttsDeps?: RealtimeTTSDependencies;
  translationDeps?: RealtimeTranslationDependencies;
}

export class RealtimeApp {
  private readonly transport: IRealtimeTransport;
  private readonly svc: RealTimeCommunicationService;
  private readonly options?: RealtimeAppOptions;
  private readonly sessionRegistry = new RealtimeSessionRegistry();
  private readonly signalingStore = new InMemorySignalingStore();

  constructor(transport: IRealtimeTransport, options?: RealtimeAppOptions) {
    this.transport = transport;
    this.svc = new RealTimeCommunicationService(transport);
    this.options = options;
  }

  start(): void {
    // Register baseline handlers
    registerErrorHandler(this.svc);
    registerPingHandler(this.svc);
    registerRegisterHandler(this.svc);
    registerRealtimeSessionHandlers(this.svc, this.sessionRegistry);
    // Signaling relay for future WebRTC transport (safe no-op for WS clients)
    registerRealtimeSignalingHandler(this.svc, this.sessionRegistry, this.signalingStore);
    if (this.options?.audioDeps) {
      registerRealtimeAudioHandler(this.svc, this.options.audioDeps);
    }
    if (this.options?.ttsDeps) {
      registerRealtimeTTSHandler(this.svc, this.options.ttsDeps);
    }
    if (this.options?.translationDeps) {
      registerRealtimeTranslationHandler(this.svc, this.options.translationDeps, this.sessionRegistry);
    }
    // TODO: add register/audio/tts handlers when ready
    this.svc.start();
  }

  stop(): void {
    this.svc.stop();
  }
}



