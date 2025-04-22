/**
 * WebSocket Client Utilities
 * 
 * Helper functions for WebSocket client operations
 */

// Import the WebSocketClient type (not the actual class) to avoid circular dependencies
import type { WebSocketClient } from '../services/WebSocketClient';

// Using a getter function to avoid circular dependency issues
let _wsClientInstance: WebSocketClient | null = null;

// Following Interface Segregation Principle - provide only the methods needed
export const wsClient = {
  getInstance: (): WebSocketClient | null => _wsClientInstance,
  setInstance: (instance: WebSocketClient): WebSocketClient => {
    _wsClientInstance = instance;
    return _wsClientInstance;
  }
};

/**
 * Create a WebSocket connection
 */
export function createWebSocketConnection(path: string = '/ws'): WebSocket {
  // Determine the WebSocket URL based on the current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const url = `${protocol}//${host}${path}`;
  
  console.log(`Creating WebSocket connection to ${url}`);
  
  // Create a new WebSocket connection
  const socket = new WebSocket(url);
  
  // Set up basic event handlers
  socket.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  socket.onclose = (event) => {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return socket;
}

/**
 * Send a message to the WebSocket server
 */
export function sendMessage(socket: WebSocket, message: any): boolean {
  if (socket.readyState !== WebSocket.OPEN) {
    console.warn('Cannot send message, WebSocket is not open');
    return false;
  }
  
  try {
    socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Failed to send message:', error);
    return false;
  }
}

/**
 * Listen for messages from the WebSocket server
 */
export function addMessageListener(
  socket: WebSocket, 
  callback: (message: any) => void
): () => void {
  const listener = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      callback(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  socket.addEventListener('message', listener);
  
  // Return a function to remove the listener
  return () => {
    socket.removeEventListener('message', listener);
  };
}

/**
 * Keep the WebSocket connection alive
 */
export function setupHeartbeat(socket: WebSocket, interval: number = 30000): () => void {
  // Send ping message every 30 seconds
  const intervalId = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      sendMessage(socket, {
        type: 'ping',
        timestamp: Date.now()
      });
    }
  }, interval);
  
  // Return a function to clear the interval
  return () => {
    clearInterval(intervalId);
  };
}