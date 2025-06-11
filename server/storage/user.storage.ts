import { type User, type InsertUser, users } from "../../shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { StorageError, StorageErrorCode } from '../storage.error';

export interface IUserStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>; // Added
}

export abstract class BaseUserStorage implements IUserStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  protected validateUserInput(user: InsertUser): void {
    if (!user.username || !user.password) {
      throw new StorageError("Username and password are required", StorageErrorCode.VALIDATION_ERROR);
    }
    // Add other validation rules as needed
  }

  async createUser(user: InsertUser): Promise<User> {
    this.validateUserInput(user);
    try {
      const existingUser = await this.getUserByUsername(user.username);
      if (existingUser) {
        throw new StorageError(`User with username '${user.username}' already exists`, StorageErrorCode.DUPLICATE_ENTRY);
      }
      const newUser = await this._createUser(user);
      if (!newUser) {
        throw new StorageError("Failed to create user", StorageErrorCode.CREATE_FAILED);
      }
      return newUser;
    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      // Ensure a generic error is thrown if it's not already a StorageError
      throw new StorageError("Error creating user.", StorageErrorCode.STORAGE_ERROR, error.message);
    }
  }

  protected abstract _createUser(user: InsertUser): Promise<User>;
  abstract listUsers(): Promise<User[]>; // Ensured this is present
}

export class MemUserStorage extends BaseUserStorage {
  private usersMap: Map<number, User>;
  private idCounter: { value: number };

  constructor(usersMap: Map<number, User>, idCounter: { value: number }) {
    super();
    this.usersMap = usersMap;
    this.idCounter = idCounter;
    if (this.usersMap.size > 0) {
        const maxId = Math.max(...Array.from(this.usersMap.keys()));
        this.idCounter.value = Math.max(this.idCounter.value, maxId + 1);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.usersMap.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  protected async _createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: this.idCounter.value++,
      username: user.username,
      password: user.password
    };
    this.usersMap.set(newUser.id, newUser);
    return newUser;
  }

  async listUsers(): Promise<User[]> { // Added
    return Array.from(this.usersMap.values());
  }
}

export class DbUserStorage extends BaseUserStorage {
  protected async _createUser(user: InsertUser): Promise<User> {
    if (!user.username || !user.password) {
      throw new StorageError("Username and password are required for DB user creation", StorageErrorCode.VALIDATION_ERROR);
    }
    try {
      const result = await db.insert(users).values(user).returning();
      if (!result || result.length === 0) {
            throw new StorageError("Failed to create user in DB, no data returned.", StorageErrorCode.CREATE_FAILED);
      }
      return result[0];
    } catch (error: any) {
        // Check for unique constraint violation (specific to PostgreSQL error codes)
        if (error.code === '23505') { // PostgreSQL unique violation error code
             throw new StorageError(`User with username \'${user.username}\' already exists in DB.`, StorageErrorCode.DUPLICATE_ENTRY, error);
        }
        throw new StorageError("Error creating user in DB.", StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async listUsers(): Promise<User[]> { // Added
    return db.select().from(users);
  }
}