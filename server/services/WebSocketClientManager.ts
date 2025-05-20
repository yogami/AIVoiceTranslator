/**
 * WebSocket Client Manager
 * 
 * Responsible for tracking and managing WebSocket client connections,
 * including their roles, languages, and settings.
 * 
 * This follows the Single Responsibility Principle by focusing solely
 * on client state management.
 */

// Define the WebSocketClient type here to avoid circular dependencies
// Should match the same interface in WebSocketTypes.ts
export type WebSocketClient = WebSocket & {
  isAlive: boolean;
  sessionId: string;
  on: (event: string, listener: (...args: any[]) => void) => WebSocketClient;
  terminate: () => void;
  ping: () => void;
  send: (data: string) => void;
};

/**
 * Client settings interface
 */
interface ClientSettings {
  ttsServiceType?: string;
  [key: string]: any;
}

/**
 * WebSocketClientManager handles all client connection state
 */
export class WebSocketClientManager {
  // Connection tracking
  private connections: Set<WebSocketClient> = new Set();
  private roles: Map<WebSocketClient, string> = new Map();
  private languages: Map<WebSocketClient, string> = new Map();
  private sessionIds: Map<WebSocketClient, string> = new Map();
  private clientSettings: Map<WebSocketClient, ClientSettings> = new Map();
  
  // Counter for generating unique session IDs
  private sessionCounter: number = 0;
  
  /**
   * Add a new client connection
   */
  public addClient(ws: WebSocketClient, sessionId?: string): string {
    // Generate a unique session ID if not provided
    const newSessionId = sessionId || this.generateSessionId();
    
    // Store connection details
    this.connections.add(ws);
    this.sessionIds.set(ws, newSessionId);
    
    // Initialize client as alive
    ws.isAlive = true;
    
    return newSessionId;
  }
  
  /**
   * Remove a client connection and clean up all associated data
   */
  public removeClient(ws: WebSocketClient): void {
    this.connections.delete(ws);
    this.roles.delete(ws);
    this.languages.delete(ws);
    this.sessionIds.delete(ws);
    this.clientSettings.delete(ws);
  }
  
  /**
   * Set client role
   */
  public setRole(ws: WebSocketClient, role: string): void {
    this.roles.set(ws, role);
  }
  
  /**
   * Get client role
   */
  public getRole(ws: WebSocketClient): string | undefined {
    return this.roles.get(ws);
  }
  
  /**
   * Set client language
   */
  public setLanguage(ws: WebSocketClient, language: string): void {
    this.languages.set(ws, language);
  }
  
  /**
   * Get client language
   */
  public getLanguage(ws: WebSocketClient): string | undefined {
    return this.languages.get(ws);
  }
  
  /**
   * Get client session ID
   */
  public getSessionId(ws: WebSocketClient): string | undefined {
    return this.sessionIds.get(ws);
  }
  
  /**
   * Set client settings
   */
  public updateSettings(ws: WebSocketClient, settings: Partial<ClientSettings>): ClientSettings {
    const currentSettings = this.clientSettings.get(ws) || {};
    const updatedSettings = { ...currentSettings, ...settings };
    this.clientSettings.set(ws, updatedSettings);
    return updatedSettings;
  }
  
  /**
   * Get client settings
   */
  public getSettings(ws: WebSocketClient): ClientSettings {
    return this.clientSettings.get(ws) || {};
  }
  
  /**
   * Get all client connections
   */
  public getAllConnections(): Set<WebSocketClient> {
    return this.connections;
  }
  
  /**
   * Get total number of connected clients 
   */
  public getTotalClientCount(): number {
    return this.connections.size;
  }
  
  /**
   * Get clients with a specific role
   */
  public getClientsByRole(role: string): WebSocketClient[] {
    const clients: WebSocketClient[] = [];
    
    this.connections.forEach(ws => {
      if (this.roles.get(ws) === role) {
        clients.push(ws);
      }
    });
    
    return clients;
  }
  
  /**
   * Get clients with a specific language
   */
  public getClientsByLanguage(language: string): WebSocketClient[] {
    const clients: WebSocketClient[] = [];
    
    this.connections.forEach(ws => {
      if (this.languages.get(ws) === language) {
        clients.push(ws);
      }
    });
    
    return clients;
  }
  
  /**
   * Get all unique languages used by clients with a specific role
   */
  public getLanguagesByRole(role: string): string[] {
    const languages = new Set<string>();
    
    this.connections.forEach(ws => {
      if (this.roles.get(ws) === role) {
        const language = this.languages.get(ws);
        if (language) {
          languages.add(language);
        }
      }
    });
    
    return Array.from(languages);
  }
  
  /**
   * Mark a client as alive (for heartbeat)
   */
  public markAlive(ws: WebSocketClient): void {
    ws.isAlive = true;
  }
  
  /**
   * Mark a client as potentially inactive (for heartbeat)
   */
  public markPending(ws: WebSocketClient): void {
    ws.isAlive = false;
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${this.sessionCounter++}`;
  }
}