/**
 * Custom Error class for Storage operations
 */

export enum StorageErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
    STORAGE_ERROR = 'STORAGE_ERROR', // General storage error
    CREATE_FAILED = 'CREATE_FAILED',
    DB_INSERT_FAILED = 'DB_INSERT_FAILED',
    DB_ERROR = 'DB_ERROR', // General database error
}

export class StorageError extends Error {
    public code: StorageErrorCode;
    public details?: string;

    constructor(message: string, code: StorageErrorCode, details?: string) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
        this.details = details;

        // This line is important for instanceof checks to work correctly
        Object.setPrototypeOf(this, StorageError.prototype);
    }
}
