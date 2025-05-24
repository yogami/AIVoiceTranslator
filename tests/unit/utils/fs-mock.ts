/**
 * Filesystem Mock for Vitest
 * 
 * This file provides a standard mock for the 'fs' module to use in tests.
 * Import and use this in test files that need to mock filesystem operations.
 */
import { vi } from 'vitest';

// Create standard mock functions
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
const mockMkdir = vi.fn();
const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockExists = vi.fn();
const mockAccess = vi.fn();
const mockCreateReadStream = vi.fn();
const mockCreateWriteStream = vi.fn();

// Setup default implementations
mockReadFile.mockImplementation((path, options, callback) => {
  if (typeof options === 'function') {
    options(null, Buffer.from('mock file content'));
  } else {
    callback(null, Buffer.from('mock file content'));
  }
});

mockWriteFile.mockImplementation((path, data, options, callback) => {
  if (typeof options === 'function') {
    options(null);
  } else {
    callback?.(null);
  }
});

mockUnlink.mockImplementation((path, callback) => {
  callback(null);
});

mockMkdir.mockImplementation((path, options, callback) => {
  if (typeof options === 'function') {
    options(null);
  } else {
    callback?.(null);
  }
});

mockReaddir.mockImplementation((path, options, callback) => {
  if (typeof options === 'function') {
    options(null, ['mockfile1.txt', 'mockfile2.txt']);
  } else {
    callback(null, ['mockfile1.txt', 'mockfile2.txt']);
  }
});

mockStat.mockImplementation((path, callback) => {
  callback(null, {
    isFile: () => true,
    isDirectory: () => false,
    size: 12345,
    mtime: new Date()
  });
});

mockExists.mockImplementation((path, callback) => {
  callback(true);
});

mockAccess.mockImplementation((path, mode, callback) => {
  if (typeof mode === 'function') {
    mode(null); // No error means file exists and is accessible
  } else {
    callback?.(null);
  }
});

mockCreateReadStream.mockReturnValue({
  pipe: vi.fn(),
  on: vi.fn()
});

mockCreateWriteStream.mockReturnValue({
  on: vi.fn(),
  write: vi.fn(),
  end: vi.fn()
});

// Promise versions
const promiseImplementations = {
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue(['mockfile1.txt', 'mockfile2.txt']),
  stat: vi.fn().mockResolvedValue({
    isFile: () => true,
    isDirectory: () => false,
    size: 12345,
    mtime: new Date(),
    mtimeMs: Date.now()
  }),
  access: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true)
};

// Export a function to setup fs mocks
export function setupFsMock() {
  vi.mock('fs', () => {
    return {
      default: {
        readFile: mockReadFile,
        writeFile: mockWriteFile,
        unlink: mockUnlink,
        mkdir: mockMkdir,
        readdir: mockReaddir,
        stat: mockStat,
        exists: mockExists,
        access: mockAccess,
        createReadStream: mockCreateReadStream,
        createWriteStream: mockCreateWriteStream,
        constants: {
          F_OK: 0,
          R_OK: 4,
          W_OK: 2,
          X_OK: 1
        },
        existsSync: vi.fn().mockReturnValue(true),
        promises: promiseImplementations
      },
      promises: promiseImplementations,
      readFile: mockReadFile,
      writeFile: mockWriteFile,
      unlink: mockUnlink,
      mkdir: mockMkdir,
      readdir: mockReaddir,
      stat: mockStat,
      exists: mockExists,
      access: mockAccess,
      createReadStream: mockCreateReadStream,
      createWriteStream: mockCreateWriteStream,
      constants: {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1
      },
      existsSync: vi.fn().mockReturnValue(true)
    };
  });
}

// Export the mock functions for direct use in tests
export const fsMock = {
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
  mkdir: mockMkdir,
  readdir: mockReaddir,
  stat: mockStat,
  exists: mockExists,
  access: mockAccess,
  createReadStream: mockCreateReadStream,
  createWriteStream: mockCreateWriteStream,
  promises: promiseImplementations
};