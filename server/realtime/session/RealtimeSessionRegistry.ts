export interface ConnectionSessionData {
  role?: 'teacher' | 'student' | 'unknown';
  sessionId?: string;
  languageCode?: string;
}

export class RealtimeSessionRegistry {
  private readonly connectionIdToData = new Map<string, ConnectionSessionData>();

  set(connectionId: string, data: ConnectionSessionData): void {
    this.connectionIdToData.set(connectionId, { ...this.connectionIdToData.get(connectionId), ...data });
  }

  get(connectionId: string): ConnectionSessionData | undefined {
    return this.connectionIdToData.get(connectionId);
  }

  clear(connectionId: string): void {
    this.connectionIdToData.delete(connectionId);
  }
}


