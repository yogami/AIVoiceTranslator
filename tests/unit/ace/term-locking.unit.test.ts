import { describe, it, expect } from 'vitest';
import { TermLockingService } from '../../../server/services/text/TermLockingService';

describe('TermLockingService', () => {
  it('replaces glossary terms with locked forms using word boundaries', () => {
    const svc = new TermLockingService({
      Photosynthesis: { es: 'fotosíntesis' },
      'base de datos': { es: 'base de datos' }
    });
    const input = 'La fotosíntesis ocurre. La base de datos es grande.';
    const out = svc.applyLockedTerms(input, 'es');
    expect(out).toContain('fotosíntesis');
    expect(out).toContain('base de datos');
  });
});



