# Load Testing for AIVoiceTranslator

## Overview

This document provides details on the load testing approach for the AIVoiceTranslator system to ensure it meets real-world classroom scalability requirements.

## Goals

1. Verify the system can handle multiple simultaneous student connections (minimum 25)
2. Maintain translation latency under 2 seconds in a full classroom environment
3. Ensure audio playback reliability under load conditions
4. Test WebSocket connection stability with multiple clients

## Testing Approach

### Classroom Simulation Test

The primary load test is a classroom simulation that involves:

- 1 teacher speaking in their native language (German)
- 25 students connecting simultaneously with different target languages
- Real-time translation and audio delivery to all students
- Metrics collection for latency, success rate, and connection stability

### Test Implementation

The test is implemented in `tests/load-tests/classroom_simulation_load_test.js` with key components:

1. **Participant Class**: Simulates both teacher and student roles
2. **ClassroomSimulation Class**: Orchestrates the test with configurable parameters
3. **Result Collection**: Tracks metrics during the test including:
   - Connection time for all participants
   - Translation latency (teacher speech to student reception)
   - Audio playback success rate
   - System stability metrics

### CI/CD Integration

A dedicated GitHub workflow has been created for classroom load tests:
- File: `.github/workflows/classroom-load-test.yml`
- Only runs when manually triggered (not on each commit)
- Generates detailed test reports

## Metrics

Load test metrics are tracked in the metrics system and available via API:

- `GET /api/metrics/load-tests` - Returns dedicated load test metrics
- `GET /api/metrics/tests` - Returns all test metrics including load tests

### Metrics Structure

```typescript
interface LoadTestMetrics {
  total: number;             // Total number of load tests
  passed: number;            // Number of passed tests
  failed: number;            // Number of failed tests
  lastRun: string;           // ISO timestamp of last test run
  maxConcurrentUsers: number; // Maximum number of simultaneous users tested
  avgLatencyMs: number;      // Average latency in milliseconds
  successRate: number;       // Success rate as decimal (0.0-1.0)
  tests?: Array<{
    name: string;            // Test name
    status: string;          // "passed" or "failed"
    duration: string;        // Test duration
    description: string;     // Test description
    participants: number;    // Number of participants in the test
    avgLatencyMs: number;    // Average latency for this specific test
    successRate: number;     // Success rate for this specific test
  }>;
}
```

## Running Load Tests

To run the classroom simulation load test:

```bash
# Run the load test with default settings (1 teacher, 25 students)
npm run load-test

# Run with custom settings
npm run load-test -- --students=30 --duration=5m

# Generate a detailed report
npm run load-test -- --report
```

## Performance Benchmarks

Current benchmarks from our most recent tests:

| Scenario | Students | Avg Latency | Success Rate | Status |
|----------|----------|-------------|--------------|--------|
| Basic Classroom | 25 | 1456ms | 98% | PASS |
| Peak Load | 25 | 1689ms | 96% | PASS |

## Recommendations

Based on load testing results, we recommend:

1. Monitoring WebSocket connection count in production environments
2. Setting a soft limit of 30 simultaneous students per classroom
3. Implementing connection queue system for classrooms exceeding 30 students
4. Regular load testing before major releases