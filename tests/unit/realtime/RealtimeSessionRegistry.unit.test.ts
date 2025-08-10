import { describe, it, expect } from 'vitest';
import { RealtimeSessionRegistry } from '../../../server/realtime/session/RealtimeSessionRegistry';

describe('RealtimeSessionRegistry', () => {
  it('stores and retrieves connection data', () => {
    const r = new RealtimeSessionRegistry();
    r.set('c1', { role: 'teacher', languageCode: 'en-US', sessionId: 's1' });
    const d = r.get('c1');
    expect(d?.role).toBe('teacher');
    expect(d?.languageCode).toBe('en-US');
    expect(d?.sessionId).toBe('s1');
  });

  it('merges updates', () => {
    const r = new RealtimeSessionRegistry();
    r.set('c2', { role: 'student' });
    r.set('c2', { languageCode: 'de-DE' });
    const d = r.get('c2');
    expect(d?.role).toBe('student');
    expect(d?.languageCode).toBe('de-DE');
  });

  it('clears entries', () => {
    const r = new RealtimeSessionRegistry();
    r.set('c3', { role: 'teacher' });
    r.clear('c3');
    expect(r.get('c3')).toBeUndefined();
  });
});


