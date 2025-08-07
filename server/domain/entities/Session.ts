/**
 * Domain Entity: Session
 * 
 * Core business entity representing a classroom session.
 * Contains business rules and invariants for session management.
 */

export interface SessionId {
  readonly value: string;
}

export interface TeacherId {
  readonly value: string;
}

export interface ClassroomCode {
  readonly value: string;
}

export type SessionStatus = 'active' | 'inactive' | 'expired' | 'ended';

export class Session {
  constructor(
    public readonly id: SessionId,
    public readonly teacherId: TeacherId,
    public readonly languageCode: string,
    public readonly classroomCode: ClassroomCode,
    public readonly startTime: Date,
    public endTime?: Date,
    public status: SessionStatus = 'active',
    public studentsCount: number = 0
  ) {
    this.validateInvariants();
  }

  /**
   * Business rule: End a session
   */
  end(): void {
    if (this.status === 'ended') {
      throw new Error('Session is already ended');
    }
    
    this.status = 'ended';
    this.endTime = new Date();
  }

  /**
   * Business rule: Add student to session
   */
  addStudent(): void {
    if (this.status !== 'active') {
      throw new Error('Cannot add student to inactive session');
    }
    
    this.studentsCount++;
  }

  /**
   * Business rule: Remove student from session
   */
  removeStudent(): void {
    if (this.studentsCount <= 0) {
      throw new Error('No students to remove');
    }
    
    this.studentsCount--;
  }

  /**
   * Business rule: Check if session is expired
   */
  isExpired(gracePeriodMs: number = 30 * 60 * 1000): boolean {
    if (this.status === 'ended') {
      return true;
    }

    const now = new Date();
    const expirationTime = new Date(this.startTime.getTime() + gracePeriodMs);
    
    return now > expirationTime && this.studentsCount === 0;
  }

  /**
   * Business rule: Check if session can be rejoined by teacher
   */
  canTeacherRejoin(gracePeriodMs: number = 10 * 60 * 1000): boolean {
    if (this.status === 'ended') {
      return false;
    }

    const now = new Date();
    const lastActivity = this.endTime || this.startTime;
    const gracePeriodEnd = new Date(lastActivity.getTime() + gracePeriodMs);
    
    return now <= gracePeriodEnd;
  }

  /**
   * Validate business invariants
   */
  private validateInvariants(): void {
    if (!this.id.value || this.id.value.trim() === '') {
      throw new Error('Session ID cannot be empty');
    }

    if (!this.teacherId.value || this.teacherId.value.trim() === '') {
      throw new Error('Teacher ID cannot be empty');
    }

    if (!this.languageCode || this.languageCode.trim() === '') {
      throw new Error('Language code cannot be empty');
    }

    if (!this.classroomCode.value || this.classroomCode.value.trim() === '') {
      throw new Error('Classroom code cannot be empty');
    }

    if (this.studentsCount < 0) {
      throw new Error('Students count cannot be negative');
    }

    if (this.endTime && this.endTime < this.startTime) {
      throw new Error('End time cannot be before start time');
    }
  }

  /**
   * Get session duration in milliseconds
   */
  getDuration(): number {
    const endTime = this.endTime || new Date();
    return endTime.getTime() - this.startTime.getTime();
  }

  /**
   * Create a copy with updated properties
   */
  update(updates: Partial<Pick<Session, 'status' | 'studentsCount' | 'endTime'>>): Session {
    return new Session(
      this.id,
      this.teacherId,
      this.languageCode,
      this.classroomCode,
      this.startTime,
      updates.endTime ?? this.endTime,
      updates.status ?? this.status,
      updates.studentsCount ?? this.studentsCount
    );
  }
}
