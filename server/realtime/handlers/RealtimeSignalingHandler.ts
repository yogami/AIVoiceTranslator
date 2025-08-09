import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';
import { RealtimeSessionRegistry } from '../session/RealtimeSessionRegistry';

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
  registry: RealtimeSessionRegistry
): void {
  const ensureSession = (ctx: any, msg: any): string | null => {
    return (msg?.sessionId as string) || ctx.sessionId || registry.get(ctx.connectionId)?.sessionId || null;
  };

  service.registerHandler('webrtc_offer', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId) return;
    const sender = service.getMessageSender();
    await sender.broadcastToSession(sessionId, { type: 'webrtc_offer', sdp: message?.sdp, from: ctx.connectionId });
  });

  service.registerHandler('webrtc_answer', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId) return;
    const sender = service.getMessageSender();
    await sender.broadcastToSession(sessionId, { type: 'webrtc_answer', sdp: message?.sdp, from: ctx.connectionId });
  });

  service.registerHandler('webrtc_ice_candidate', async (ctx, message: any) => {
    const sessionId = ensureSession(ctx, message);
    if (!sessionId) return;
    const sender = service.getMessageSender();
    await sender.broadcastToSession(sessionId, { type: 'webrtc_ice_candidate', candidate: message?.candidate, from: ctx.connectionId });
  });
}


