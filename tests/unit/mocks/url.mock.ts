/**
 * Mock for URL module
 * This helps avoid conflicts with import.meta.url in Jest environments
 */

export const fileURLToPath = jest.fn((url: string) => '/mocked/path/to/file');