// Robust fs/promises mock: ensure stat returns a valid object
const stat = vi.fn(async () => ({ size: 1234, mtime: new Date() }));
const writeFile = vi.fn(async () => undefined);
const unlink = vi.fn(async () => undefined);
const readFile = vi.fn(async () => Buffer.from('fake-audio-data'));
const access = vi.fn(async () => undefined);

vi.mock('fs/promises', () => ({
  __esModule: true,
  default: { stat, writeFile, unlink, readFile, access },
  stat,
  writeFile,
  unlink,
  readFile,
  access,
}));
// fs-promisify-mocks.ts
// Place in tests/test-helpers/fs-promisify-mocks.ts
import { vi } from 'vitest';

// Persistent mocks for promisified fs functions
export const mockPromisifiedAccess = vi.fn();
export const mockPromisifiedStat = vi.fn();
export const mockPromisifiedReadFile = vi.fn();
export const mockPromisifiedWriteFile = vi.fn();
export const mockPromisifiedUnlink = vi.fn();
export const mockPromisifiedMkdir = vi.fn();

// Robust fs mock: pass through all real fs, but override file ops with named mocks
vi.mock('fs', async (importOriginal) => {
  const actualFs = await importOriginal<typeof import('fs')>();
  const createMockFsFunction = (name: string, defaultCbImplementation?: (...args: any[]) => void) => {
    const mock = vi.fn((...args: any[]) => {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        if (defaultCbImplementation) {
          defaultCbImplementation(...args);
        } else {
          callback(null);
        }
      }
    });
    (mock as any).__FS_FUNC_NAME = name;
    return mock;
  };
  const mockFs = {
    ...actualFs,
    access: createMockFsFunction('access'),
    stat: createMockFsFunction('stat', (path, cb) => cb(null, { size: 1234, mtime: new Date() })),
    readFile: createMockFsFunction('readFile', (path, options, cb) => cb(null, Buffer.from('fake-audio-data'))),
    writeFile: createMockFsFunction('writeFile'),
    unlink: createMockFsFunction('unlink'),
    mkdir: createMockFsFunction('mkdir'),
    exists: createMockFsFunction('exists', (path, cb) => cb(true)),
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => Buffer.from('fake-audio-data')),
    writeFileSync: vi.fn(() => undefined),
    unlinkSync: vi.fn(() => undefined),
    statSync: vi.fn(() => ({ size: 1234, mtime: new Date() })),
    open: createMockFsFunction('open', (path, flags, mode, cb) => {
      const callback = typeof mode === 'function' ? mode : cb;
      callback(null, 1);
    }),
    openSync: vi.fn(() => 1),
  };
  return {
    default: mockFs,
    ...mockFs,
  };
});

// Mock util.promisify to return persistent mocks for fs functions
vi.mock('util', async (importOriginal) => {
  const actualUtil = await importOriginal<typeof import('util')>();
  return {
    ...actualUtil,
    promisify: vi.fn((fnToPromisify: any) => {
      const funcName = fnToPromisify && fnToPromisify.name;
      if (funcName === 'access') return mockPromisifiedAccess;
      if (funcName === 'stat') return mockPromisifiedStat;
      if (funcName === 'readFile') return mockPromisifiedReadFile;
      if (funcName === 'writeFile') return mockPromisifiedWriteFile;
      if (funcName === 'unlink') return mockPromisifiedUnlink;
      if (funcName === 'mkdir') return mockPromisifiedMkdir;
      // fallback to real promisify for anything else
      return actualUtil.promisify(fnToPromisify);
    }),
  };
});
