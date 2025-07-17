/**
 * Test configuration helpers for E2E tests
 * Provides centralized access to environment-based URLs and configuration
 */

/**
 * Get the base URL for E2E tests from environment variables
 * Falls back to Playwright's baseURL configuration
 */
export function getBaseURL(): string {
  // First, try the explicit PLAYWRIGHT_BASE_URL
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return process.env.PLAYWRIGHT_BASE_URL;
  }
  
  // Then construct from HOST and PORT
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT || '5001';
  
  return `http://${host}:${port}`;
}

/**
 * Get the teacher page URL
 */
export function getTeacherURL(params?: string): string {
  const baseURL = getBaseURL();
  return params ? `${baseURL}/teacher?${params}` : `${baseURL}/teacher`;
}

/**
 * Get the student page URL
 */
export function getStudentURL(classroomCode?: string): string {
  const baseURL = getBaseURL();
  return classroomCode ? `${baseURL}/student?code=${classroomCode}` : `${baseURL}/student`;
}

/**
 * Get the analytics page URL
 */
export function getAnalyticsURL(): string {
  const baseURL = getBaseURL();
  return `${baseURL}/analytics`;
}

/**
 * Get the home page URL
 */
export function getHomeURL(): string {
  return getBaseURL();
}
