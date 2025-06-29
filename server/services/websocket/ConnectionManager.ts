/**
 * ConnectionManager - Manages WebSocket client connections and their metadata
 * 
 * Responsibilities:
 * - Track active connections
 * - Store client metadata (roles, languages, session IDs, settings)
 * - Provide connection queries and stats
 * 
 * This class follows the Single Responsibility Principle by focusing only on connection management.
 */

import { WebSocket } from 'ws';
import { ClientSettings } from '../WebSocketTypes';

// Custom WebSocketClient type for our server
export type WebSocketClient = WebSocket & {
  isAlive: boolean;
  sessionId: string;
  on: (event: string, listener: (...args: any[]) => void) => WebSocketClient;
  terminate: () => void;
  ping: () => void;
}

export class ConnectionManager {
  private connections: Set<WebSocketClient> = new Set();
  private roles: Map<WebSocketClient, string> = new Map();
  private languages: Map<WebSocketClient, string> = new Map();
  private sessionIds: Map<WebSocketClient, string> = new Map();
  private clientSettings: Map<WebSocketClient, ClientSettings> = new Map();
  // Track whether a student connection has been counted in session stats
  private studentCounted: Map<WebSocketClient, boolean> = new Map();

  /**
   * Add a new connection with its session ID
   */
  addConnection(ws: WebSocketClient, sessionId: string): void {
    this.connections.add(ws);
    this.sessionIds.set(ws, sessionId);
    ws.sessionId = sessionId; // Also set on the WebSocket object for convenience
  }

  /**
   * Remove a connection and all its associated metadata
   */
  removeConnection(ws: WebSocketClient): void {
    this.connections.delete(ws);
    this.roles.delete(ws);
    this.languages.delete(ws);
    this.sessionIds.delete(ws);
    this.clientSettings.delete(ws);
    this.studentCounted.delete(ws);
  }

  /**
   * Set the role for a connection
   */
  setRole(ws: WebSocketClient, role: string): void {
    this.roles.set(ws, role);
  }

  /**
   * Set the language for a connection
   */
  setLanguage(ws: WebSocketClient, language: string): void {
    this.languages.set(ws, language);
  }

  /**
   * Set client settings for a connection
   */
  setClientSettings(ws: WebSocketClient, settings: ClientSettings): void {
    this.clientSettings.set(ws, settings);
  }

  /**
   * Get all active connections
   */
  getConnections(): Set<WebSocketClient> {
    return new Set(this.connections); // Return a copy for safety
  }

  /**
   * Get role for a specific connection
   */
  getRole(ws: WebSocketClient): string | undefined {
    return this.roles.get(ws);
  }

  /**
   * Get language for a specific connection
   */
  getLanguage(ws: WebSocketClient): string | undefined {
    return this.languages.get(ws);
  }

  /**
   * Get session ID for a specific connection
   */
  getSessionId(ws: WebSocketClient): string | undefined {
    return this.sessionIds.get(ws);
  }

  /**
   * Get client settings for a specific connection
   */
  getClientSettings(ws: WebSocketClient): ClientSettings | undefined {
    return this.clientSettings.get(ws);
  }

  /**
   * Get total number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get number of students (connections with role 'student')
   */
  getStudentCount(): number {
    return Array.from(this.roles.values()).filter(role => role === 'student').length;
  }

  /**
   * Get number of teachers (connections with role 'teacher')  
   */
  getTeacherCount(): number {
    return Array.from(this.roles.values()).filter(role => role === 'teacher').length;
  }

  /**
   * Get all student connections and their languages
   * Used for broadcasting translations
   */
  getStudentConnectionsAndLanguages(): { 
    connections: WebSocketClient[]; 
    languages: string[] 
  } {
    const studentConnections: WebSocketClient[] = [];
    const studentLanguages: string[] = [];

    for (const [connection, role] of this.roles.entries()) {
      if (role === 'student') {
        studentConnections.push(connection);
        const language = this.languages.get(connection) || 'en';
        studentLanguages.push(language);
      }
    }

    return { 
      connections: studentConnections, 
      languages: studentLanguages 
    };
  }

  /**
   * Check if any connections exist
   */
  hasConnections(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get all unique session IDs from active connections
   */
  getActiveSessionIds(): string[] {
    return Array.from(new Set(this.sessionIds.values()));
  }

  /**
   * Clear all connections and associated metadata (for shutdown)
   */
  clearAll(): void {
    this.connections.clear();
    this.roles.clear();
    this.languages.clear();
    this.sessionIds.clear();
    this.clientSettings.clear();
    this.studentCounted.clear();
  }

  /**
   * Update the session ID for an existing connection without affecting other metadata
   */
  updateSessionId(ws: WebSocketClient, sessionId: string): void {
    // Set the session ID regardless of whether the connection is tracked yet
    // This allows for more flexible setup order in tests
    this.sessionIds.set(ws, sessionId);
  }

  /**
   * Remove only the session ID for a connection, keeping other metadata
   */
  removeSessionId(ws: WebSocketClient): void {
    this.sessionIds.delete(ws);
  }

  /**
   * Check if a student connection has already been counted in session stats
   */
  isStudentCounted(ws: WebSocketClient): boolean {
    return this.studentCounted.get(ws) || false;
  }

  /**
   * Mark a student connection as counted in session stats
   */
  setStudentCounted(ws: WebSocketClient, counted: boolean): void {
    this.studentCounted.set(ws, counted);
  }
}
