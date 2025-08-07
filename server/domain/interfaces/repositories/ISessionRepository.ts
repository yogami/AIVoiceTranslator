/**
 * Domain Interface: Session Repository
 * 
 * Core domain contract for session persistence.
 * This interface defines the domain's expectations for session storage
 * without any infrastructure concerns.
 */

import { Session, SessionId, TeacherId, ClassroomCode } from '../../entities/Session';

export interface SessionFilter {
  teacherId?: TeacherId;
  status?: string;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ISessionRepository {
  /**
   * Save a session to persistent storage
   * @param session Session entity to save
   * @returns Promise resolving to saved session
   */
  save(session: Session): Promise<Session>;

  /**
   * Find session by ID
   * @param id Session ID
   * @returns Promise resolving to session or null if not found
   */
  findById(id: SessionId): Promise<Session | null>;

  /**
   * Find session by classroom code
   * @param classroomCode Classroom code
   * @returns Promise resolving to session or null if not found
   */
  findByClassroomCode(classroomCode: ClassroomCode): Promise<Session | null>;

  /**
   * Find active session by teacher ID
   * @param teacherId Teacher ID
   * @returns Promise resolving to active session or null if not found
   */
  findActiveByTeacherId(teacherId: TeacherId): Promise<Session | null>;

  /**
   * Find recent session by teacher ID within grace period
   * @param teacherId Teacher ID
   * @param gracePeriodMs Grace period in milliseconds
   * @returns Promise resolving to recent session or null if not found
   */
  findRecentByTeacherId(teacherId: TeacherId, gracePeriodMs: number): Promise<Session | null>;

  /**
   * Find sessions matching filter criteria
   * @param filter Session filter criteria
   * @returns Promise resolving to array of matching sessions
   */
  findByFilter(filter: SessionFilter): Promise<Session[]>;

  /**
   * Update session
   * @param session Updated session entity
   * @returns Promise resolving to updated session
   */
  update(session: Session): Promise<Session>;

  /**
   * Delete session by ID
   * @param id Session ID
   * @returns Promise resolving to boolean indicating success
   */
  delete(id: SessionId): Promise<boolean>;

  /**
   * Count active sessions
   * @returns Promise resolving to count of active sessions
   */
  countActive(): Promise<number>;

  /**
   * Find expired sessions
   * @param gracePeriodMs Grace period in milliseconds
   * @returns Promise resolving to array of expired sessions
   */
  findExpired(gracePeriodMs: number): Promise<Session[]>;

  /**
   * Delete expired sessions
   * @param gracePeriodMs Grace period in milliseconds
   * @returns Promise resolving to number of deleted sessions
   */
  deleteExpired(gracePeriodMs: number): Promise<number>;
}
