/**
 * Mock implementation of fs module for tests
 * This prevents errors with promisify and fs operations
 */

import { vi } from 'vitest';

export const writeFile = vi.fn();
export const mkdir = vi.fn();
export const readFile = vi.fn();
export const stat = vi.fn();
export const unlink = vi.fn();
export const access = vi.fn();

// Add all needed fs methods
export default {
  writeFile,
  mkdir,
  readFile,
  stat,
  unlink,
  access,
  promises: {
    writeFile,
    mkdir,
    readFile,
    stat,
    unlink,
    access
  }
};