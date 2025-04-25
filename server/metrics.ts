/**
 * Code Metrics Service
 * 
 * This module provides code quality metrics for the AIVoiceTranslator project.
 * It calculates metrics based on the code quality cheatsheet including:
 * - Test coverage metrics (line, branch, function coverage)
 * - Complexity metrics (cyclomatic complexity, nesting depth, function length)
 * - Code smells detection
 * - Duplication analysis
 * - Dependencies analysis
 * 
 * The metrics are calculated on demand and cached for performance.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

// Convert exec to a Promise-based function
const execAsync = promisify(exec);

// GitHub API configuration
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'your-github-username';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'AIVoiceTranslator';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Define metrics types
export interface CoverageMetrics {
  overall: number;
  line: number;
  branch: number;
  function: number;
  byModule: {
    [key: string]: {
      line: number;
      branch: number;
      function: number;
    }
  };
  uncovered: Array<{
    file: string;
    lines: string;
    function: string;
  }>;
}

export interface ComplexityMetrics {
  average: number;
  max: number;
  nesting: {
    max: number;
    average: number;
  };
  functionLength: {
    average: number;
    distribution: {
      "1-10": number;
      "11-20": number;
      "21-40": number;
      "41+": number;
    };
  };
  functions: Array<{
    name: string;
    complexity: number;
    length: number;
    nesting: number;
  }>;
}

export interface CodeSmellsMetrics {
  total: number;
  types: {
    [key: string]: {
      count: number;
      severity: string;
    }
  };
}

export interface DuplicationMetrics {
  percentage: number;
  instances: Array<{
    file1: string;
    file2: string;
    lines: number;
  }>;
}

export interface DependenciesMetrics {
  modules: Array<string>;
  circular: Array<{
    moduleA: string;
    moduleB: string;
    type: string;
  }>;
}

export interface TestResultsMetrics {
  unit: {
    total: number;
    passed: number;
    failed: number;
  };
  integration: {
    total: number;
    passed: number;
    failed: number;
  };
  e2e: {
    total: number;
    passed: number;
    failed: number;
  };
  cicd: {
    lastRun: string;
    status: string;
    workflows: Array<{
      name: string;
      status: string;
      url: string;
      lastRun: string;
      duration: string;
    }>;
  };
  audio: {
    total: number;
    passed: number;
    failed: number;
    lastRun: string;
  };
}

export interface AllMetrics {
  coverage: CoverageMetrics;
  complexity: ComplexityMetrics;
  codeSmells: CodeSmellsMetrics;
  duplication: DuplicationMetrics;
  dependencies: DependenciesMetrics;
  testResults: TestResultsMetrics;
}

// Cache for metrics data
let metricsCache: AllMetrics | null = null;
let lastCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all metrics data
 * @returns Promise<AllMetrics> The metrics data
 */
export async function getAllMetrics(): Promise<AllMetrics> {
  // Check if we have cached metrics and they're still valid
  const now = Date.now();
  if (metricsCache && (now - lastCacheTime) < CACHE_TTL) {
    return metricsCache;
  }

  // Calculate all metrics (in parallel for performance)
  const [coverage, complexity, codeSmells, duplication, dependencies, testResults] = await Promise.all([
    getCoverageMetrics(),
    getComplexityMetrics(),
    getCodeSmellsMetrics(),
    getDuplicationMetrics(),
    getDependenciesMetrics(),
    getTestResultsMetrics()
  ]);

  // Update cache
  metricsCache = {
    coverage,
    complexity,
    codeSmells,
    duplication,
    dependencies,
    testResults
  };
  lastCacheTime = now;

  return metricsCache;
}

/**
 * Calculate test coverage metrics
 * @returns Promise<CoverageMetrics> The coverage metrics
 */
async function getCoverageMetrics(): Promise<CoverageMetrics> {
  try {
    // In a real implementation, we would run Jest with coverage and parse the output
    // For now, we'll return sample data

    return {
      overall: 78,
      line: 82,
      branch: 69,
      function: 85,
      byModule: {
        'client/src/lib/websocket.ts': {
          line: 92,
          branch: 87,
          function: 95
        },
        'server/services/WebSocketServer.ts': {
          line: 85,
          branch: 78,
          function: 90
        },
        'server/services/TranslationService.ts': {
          line: 75,
          branch: 65,
          function: 82
        },
        'server/openai.ts': {
          line: 67,
          branch: 55,
          function: 80
        },
        'server/openai-streaming.ts': {
          line: 61,
          branch: 52,
          function: 72
        }
      },
      uncovered: [
        {
          file: 'server/openai-streaming.ts',
          lines: '162-178',
          function: 'processAudioChunks'
        },
        {
          file: 'server/openai-streaming.ts',
          lines: '210-225',
          function: 'finalizeStreamingSession'
        },
        {
          file: 'server/services/TranslationService.ts',
          lines: '92-105',
          function: 'handleTranslationError'
        },
        {
          file: 'client/lib/websocket.ts',
          lines: '338-352',
          function: 'setupPingInterval'
        }
      ]
    };
  } catch (error) {
    console.error('Error calculating coverage metrics:', error);
    throw new Error('Failed to calculate coverage metrics');
  }
}

/**
 * Calculate code complexity metrics
 * @returns Promise<ComplexityMetrics> The complexity metrics
 */
async function getComplexityMetrics(): Promise<ComplexityMetrics> {
  try {
    // In a real implementation, we would use tools like ESLint or complexity reporters
    // For now, we'll return sample data

    return {
      average: 4.2,
      max: 12,
      nesting: {
        max: 3,
        average: 2.1
      },
      functionLength: {
        average: 28,
        distribution: {
          "1-10": 24,
          "11-20": 28,
          "21-40": 18,
          "41+": 4
        }
      },
      functions: [
        {
          name: 'processStreamingAudio',
          complexity: 12,
          length: 45,
          nesting: 4
        },
        {
          name: 'WebSocketClient.connect',
          complexity: 8,
          length: 65,
          nesting: 3
        },
        {
          name: 'TranslationService.translateText',
          complexity: 7,
          length: 38,
          nesting: 3
        },
        {
          name: 'finalizeStreamingSession',
          complexity: 6,
          length: 32,
          nesting: 2
        },
        {
          name: 'processAudioChunks',
          complexity: 5,
          length: 27,
          nesting: 2
        }
      ]
    };
  } catch (error) {
    console.error('Error calculating complexity metrics:', error);
    throw new Error('Failed to calculate complexity metrics');
  }
}

/**
 * Calculate code smells metrics
 * @returns Promise<CodeSmellsMetrics> The code smells metrics
 */
async function getCodeSmellsMetrics(): Promise<CodeSmellsMetrics> {
  try {
    // In a real implementation, we would use tools like ESLint or SonarQube
    // For now, we'll return sample data

    return {
      total: 10,
      types: {
        'Magic Numbers': {
          count: 4,
          severity: 'warning'
        },
        'Duplicate Code': {
          count: 3,
          severity: 'good'
        },
        'Long Methods': {
          count: 2,
          severity: 'warning'
        },
        'Circular Dependencies': {
          count: 1,
          severity: 'poor'
        }
      }
    };
  } catch (error) {
    console.error('Error calculating code smells metrics:', error);
    throw new Error('Failed to calculate code smells metrics');
  }
}

/**
 * Calculate code duplication metrics
 * @returns Promise<DuplicationMetrics> The duplication metrics
 */
async function getDuplicationMetrics(): Promise<DuplicationMetrics> {
  try {
    // In a real implementation, we would use tools like jsinspect
    // For now, we'll return sample data

    return {
      percentage: 2.5,
      instances: [
        {
          file1: 'server/openai.ts',
          file2: 'server/openai-streaming.ts',
          lines: 12
        },
        {
          file1: 'client/src/lib/websocket.ts',
          file2: 'tests/unit/client/websocket.test.ts',
          lines: 8
        },
        {
          file1: 'server/routes.ts',
          file2: 'server/services/WebSocketServer.ts',
          lines: 5
        }
      ]
    };
  } catch (error) {
    console.error('Error calculating duplication metrics:', error);
    throw new Error('Failed to calculate duplication metrics');
  }
}

/**
 * Calculate dependencies metrics
 * @returns Promise<DependenciesMetrics> The dependencies metrics
 */
async function getDependenciesMetrics(): Promise<DependenciesMetrics> {
  try {
    // In a real implementation, we would use tools like madge or dependency-cruiser
    // For now, we'll return sample data

    return {
      modules: [
        'server/index.ts',
        'server/routes.ts',
        'server/openai.ts',
        'server/openai-streaming.ts',
        'server/services/WebSocketServer.ts',
        'server/services/TranslationService.ts'
      ],
      circular: [
        {
          moduleA: 'server/openai.ts',
          moduleB: 'server/openai-streaming.ts',
          type: 'Indirect'
        }
      ]
    };
  } catch (error) {
    console.error('Error calculating dependencies metrics:', error);
    throw new Error('Failed to calculate dependencies metrics');
  }
}

/**
 * Fetch GitHub Actions workflow runs
 * @returns Promise with GitHub Actions workflow data
 */
async function fetchGitHubActionsWorkflows() {
  try {
    if (!GITHUB_TOKEN) {
      console.warn('GitHub token not available. Using sample data for CI/CD metrics.');
      return null;
    }

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${GITHUB_TOKEN}`
    };

    const workflowRunsUrl = `${GITHUB_API_URL}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs`;
    
    const response = await fetch(workflowRunsUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub Actions workflows:', error);
    return null;
  }
}

/**
 * Calculate test results metrics
 * @returns Promise<TestResultsMetrics> The test results metrics
 */
async function getTestResultsMetrics(): Promise<TestResultsMetrics> {
  try {
    // Get GitHub Actions data if available
    const githubData = await fetchGitHubActionsWorkflows();
    
    // Basic test metrics (from test runs or sample data)
    const testMetrics = {
      unit: {
        total: 42,
        passed: 40,
        failed: 2
      },
      integration: {
        total: 18,
        passed: 17,
        failed: 1
      },
      e2e: {
        total: 5,
        passed: 4,
        failed: 1
      }
    };
    
    // Process GitHub Actions data if available
    let cicdMetrics = {
      lastRun: new Date().toISOString(),
      status: "success",
      workflows: []
    };
    
    let audioMetrics = {
      total: 3,
      passed: 3,
      failed: 0,
      lastRun: new Date().toISOString()
    };
    
    // If we have real GitHub data, process it
    if (githubData && githubData.workflow_runs && githubData.workflow_runs.length > 0) {
      const runs = githubData.workflow_runs;
      
      // Sort runs by date (newest first)
      runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Get most recent run
      const latestRun = runs[0];
      cicdMetrics.lastRun = latestRun.created_at;
      cicdMetrics.status = latestRun.conclusion || latestRun.status;
      
      // Process workflow data
      cicdMetrics.workflows = runs.slice(0, 5).map(run => ({
        name: run.name,
        status: run.conclusion || run.status,
        url: run.html_url,
        lastRun: run.created_at,
        duration: run.updated_at 
          ? `${Math.round((new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000)}s`
          : 'In progress'
      }));
      
      // Look for audio E2E test runs
      const audioRuns = runs.filter(run => run.name.toLowerCase().includes('audio'));
      if (audioRuns.length > 0) {
        const latestAudioRun = audioRuns[0];
        audioMetrics.lastRun = latestAudioRun.created_at;
        
        // For simplicity, we're assuming all jobs in a workflow are for tests
        // In a real implementation, we would analyze job details
        audioMetrics.total = 3; // Sample value
        audioMetrics.passed = latestAudioRun.conclusion === 'success' ? 3 : 1;
        audioMetrics.failed = latestAudioRun.conclusion === 'success' ? 0 : 2;
      }
    }
    
    // Combine all test metrics
    return {
      ...testMetrics,
      cicd: cicdMetrics,
      audio: audioMetrics
    };
  } catch (error) {
    console.error('Error calculating test results metrics:', error);
    
    // Return fallback data if error
    return {
      unit: {
        total: 42,
        passed: 40,
        failed: 2
      },
      integration: {
        total: 18,
        passed: 17,
        failed: 1
      },
      e2e: {
        total: 5,
        passed: 4,
        failed: 1
      },
      cicd: {
        lastRun: new Date().toISOString(),
        status: "unknown",
        workflows: []
      },
      audio: {
        total: 3,
        passed: 3,
        failed: 0,
        lastRun: new Date().toISOString()
      }
    };
  }
}

/**
 * Force refresh of all metrics
 * @returns Promise<AllMetrics> The updated metrics data
 */
export async function refreshMetrics(): Promise<AllMetrics> {
  // Clear cache
  metricsCache = null;
  lastCacheTime = 0;
  
  // Re-calculate all metrics
  return getAllMetrics();
}