import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';
import { RealtimeSessionRegistry } from '../session/RealtimeSessionRegistry';
import { InMemorySignalingStore } from '../signaling/InMemorySignalingStore';
import type { PeerManager } from '../webrtc/PeerManager';

/**
 * RealtimeSignalingHandler (protocol-agnostic)
 * MVP signaling relay for WebRTC offers/answers/ICE via the realtime transport.
 * - Teacher sends: { type: 'webrtc_offer', sessionId, sdp }
 *   → broadcast to session
 * - Student sends: { type: 'webrtc_answer', sessionId, sdp }
 *   → broadcast to session
 * - Either sends ICE: { type: 'webrtc_ice_candidate', sessionId, candidate }
 *   → broadcast to session
 *
 * This handler intentionally relies on broadcast-to-session to avoid needing
 * direct connection indexing here. Role filtering can be added later.
 */
export function registerRealtimeSignalingHandler(
  service: RealTimeCommunicationService,
  registry: RealtimeSessionRegistry,
  store?: InMemorySignalingStore,
  peerManager?: PeerManager
): void {
  const ensureSession = (ctx: any, msg: any): string | null => {
    return (msg?.sessionId as string) || ctx.sessionId || registry.get(ctx.connectionId)?.sessionId || null;
  };

  service.registerHandler('webrtc_offer', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId) return;
    const sender = service.getMessageSender();
    // persist
    store?.setOffer(sessionId, ctx.connectionId, message?.sdp);
    await sender.broadcastToSession(sessionId, { type: 'webrtc_offer', sdp: message?.sdp, from: ctx.connectionId });
    // If experimental PeerManager is available, auto-generate answer
    if (peerManager) {
      try {
        const answer = await peerManager.handleOffer(sessionId, message?.sdp);
        if (answer) {
          await sender.broadcastToSession(sessionId, { type: 'webrtc_answer', sdp: answer, from: 'server' });
        }
      } catch {
        // ignore errors in experimental path
      }
    }
  });

  service.registerHandler('webrtc_answer', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId) return;
    const sender = service.getMessageSender();
    store?.addAnswer(sessionId, ctx.connectionId, message?.sdp);
    await sender.broadcastToSession(sessionId, { type: 'webrtc_answer', sdp: message?.sdp, from: ctx.connectionId });
  });

  service.registerHandler('webrtc_ice_candidate', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId) return;
    const sender = service.getMessageSender();
    store?.addIceCandidate(sessionId, ctx.connectionId, message?.candidate);
    await sender.broadcastToSession(sessionId, { type: 'webrtc_ice_candidate', candidate: message?.candidate, from: ctx.connectionId });
    if (peerManager) {
      try { await peerManager.addRemoteIce(sessionId, message?.candidate); } catch {}
    }
  });

  // Allow a client to request current signaling state for the session
  service.registerHandler('webrtc_sync', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId || !store) return;
    const state = store.get(sessionId) || { answers: [], ice: [] };
    const sender = service.getMessageSender();
    await sender.send(ctx.connectionId, { type: 'webrtc_sync', state });
  });
}


