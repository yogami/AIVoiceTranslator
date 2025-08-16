import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import { FeatureFlags } from '../../../application/services/config/FeatureFlags';
import { ACEOrchestrator } from '../../../application/services/ace/ACEOrchestrator';

interface ComprehensionSignalMessageToServer {
  type: 'comprehension_signal';
  level?: 'confused' | 'following' | 'lost';
}

export class ComprehensionSignalMessageHandler implements IMessageHandler<ComprehensionSignalMessageToServer> {
  getMessageType(): string {
    return 'comprehension_signal';
  }
  async handle(message: ComprehensionSignalMessageToServer, context: MessageHandlerContext): Promise<void> {
    if (!FeatureFlags.LIVE_COMPREHENSION_INDICATORS && !FeatureFlags.ACE) return;
    const senderRole = context.connectionManager.getRole(context.ws);
    if (senderRole !== 'student') return;
    const sessionId = context.connectionManager.getSessionId(context.ws);
    if (!sessionId) return;

    // Always forward the raw comprehension_signal to teachers in the same session
    try {
      const connections = context.connectionManager.getConnections();
      connections.forEach((client: any) => {
        const role = context.connectionManager.getRole(client);
        const clientSessionId = context.connectionManager.getSessionId(client);
        if (role === 'teacher' && clientSessionId === sessionId) {
          try {
            client.send(JSON.stringify({ type: 'comprehension_signal', signal: (message as any).signal || (message as any).level || 'ok' }));
          } catch {}
        }
      });
    } catch {}

    // Record signal for ACE slow-repeat window
    try {
      const ace = new ACEOrchestrator();
      ace.recordComprehensionSignal(sessionId, (message as any).signal || (message as any).level || '');
      const studentCount = context.connectionManager.getStudentCount();
      const trigger = ace.shouldTriggerSlowRepeat(sessionId, Date.now(), studentCount);
      if (trigger) {
        // Notify teacher with a concise hint
        const connections = context.connectionManager.getConnections();
        connections.forEach((client: any) => {
          const role = context.connectionManager.getRole(client);
          const clientSessionId = context.connectionManager.getSessionId(client);
          if (role === 'teacher' && clientSessionId === sessionId) {
            try {
              client.send(JSON.stringify({ type: 'ace_hint', message: 'Try slower pace and shorter phrases', level: 'suggestion', timestamp: Date.now() }));
            } catch {}
          }
        });
      }
    } catch {}
  }
}

