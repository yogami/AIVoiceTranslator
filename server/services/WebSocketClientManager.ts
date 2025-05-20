/**
 * WebSocketClientManager
 * 
 * Manages WebSocket client connections and their associated state
 * - Follows Single Responsibility Principle
 * - Provides a clean API for client state management
 * - Encapsulates all client tracking logic in one place
 */

import { WebSocket } from 'ws';

// Enhanced client type with our custom properties
export interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  sessionId?: string;
}

// Unified client state model
export interface WebSocketClientState {
  connection: WebSocketClient;
  role?: string;
  language?: string;
  sessionId: string;
  settings: {
    ttsServiceType?: string;
    [key: string]: any;
  };
  isAlive: boolean;
  connectedAt: number;
}

export class WebSocketClientManager {
  // Single source of truth for client state
  private clients: Map<WebSocketClient, WebSocketClientState> = new Map();
  private sessionCounter: number = 0;
  
  /**
   * Register a new client connection
   */
  public registerClient(ws: WebSocketClient, role?: string, language?: string): string {
    // Generate a unique session ID
    const sessionId = `session_${Date.now()}_${this.sessionCounter++}`;
    
    // Initialize client state
    const clientState: WebSocketClientState = {
      connection: ws,
      role,
      language,
      sessionId,
      settings: {},
      isAlive: true,
      connectedAt: Date.now()
    };
    
    // Store client state
    this.clients.set(ws, clientState);
    
    // Also set the session ID on the WebSocket object for convenience
    ws.sessionId = sessionId;
    
    // Return session ID
    return sessionId;
  }
  
  /**
   * Remove a client connection
   */
  public removeClient(ws: WebSocketClient): boolean {
    return this.clients.delete(ws);
  }
  
  /**
   * Get client state by WebSocket connection
   */
  public getClientState(ws: WebSocketClient): WebSocketClientState | undefined {
    return this.clients.get(ws);
  }
  
  /**
   * Get client state by session ID
   */
  public getClientStateBySessionId(sessionId: string): WebSocketClientState | undefined {
    // Use Array.from to convert iterator to array to avoid downlevelIteration issues
    const clientStates = Array.from(this.clients.values());
    
    for (const state of clientStates) {
      if (state.sessionId === sessionId) {
        return state;
      }
    }
    return undefined;
  }
  
  /**
   * Update client role
   */
  public updateClientRole(ws: WebSocketClient, role: string): boolean {
    const state = this.clients.get(ws);
    if (!state) return false;
    
    state.role = role;
    return true;
  }
  
  /**
   * Update client language
   */
  public updateClientLanguage(ws: WebSocketClient, language: string): boolean {
    const state = this.clients.get(ws);
    if (!state) return false;
    
    state.language = language;
    return true;
  }
  
  /**
   * Update client settings
   */
  public updateClientSettings(ws: WebSocketClient, settings: Record<string, any>): boolean {
    const state = this.clients.get(ws);
    if (!state) return false;
    
    state.settings = { ...state.settings, ...settings };
    return true;
  }
  
  /**
   * Mark client as alive (for heartbeat)
   */
  public setClientAlive(ws: WebSocketClient, isAlive: boolean): boolean {
    const state = this.clients.get(ws);
    if (!state) return false;
    
    state.isAlive = isAlive;
    return true;
  }
  
  /**
   * Get all clients
   */
  public getAllClients(): WebSocketClientState[] {
    // Use Array.from to convert Map.values() iterator to an array
    // This prevents TypeScript downlevelIteration errors
    return Array.from(this.clients.values());
  }
  
  /**
   * Get clients by role
   */
  public getClientsByRole(role: string): WebSocketClientState[] {
    return this.getAllClients().filter(client => client.role === role);
  }
  
  /**
   * Get clients by language
   */
  public getClientsByLanguage(language: string): WebSocketClientState[] {
    return this.getAllClients().filter(client => client.language === language);
  }
  
  /**
   * Get all unique languages used by clients
   */
  public getUniqueLanguages(): string[] {
    const languages = new Set<string>();
    const clientStates = Array.from(this.clients.values());
    
    for (const state of clientStates) {
      if (state.language) {
        languages.add(state.language);
      }
    }
    
    return Array.from(languages);
  }
  
  /**
   * Get count of clients by role
   */
  public getClientCountByRole(role: string): number {
    return this.getClientsByRole(role).length;
  }
  
  /**
   * Get total client count
   */
  public getTotalClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Check if a client exists
   */
  public hasClient(ws: WebSocketClient): boolean {
    return this.clients.has(ws);
  }
  
  /**
   * Send message to a specific client
   * Returns true if successful, false if client not found or error occurred
   */
  public sendToClient(ws: WebSocketClient, message: any): boolean {
    try {
      if (!this.hasClient(ws)) return false;
      
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message to client:', error);
      return false;
    }
  }
  
  /**
   * Broadcast message to all clients
   * Returns count of clients message was successfully sent to
   */
  public broadcast(message: any): number {
    let successCount = 0;
    const clientStates = Array.from(this.clients.values());
    
    for (const state of clientStates) {
      try {
        state.connection.send(JSON.stringify(message));
        successCount++;
      } catch (error) {
        console.error('Error broadcasting message to client:', error);
      }
    }
    
    return successCount;
  }
  
  /**
   * Broadcast message to clients with specific role
   * Returns count of clients message was successfully sent to
   */
  public broadcastToRole(role: string, message: any): number {
    const clients = this.getClientsByRole(role);
    let successCount = 0;
    
    for (const state of clients) {
      try {
        state.connection.send(JSON.stringify(message));
        successCount++;
      } catch (error) {
        console.error(`Error broadcasting message to client with role ${role}:`, error);
      }
    }
    
    return successCount;
  }
}