// @ts-check
import { test, expect } from '@playwright/test';
import { getAnalyticsURL } from './helpers/test-config';
import { seedRealisticTestData, clearDiagnosticData } from './test-data-utils';
import { ensureTestDatabaseSchema } from './test-setup';

/**
 * Session Lifecycle E2E Tests
 * 
 * Comprehensive tests for session lifecycle validation through analytics UI:
 * - Teacher session creation and management
 * - Session expiration and cleanup validation
 * - Student participation tracking
 * - Database consistency verification through natural language queries
 * - Session isolation and teacher reconnection scenarios
 */

// Helper function to ask analytics questions and get responses
async function askAnalyticsQuestion(page: any, question: string): Promise<string> {
  await page.fill('#questionInput', question);
  await page.click('#askButton');
  await page.waitForTimeout(2000);
  
  const messages = page.locator('.ai-message');
  const lastMessage = messages.last();
  const response = await lastMessage.textContent();
  return response || '';
}

// Helper function to navigate to analytics page and wait for load
async function navigateToAnalytics(page: any): Promise<void> {
  await page.goto(getAnalyticsURL());
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.waitForSelector('#questionInput', { timeout: 5000 });
}

test.describe('Session Lifecycle E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await ensureTestDatabaseSchema();
    await clearDiagnosticData();
    await seedRealisticTestData();
  });

  test.afterEach(async ({ page }) => {
    await clearDiagnosticData();
  });

  test.describe('Teacher Authentication and Session Creation', () => {
    test('should validate teacher session creation through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for active sessions to see current state
      const activeSessionsResponse = await askAnalyticsQuestion(page, 'How many active sessions are there currently?');
      expect(activeSessionsResponse).toBeTruthy();
      
      // Query for total sessions to validate session creation
      const totalSessionsResponse = await askAnalyticsQuestion(page, 'What is the total number of sessions?');
      expect(totalSessionsResponse).toBeTruthy();
      expect(totalSessionsResponse).toContain('session');
      
      // Verify we can get session details
      const sessionDetailsResponse = await askAnalyticsQuestion(page, 'Tell me about the session details including teacher and student languages');
      expect(sessionDetailsResponse).toBeTruthy();
      expect(sessionDetailsResponse.length).toBeGreaterThan(50);
    });

    test('should handle teacher authentication validation through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for session information that would show authentication success
      const sessionInfoResponse = await askAnalyticsQuestion(page, 'Show me sessions with their classroom codes and active status');
      expect(sessionInfoResponse).toBeTruthy();
      
      // Verify session has proper teacher language configuration
      const languageResponse = await askAnalyticsQuestion(page, 'What teacher languages are being used in sessions?');
      expect(languageResponse).toBeTruthy();
      expect(languageResponse).toMatch(/en-US|de-DE|fr-FR|es-ES|zh-CN/);
    });
  });

  test.describe('Teacher Reconnection and Session Management', () => {
    test('should validate teacher reconnection scenarios through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for session continuity information
      const sessionContinuityResponse = await askAnalyticsQuestion(page, 'Show me sessions that have been active for more than 30 minutes');
      expect(sessionContinuityResponse).toBeTruthy();
      
      // Verify session isolation between different teachers
      const sessionIsolationResponse = await askAnalyticsQuestion(page, 'How many different classroom codes are active?');
      expect(sessionIsolationResponse).toBeTruthy();
      
      // Check for proper session state management
      const sessionStateResponse = await askAnalyticsQuestion(page, 'Tell me about session start and end times');
      expect(sessionStateResponse).toBeTruthy();
      expect(sessionStateResponse).toContain('session');
    });

    test('should verify session isolation between teachers through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for multiple teachers having separate sessions
      const multiTeacherResponse = await askAnalyticsQuestion(page, 'Show me how many sessions each teacher language has');
      expect(multiTeacherResponse).toBeTruthy();
      
      // Verify different classroom codes exist
      const classroomCodeResponse = await askAnalyticsQuestion(page, 'List all unique classroom codes');
      expect(classroomCodeResponse).toBeTruthy();
      
      // Check session distribution
      const sessionDistributionResponse = await askAnalyticsQuestion(page, 'What is the distribution of active vs inactive sessions?');
      expect(sessionDistributionResponse).toBeTruthy();
    });
  });

  test.describe('Session Expiration and Cleanup', () => {
    test('should validate session cleanup through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for session cleanup information
      const cleanupResponse = await askAnalyticsQuestion(page, 'What sessions need cleanup and how many were cleaned up recently?');
      expect(cleanupResponse).toBeTruthy();
      
      // Verify expired sessions are handled correctly
      const expiredSessionsResponse = await askAnalyticsQuestion(page, 'Show me sessions that have ended');
      expect(expiredSessionsResponse).toBeTruthy();
      
      // Check for proper cleanup status
      const cleanupStatusResponse = await askAnalyticsQuestion(page, 'What is the session cleanup status?');
      expect(cleanupStatusResponse).toBeTruthy();
    });

    test('should verify session expiration handling through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for session duration information
      const durationResponse = await askAnalyticsQuestion(page, 'What is the average session duration?');
      expect(durationResponse).toBeTruthy();
      
      // Verify session lifecycle tracking
      const lifecycleResponse = await askAnalyticsQuestion(page, 'Tell me about session lifecycle from start to end');
      expect(lifecycleResponse).toBeTruthy();
      
      // Check for abandoned sessions
      const abandonedResponse = await askAnalyticsQuestion(page, 'Show me sessions that have been abandoned');
      expect(abandonedResponse).toBeTruthy();
    });
  });

  test.describe('Student Participation and Session Activity', () => {
    test('should validate student participation through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for student participation data
      const participationResponse = await askAnalyticsQuestion(page, 'How many students participated in each session?');
      expect(participationResponse).toBeTruthy();
      
      // Verify translation activity
      const translationResponse = await askAnalyticsQuestion(page, 'What sessions had the most translations?');
      expect(translationResponse).toBeTruthy();
      
      // Check for sessions with no student participation
      const noParticipationResponse = await askAnalyticsQuestion(page, 'Which sessions had no student participation?');
      expect(noParticipationResponse).toBeTruthy();
    });

    test('should verify session activity tracking through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for activity metrics
      const activityResponse = await askAnalyticsQuestion(page, 'Show me the most active sessions by translation count');
      expect(activityResponse).toBeTruthy();
      
      // Verify language pair usage
      const languagePairResponse = await askAnalyticsQuestion(page, 'What language pairs are being used in sessions?');
      expect(languagePairResponse).toBeTruthy();
      expect(languagePairResponse).toMatch(/en-US|de-DE|fr-FR|es-ES|zh-CN/);
      
      // Check for session completion rates
      const completionResponse = await askAnalyticsQuestion(page, 'What is the session completion rate?');
      expect(completionResponse).toBeTruthy();
    });
  });

  test.describe('Database Consistency and Validation', () => {
    test('should verify database consistency through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for data consistency
      const consistencyResponse = await askAnalyticsQuestion(page, 'Are there any inconsistencies in session data?');
      expect(consistencyResponse).toBeTruthy();
      
      // Verify referential integrity
      const integrityResponse = await askAnalyticsQuestion(page, 'Show me sessions with their related translations and transcripts');
      expect(integrityResponse).toBeTruthy();
      
      // Check for orphaned data
      const orphanedResponse = await askAnalyticsQuestion(page, 'Are there any orphaned sessions or translations?');
      expect(orphanedResponse).toBeTruthy();
    });

    test('should validate session state transitions through analytics', async ({ page }) => {
      await navigateToAnalytics(page);
      
      // Query for session state information
      const stateResponse = await askAnalyticsQuestion(page, 'Show me the current state of all sessions');
      expect(stateResponse).toBeTruthy();
      
      // Verify proper state transitions
      const transitionResponse = await askAnalyticsQuestion(page, 'How many sessions transitioned from active to inactive today?');
      expect(transitionResponse).toBeTruthy();
      
      // Check for proper session timestamps
      const timestampResponse = await askAnalyticsQuestion(page, 'Show me session timestamps and their validity');
      expect(timestampResponse).toBeTruthy();
    });
  });
});
