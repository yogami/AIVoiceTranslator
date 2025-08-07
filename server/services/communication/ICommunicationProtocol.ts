/**
 * Communication Protocol Abstraction
 * 
 * This interface defines the contract for real-time communication protocols.
 * Enables seamless switching between WebSocket and WebRTC implementations.
 * 
 * SOLID Principles:
 * - Single Responsibility: Pure protocol abstraction
 * - Open/Closed: Extensible for new protocols without modifying existing code
 * - Dependency Inversion: High-level modules depend on this abstraction
 */

export interface IConnection {
  id: string;
  sessionId?: string;
  role?: string;
  language?: string;
  settings?: any;
  isConnected: boolean;
  send(message: string): Promise<void>;
  close(): Promise<void>;
  
  // Event handlers
  onMessage(handler: (data: string) => void): void;
  onClose(handler: () => void): void;
  onError(handler: (error: Error) => void): void;
}

export interface ICommunicationServer {
  // Connection management
  getConnections(): IConnection[];
  getConnection(id: string): IConnection | undefined;
  getConnectionCount(): number;
  
  // Role-based filtering
  getTeacherConnections(): IConnection[];
  getStudentConnections(): IConnection[];
  getConnectionsByRole(role: string): IConnection[];
  
  // Session-based filtering
  getConnectionsBySession(sessionId: string): IConnection[];
  
  // Broadcasting
  broadcast(message: string): Promise<void>;
  broadcastToRole(role: string, message: string): Promise<void>;
  broadcastToSession(sessionId: string, message: string): Promise<void>;
  
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Events
  onConnection(handler: (connection: IConnection) => void): void;
  onDisconnection(handler: (connection: IConnection) => void): void;
}

export interface ICommunicationProtocol {
  readonly name: string;
  createServer(httpServer?: any, options?: any): ICommunicationServer;
  createClient(url: string, options?: any): Promise<IConnection>;
}
