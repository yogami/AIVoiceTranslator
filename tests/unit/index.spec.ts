import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---- Move the mock to the top level ----
const startServerMock = vi.fn();

// ---- Mock before any imports ----
vi.mock('../../server/server', () => ({
  startServer: startServerMock,
}));

describe('server/index.ts (entry point)', () => {
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.resetModules();
    startServerMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      // Do nothing instead of exiting
    }) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('calls startServer on import', async () => {
    startServerMock.mockResolvedValueOnce(undefined);

    await import('../../server/index');

    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('logs error and exits if startServer rejects', async () => {
    const fakeError = new Error('Startup failed');
    startServerMock.mockRejectedValueOnce(fakeError);

    // Import the module and catch any unhandled rejections
    try {
      await import('../../server/index');
      // Wait for the .catch to run in the microtask queue
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (error) {
      // This should not happen with the fixed mock
    }

    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error starting server:', fakeError);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
