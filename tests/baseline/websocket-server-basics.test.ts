import { describe, it, expect } from 'vitest';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';

describe('Baseline - WebSocketServer smoke', () => {
  it('should be defined (class exists)', () => {
    expect(WebSocketServer).toBeDefined();
  });
});


