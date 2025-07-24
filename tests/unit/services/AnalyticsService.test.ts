/**
 * AnalyticsService Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnalyticsService } from '../../../server/services/AnalyticsService.js';

// Mock dependencies
vi.mock('../../../server/db.js', () => ({
  db: {
    select: vi.fn()
  }
}));

vi.mock('../../../shared/schema.js', () => ({
  sessions: {
    isActive: 'is_active',
    startTime: 'start_time',
    endTime: 'end_time'
  }
}));

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock database
    const dbModule = await import('../../../server/db.js');
    mockDb = dbModule.db;
    
    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('gatherAnalyticsStats', () => {
    it('should gather comprehensive analytics statistics', async () => {
      // Mock database responses
      const mockSessionStats = [{
        totalSessions: 10,
        activeSessions: 3,
        sessionsToday: 2,
        recentSessions24h: 5
      }];

      const mockStudentStats = [{
        totalStudentConnections: 25,
        avgStudentsPerSession: 2.5,
        maxStudentsInSession: 5,
        currentlyActiveStudents: 8
      }];

      const mockDurationStats = [{
        avgDurationSeconds: 1800, // 30 minutes
        completedSessions: 7
      }];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockSessionStats)
        })
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockStudentStats)
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockDurationStats)
          })
        });

      const result = await analyticsService.gatherAnalyticsStats();

      expect(result).toEqual({
        activeSessions: 3,
        totalSessions: 10,
        recentSessions: 5,
        sessionsToday: 2,
        uniqueStudents: 25,
        currentlyActiveStudents: 8,
        averageSessionDuration: 1800,
        completedSessions: 7
      });
    });

    it('should handle null/undefined database responses gracefully', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue([{}])
        })
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue([{}])
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{}])
          })
        });

      const result = await analyticsService.gatherAnalyticsStats();

      expect(result).toEqual({
        activeSessions: 0,
        totalSessions: 0,
        recentSessions: 0,
        sessionsToday: 0,
        uniqueStudents: 0,
        currentlyActiveStudents: 0,
        averageSessionDuration: 0,
        completedSessions: 0
      });
    });
  });

  describe('processNaturalLanguageQuery', () => {
    const mockStats = {
      activeSessions: 3,
      totalSessions: 10,
      recentSessions: 5,
      sessionsToday: 2,
      uniqueStudents: 25,
      currentlyActiveStudents: 8,
      averageSessionDuration: 1800,
      completedSessions: 7
    };

    it('should return fallback response when OpenAI API key is not available', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-placeholder-for-initialization-only';

      const result = await analyticsService.processNaturalLanguageQuery('How many sessions?', mockStats);

      expect(result).toContain('Based on the current data');
      expect(result).toContain('10 total sessions');
      expect(result).toContain('3 active sessions');

      process.env.OPENAI_API_KEY = originalEnv;
    });

    it('should use OpenAI when API key is available', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      // Mock OpenAI response
      const { default: OpenAI } = await import('openai');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'You currently have 3 active sessions running.'
          }
        }]
      });
      
      (OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));

      // Recreate service to use new API key
      analyticsService = new AnalyticsService();

      const result = await analyticsService.processNaturalLanguageQuery('How many active sessions?', mockStats);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('AI Voice Translator system analytics')
          }),
          expect.objectContaining({
            role: 'user',
            content: 'How many active sessions?'
          })
        ]),
        max_tokens: 150,
        temperature: 0.1
      });

      expect(result).toBe('You currently have 3 active sessions running.');

      process.env.OPENAI_API_KEY = originalEnv;
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      // Mock OpenAI error
      const { default: OpenAI } = await import('openai');
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      
      (OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));

      // Recreate service to use new API key
      analyticsService = new AnalyticsService();

      const result = await analyticsService.processNaturalLanguageQuery('How many sessions?', mockStats);

      expect(result).toContain("I understand you're asking");
      expect(result).toContain('10 total sessions');

      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe('getDebugDatabaseInfo', () => {
    it('should return debug database information', async () => {
      const mockAllSessions = [
        { id: 1, sessionId: 'sess1', isActive: true },
        { id: 2, sessionId: 'sess2', isActive: false }
      ];

      const mockActiveSessions = [{ count: 1 }];
      const mockTotalStudents = [{ total: 15 }];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockAllSessions)
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockActiveSessions)
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue(mockTotalStudents)
        });

      const result = await analyticsService.getDebugDatabaseInfo();

      expect(result).toEqual({
        allSessions: mockAllSessions,
        activeSessions: mockActiveSessions[0],
        totalStudents: mockTotalStudents[0],
        message: 'Database debug info'
      });
    });
  });
});
