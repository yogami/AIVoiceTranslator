/**
 * SimulateViolationHandler
 *
 * WebSocket message handler that simulates a governance policy violation.
 * Only teachers may trigger this action. The handler:
 * 1. Generates a mock unsafe_content violation via PolicyViolationSimulator
 * 2. Passes it through AgentVerify.evaluateAction() which returns FAILED
 * 3. Broadcasts the FAILED audit receipt to ALL connections in the session
 * 4. Sends a governance_blocked message to student connections
 */

import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import { PolicyViolationSimulator } from '../../../domain/governance/PolicyViolationSimulator';
import { AgentVerify } from '../../../domain/governance/AgentVerify';
import type { WebSocketClient } from './ConnectionManager';

interface SimulateViolationMessage {
  type: 'simulate_violation';
  sessionId?: string;
}

export class SimulateViolationHandler implements IMessageHandler<SimulateViolationMessage> {
  getMessageType(): string {
    return 'simulate_violation';
  }

  async handle(message: SimulateViolationMessage, context: MessageHandlerContext): Promise<void> {
    const { ws, connectionManager } = context;

    // Only allow teachers to simulate violations
    const senderRole = connectionManager.getRole(ws);
    if (senderRole !== 'teacher') {
      console.log(`[SimulateViolationHandler] Rejected: sender role is '${senderRole}', only 'teacher' allowed`);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Only teachers can simulate governance violations.',
          code: 'UNAUTHORIZED_ROLE'
        }));
      } catch {}
      return;
    }

    const sessionId = connectionManager.getSessionId(ws);
    if (!sessionId) {
      console.log('[SimulateViolationHandler] Rejected: no session ID found for sender');
      return;
    }

    console.log(`[SimulateViolationHandler] Teacher in session ${sessionId} triggered violation simulation`);

    // Step 1: Generate the mock violation
    const violation = PolicyViolationSimulator.generateViolation();
    console.log(`[SimulateViolationHandler] Generated violation: type=${violation.type}, severity=${violation.payload.severity}`);

    // Step 2: Pass through AgentVerify — should return FAILED
    const failedReceipt = AgentVerify.evaluateAction(violation);
    console.log(`[SimulateViolationHandler] AgentVerify result: status=${failedReceipt.status}, hash=${failedReceipt.hash.substring(0, 12)}…`);

    // Step 3: Broadcast the FAILED audit receipt to ALL connections in this session
    const connections = connectionManager.getConnections();
    const auditMessage = JSON.stringify({
      type: 'audit_receipt',
      receipt: failedReceipt
    });

    const governanceBlockedMessage = JSON.stringify({
      type: 'governance_blocked',
      blockedAction: 'unsafe_content',
      reason: 'Content safety violation detected by AgentVerify',
      auditReceipt: failedReceipt
    });

    let broadcastCount = 0;
    let studentBlockedCount = 0;

    connections.forEach((client: WebSocketClient) => {
      const clientSessionId = connectionManager.getSessionId(client);
      if (clientSessionId !== sessionId) return;

      try {
        // Send audit receipt to everyone in the session (teachers, students, observers)
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(auditMessage);
          broadcastCount++;

          // Step 4: Also send governance_blocked to students
          const clientRole = connectionManager.getRole(client);
          if (clientRole === 'student') {
            client.send(governanceBlockedMessage);
            studentBlockedCount++;
          }
        }
      } catch (err) {
        console.error('[SimulateViolationHandler] Failed to send to client:', err);
      }
    });

    console.log(`[SimulateViolationHandler] Broadcast complete: ${broadcastCount} audit receipts, ${studentBlockedCount} governance_blocked messages`);
  }
}
