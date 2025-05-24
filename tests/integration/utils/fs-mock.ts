/**
 * File System Mock for Integration Tests
 * 
 * This provides infrastructure-level mocking specifically for integration tests.
 * Unlike unit test mocks, this focuses on preventing actual file I/O while
 * allowing real business logic to execute.
 */

import { vi } from 'vitest';

export function setupIntegrationFsMock() {
  vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
      ...actual,
      default: actual,
      promises: {
        ...actual.promises,
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(Buffer.from('mock audio data')),
        unlink: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({
          size: 1024,
          mtime: new Date(),
          mtimeMs: Date.now(),
          isFile: () => true,
          isDirectory: () => false
        })
      },
      // Keep original sync methods available
      constants: actual.constants,
      existsSync: vi.fn().mockReturnValue(true)
    };
  });
}