/**
 * Session Metrics Service
 * 
 * Handles calculation of active session metrics for diagnostics and monitoring.
 * Provides aggregated statistics about connections, sessions, and user activity.
 */

import { ConnectionManager, WebSocketClient } from '../websocket/ConnectionManager';
import { ClassroomSessionManager } from './ClassroomSessionManager';

export interface SessionMetrics {
  activeSessions: number;
  studentsConnected: number;
  teachersConnected: number;
  currentLanguages: string[];
}

export class SessionMetricsService {
  constructor(
    private connectionManager: ConnectionManager,
    private classroomSessionManager: ClassroomSessionManager
  ) {}

  /**
   * Calculate active session metrics
   */
  calculateActiveSessionMetrics(): SessionMetrics {
    const activeSessions = new Set<string>();
    let studentsConnected = 0;
    let teachersConnected = 0;
    const currentLanguages = new Set<string>();

    const connections = this.connectionManager.getConnections();

    for (const connection of connections) {
      const sessionId = this.connectionManager.getSessionId(connection);
      const role = this.connectionManager.getRole(connection);
      const language = this.connectionManager.getLanguage(connection);
      
      if (sessionId) {
        // Find classroom code for this session using ClassroomSessionManager
        const classroomCode = this.classroomSessionManager.getClassroomCodeBySessionId(sessionId);
        
        if (classroomCode) {
          activeSessions.add(classroomCode);
        }
      }
      
      if (role === 'student') {
        studentsConnected++;
      } else if (role === 'teacher') {
        teachersConnected++;
        if (language) {
          currentLanguages.add(language);
        }
      }
    }

    return {
      activeSessions: activeSessions.size,
      studentsConnected,
      teachersConnected,
      currentLanguages: Array.from(currentLanguages)
    };
  }
}
