/**
 * Global Test Database Lock
 * Ensures database operations in tests are sequential to prevent race conditions
 */

let globalDbLock: Promise<void> = Promise.resolve();
let lockCounter = 0;

export async function withDatabaseLock<T>(operation: () => Promise<T>): Promise<T> {
  const currentLockId = ++lockCounter;
  console.log(`[DB_LOCK] Acquiring lock #${currentLockId}`);
  
  // Wait for previous operations
  await globalDbLock;
  
  // Execute the operation and update the global lock
  let resolveCurrentLock: () => void;
  globalDbLock = new Promise(resolve => {
    resolveCurrentLock = resolve;
  });
  
  try {
    console.log(`[DB_LOCK] Executing operation #${currentLockId}`);
    const result = await operation();
    console.log(`[DB_LOCK] Completed operation #${currentLockId}`);
    return result;
  } finally {
    resolveCurrentLock!();
  }
}

export async function resetGlobalLock(): Promise<void> {
  await globalDbLock;
  globalDbLock = Promise.resolve();
  lockCounter = 0;
  console.log('[DB_LOCK] Reset global lock');
}
