/**
 * WebSocketClientManager
 * 
 * Responsible for managing WebSocket client connections and their associated metadata
 */

import { WebSocket } from 'ws';

export interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  sessionId?: string;
  role?: 'teacher' | 'student';
  languageCode?: string;
}

export interface ClientSettings {
  ttsServiceType?: string;
  [key: string]: any;
}

/**
 * Manages WebSocket client connections and associated metadata
 */
export class WebSocketClientManager {
  // Core client tracking
  private clients: Set<WebSocketClient> = new Set();
  
  // Client metadata
  private roles: Map<WebSocketClient, string> = new Map();
  private languages: Map<WebSocketClient, string> = new Map();
  private sessionIds: Map<WebSocketClient, string> = new Map();
  private settings: Map<WebSocketClient, ClientSettings> = new Map();
  
  // Session counter for generating unique IDs
  private sessionCounter: number = 0;
  
  /**
   * Add a client to the manager
   * 
   * @param client - WebSocket client to add
   * @param role - Optional client role
   * @param languageCode - Optional language code
   * @returns The updated client
   */
  public addClient(client: WebSocketClient, role?: string, languageCode?: string): WebSocketClient {
    // Initialize client properties
    client.isAlive = true;
    client.sessionId = this.generateSessionId();
    
    if (role) {
      client.role = role as 'teacher' | 'student';
      this.roles.set(client, role);
    }
    
    if (languageCode) {
      client.languageCode = languageCode;
      this.languages.set(client, languageCode);
    }
    
    // Add session ID to client and mapping
    this.sessionIds.set(client, client.sessionId);
    
    // Initialize empty settings
    this.settings.set(client, {});
    
    // Add client to the set
    this.clients.add(client);
    
    return client;
  }
  
  /**
   * Remove a client from the manager
   * 
   * @param client - WebSocket client to remove
   */
  public removeClient(client: WebSocketClient): void {
    this.clients.delete(client);
    this.roles.delete(client);
    this.languages.delete(client);
    this.sessionIds.delete(client);
    this.settings.delete(client);
  }
  
  /**
   * Get all client connections
   * 
   * @returns Set of all client connections
   */
  public getAllClients(): Set<WebSocketClient> {
    return this.clients;
  }
  
  /**
   * Get the client's role
   * 
   * @param client - WebSocket client
   * @returns Client role or undefined if not set
   */
  public getClientRole(client: WebSocketClient): string | undefined {
    return this.roles.get(client) || client.role;
  }
  
  /**
   * Set the client's role
   * 
   * @param client - WebSocket client
   * @param role - Role to assign to the client
   */
  public setClientRole(client: WebSocketClient, role: string): void {
    this.roles.set(client, role);
    client.role = role as 'teacher' | 'student';
  }
  
  /**
   * Get the client's language
   * 
   * @param client - WebSocket client
   * @returns Client language or undefined if not set
   */
  public getClientLanguage(client: WebSocketClient): string | undefined {
    return this.languages.get(client) || client.languageCode;
  }
  
  /**
   * Set the client's language
   * 
   * @param client - WebSocket client
   * @param languageCode - Language code to assign to the client
   */
  public setClientLanguage(client: WebSocketClient, languageCode: string): void {
    this.languages.set(client, languageCode);
    client.languageCode = languageCode;
  }
  
  /**
   * Get the client's session ID
   * 
   * @param client - WebSocket client
   * @returns Client session ID or undefined if not set
   */
  public getClientSessionId(client: WebSocketClient): string | undefined {
    return this.sessionIds.get(client) || client.sessionId;
  }
  
  /**
   * Get client settings
   * 
   * @param client - WebSocket client
   * @returns Client settings object or empty object if not set
   */
  public getClientSettings(client: WebSocketClient): ClientSettings {
    return this.settings.get(client) || {};
  }
  
  /**
   * Update client settings
   * 
   * @param client - WebSocket client
   * @param newSettings - Settings to merge with existing settings
   * @returns Updated settings object
   */
  public updateClientSettings(client: WebSocketClient, newSettings: any): ClientSettings {
    const currentSettings = this.getClientSettings(client);
    const updatedSettings = { ...currentSettings, ...newSettings };
    this.settings.set(client, updatedSettings);
    return updatedSettings;
  }
  
  /**
   * Get clients by role
   * 
   * @param role - Role to filter clients by
   * @returns Array of clients with the specified role
   */
  public getClientsByRole(role: string): WebSocketClient[] {
    const matchingClients: WebSocketClient[] = [];
    
    this.clients.forEach(client => {
      const clientRole = this.getClientRole(client);
      if (clientRole === role) {
        matchingClients.push(client);
      }
    });
    
    return matchingClients;
  }
  
  /**
   * Get clients by language
   * 
   * @param languageCode - Language code to filter clients by
   * @returns Array of clients with the specified language
   */
  public getClientsByLanguage(languageCode: string): WebSocketClient[] {
    const matchingClients: WebSocketClient[] = [];
    
    this.clients.forEach(client => {
      const clientLanguage = this.getClientLanguage(client);
      if (clientLanguage === languageCode) {
        matchingClients.push(client);
      }
    });
    
    return matchingClients;
  }
  
  /**
   * Get all teacher clients
   * 
   * @returns Array of clients with the 'teacher' role
   */
  public getTeacherClients(): WebSocketClient[] {
    return this.getClientsByRole('teacher');
  }
  
  /**
   * Get all student clients
   * 
   * @returns Array of clients with the 'student' role
   */
  public getStudentClients(): WebSocketClient[] {
    return this.getClientsByRole('student');
  }
  
  /**
   * Get all supported languages among connected students
   * 
   * @returns Array of unique language codes from student clients
   */
  public getStudentLanguages(): string[] {
    const studentClients = this.getStudentClients();
    const languages = new Set<string>();
    
    studentClients.forEach(client => {
      const language = this.getClientLanguage(client);
      if (language) {
        languages.add(language);
      }
    });
    
    return Array.from(languages);
  }
  
  /**
   * Get students by language
   * 
   * @returns Map of language codes to arrays of student clients
   */
  public getStudentsByLanguage(): Map<string, WebSocketClient[]> {
    const studentsByLanguage = new Map<string, WebSocketClient[]>();
    const studentClients = this.getStudentClients();
    
    studentClients.forEach(client => {
      const language = this.getClientLanguage(client);
      if (language) {
        if (!studentsByLanguage.has(language)) {
          studentsByLanguage.set(language, []);
        }
        studentsByLanguage.get(language)!.push(client);
      }
    });
    
    return studentsByLanguage;
  }
  
  /**
   * Generate a unique session ID
   * 
   * @returns Unique session ID
   */
  private generateSessionId(): string {
    this.sessionCounter++;
    return `session_${Date.now()}_${this.sessionCounter}`;
  }
}