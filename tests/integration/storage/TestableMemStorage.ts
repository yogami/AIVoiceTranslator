import { MemStorage } from '../../../server/mem-storage';

/**
 * TestableMemStorage extends MemStorage to provide test-specific helper methods,
 * such as ensuring asynchronous initialization is complete.
 */
export class TestableMemStorage extends MemStorage {
  constructor() {
    super();
  }

  /**
   * Ensures that any asynchronous initialization tasks in the MemStorage constructor,
   * like initializing default languages, are complete.
   * This method polls for the presence of default languages as an indicator of initialization.
   */
  public async ensureInitialized(): Promise<void> {
    const checkInterval = 50; // ms
    const timeout = 5000; // ms
    let elapsedTime = 0;

    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          // MemStorage delegates getLanguages to MemLanguageStorage,
          // which initializes 10 default languages.
          const languages = await this.getLanguages();
          if (languages && languages.length >= 10) {
            resolve();
          } else if (elapsedTime >= timeout) {
            const currentCount = languages ? languages.length : 0;
            reject(
              new Error(
                `TestableMemStorage: Timeout waiting for MemStorage initialization. Expected >=10 languages, got ${currentCount}.`
              )
            );
          } else {
            elapsedTime += checkInterval;
            setTimeout(check, checkInterval);
          }
        } catch (error) {
          // If getLanguages() itself throws an error during polling.
          reject(
            new Error(
              `TestableMemStorage: Error during initialization check: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
        }
      };
      check(); // Start polling
    });
  }
}
