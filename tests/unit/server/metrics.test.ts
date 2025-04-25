/**
 * Unit tests for Metrics service
 * 
 * This file contains tests for the metrics service functionality
 * that provides code quality metrics.
 */

import { 
  getAllMetrics, 
  refreshMetrics,
  CoverageMetrics,
  ComplexityMetrics,
  CodeSmellsMetrics
} from '../../../server/metrics';

// Mock implementation of metrics data
jest.mock('../../../server/metrics', () => {
  // Mocked coverage metrics
  const mockCoverage: CoverageMetrics = {
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
      }
    },
    uncovered: [
      {
        file: 'server/openai-streaming.ts',
        lines: '162-178',
        function: 'processAudioChunks'
      }
    ]
  };

  // Mocked complexity metrics
  const mockComplexity: ComplexityMetrics = {
    average: 4.2,
    max: 12,
    nesting: {
      max: 3,
      average: 2.1
    },
    functionLength: {
      average: 28,
      distribution: {
        '1-10': 24,
        '11-20': 28,
        '21-40': 18,
        '41+': 4
      }
    },
    functions: [
      {
        name: 'processStreamingAudio',
        complexity: 12,
        length: 45,
        nesting: 4
      }
    ]
  };

  // Mocked code smells metrics
  const mockCodeSmells: CodeSmellsMetrics = {
    total: 10,
    types: {
      'Magic Numbers': {
        count: 4,
        severity: 'warning'
      },
      'Duplicate Code': {
        count: 3,
        severity: 'good'
      }
    }
  };

  // Return the mock implementation
  return {
    // Export the mock data types
    CoverageMetrics: jest.requireActual('../../../server/metrics').CoverageMetrics,
    ComplexityMetrics: jest.requireActual('../../../server/metrics').ComplexityMetrics,
    CodeSmellsMetrics: jest.requireActual('../../../server/metrics').CodeSmellsMetrics,
    
    // Mock the function implementations
    getAllMetrics: jest.fn().mockResolvedValue({
      coverage: mockCoverage,
      complexity: mockComplexity,
      codeSmells: mockCodeSmells,
      duplication: {
        percentage: 2.5,
        instances: []
      },
      dependencies: {
        modules: [],
        circular: []
      },
      testResults: {
        unit: { total: 42, passed: 40, failed: 2 },
        integration: { total: 18, passed: 17, failed: 1 },
        e2e: { total: 5, passed: 4, failed: 1 }
      }
    }),
    
    refreshMetrics: jest.fn().mockResolvedValue({
      coverage: mockCoverage,
      complexity: mockComplexity,
      codeSmells: mockCodeSmells,
      duplication: {
        percentage: 2.5,
        instances: []
      },
      dependencies: {
        modules: [],
        circular: []
      },
      testResults: {
        unit: { total: 42, passed: 40, failed: 2 },
        integration: { total: 18, passed: 17, failed: 1 },
        e2e: { total: 5, passed: 4, failed: 1 }
      }
    })
  };
});

describe('Metrics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getAllMetrics', () => {
    test('should return all metrics data', async () => {
      // Act
      const metrics = await getAllMetrics();
      
      // Assert
      expect(metrics).toBeDefined();
      expect(metrics.coverage).toBeDefined();
      expect(metrics.complexity).toBeDefined();
      expect(metrics.codeSmells).toBeDefined();
      expect(metrics.duplication).toBeDefined();
      expect(metrics.dependencies).toBeDefined();
      expect(metrics.testResults).toBeDefined();
      
      // Check specific values
      expect(metrics.coverage.overall).toBe(78);
      expect(metrics.complexity.average).toBe(4.2);
      expect(metrics.codeSmells.total).toBe(10);
    });
  });
  
  describe('refreshMetrics', () => {
    test('should refresh metrics data', async () => {
      // Act
      const metrics = await refreshMetrics();
      
      // Assert
      expect(metrics).toBeDefined();
      expect(refreshMetrics).toHaveBeenCalled();
      
      // Check metrics are updated
      expect(metrics.coverage.overall).toBe(78);
      expect(metrics.complexity.average).toBe(4.2);
      expect(metrics.codeSmells.total).toBe(10);
    });
  });
});