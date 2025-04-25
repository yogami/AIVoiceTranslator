# AIVoiceTranslator Load Testing Guide

This document describes the load testing approach for the AIVoiceTranslator project, which is designed to simulate real classroom environments with multiple simultaneous users.

## Overview

The AIVoiceTranslator system is designed to support classroom environments where:
- A teacher speaks in one language (source language)
- Multiple students (up to 25+) receive translations in their preferred languages
- Translations must be delivered with low latency (under 2 seconds)
- Audio quality must be maintained for all users

Our load testing suite verifies these capabilities by simulating a realistic classroom scenario with configurable parameters.

## Classroom Simulation Load Test

The main load test (`classroom_simulation_load_test.js`) simulates:

- 1 teacher speaking German
- 25 students (configurable) listening in different languages
- Real-time WebSocket connections for all participants
- Continuous speech translation and audio delivery
- Performance monitoring and metrics collection

### Test Flow

1. Teacher and all students connect via WebSocket
2. All participants register their roles and language preferences
3. Teacher sends a series of German messages (simulating spoken content)
4. Each message is translated into student languages
5. Students receive translations in their respective languages
6. The system measures end-to-end latency and success rates
7. Results are analyzed against performance thresholds

### Key Metrics

The load test measures and reports on:

- **Connection Time**: How long it takes for each participant to connect
- **Translation Latency**: Time between teacher's message and student's translation
- **Success Rate**: Percentage of translations successfully delivered
- **Concurrency Handling**: System stability with many simultaneous connections
- **Resource Utilization**: CPU and memory usage during peak load

### Pass/Fail Criteria

The test automatically determines success based on these criteria:

- **Latency Requirement**: Average translation latency must be under 2000ms
- **Success Rate Requirement**: At least 95% of translations must be delivered
- **Stability**: No crashes or connection drops during the test

## Running Load Tests

### Local Execution

Run the load tests locally with:

```bash
# Run with default settings (25 students)
./run-load-tests.sh

# Run with custom server URL and student count
./run-load-tests.sh ws://your-server-url.com/ws 50
```

This requires:
1. The server running on localhost:5000 (or custom URL)
2. Node.js installed with required dependencies
3. Sufficient system resources (CPU/memory)

### GitHub Actions Execution

For testing against deployed environments, use the GitHub Actions workflow:

1. Go to the Actions tab in your GitHub repository
2. Select the "Classroom Load Test" workflow
3. Click "Run workflow"
4. Configure parameters:
   - Number of students (default: 25)
   - Test duration in seconds (default: 60)
5. Click "Run workflow" to start the test

Results will be available as artifacts after the test completes.

## Test Results

The test generates detailed results in JSON format, saved to the `test-results` directory. Results include:

- Individual stats for teacher and all students
- Connection times for all participants
- Translation latencies for each message
- Success/failure counts
- Overall test pass/fail determination

A summary is also printed to the console for quick analysis.

## When to Run Load Tests

These tests are resource-intensive and should be run:

- Before deploying to staging/production environments
- After major architectural changes
- When scaling to support more users
- When performance issues are suspected
- During capacity planning

**Do not** run load tests:
- In regular CI/CD pipelines for every commit
- On development environments with limited resources
- Without appropriate API rate limit considerations

## Technical Implementation

The load test is implemented using:

- Native WebSocket client connections in Node.js
- Simulated teacher and student participants
- Performance measurement using high-resolution timers
- Parallel connection handling
- Comprehensive error tracking and reporting

## Extending the Tests

To adapt the tests for your needs:

1. Modify the `CONFIG` object in `classroom_simulation_load_test.js`
2. Add new test messages or scenarios as needed
3. Adjust performance thresholds for your specific requirements
4. Create custom test variations for specific scenarios

## Troubleshooting

If load tests fail:

1. Check server logs for errors or exceptions
2. Verify WebSocket server is properly configured
3. Ensure sufficient system resources are available
4. Check for API rate limiting issues with external services
5. Examine detailed test results for specific failure points

## Future Improvements

Planned enhancements to the load testing suite:

1. Advanced network condition simulation (packet loss, latency)
2. Visual reporting dashboard for test results
3. Long-running stability tests (24+ hours)
4. Geographic distribution testing across multiple regions
5. Resource utilization tracking and graphing