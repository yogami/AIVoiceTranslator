#!/bin/bash

# Shell script to run load tests for AIVoiceTranslator
# Usage: ./run-load-tests.sh [--students=25] [--duration=3m] [--report]

# Default values
STUDENTS=25
DURATION="3m"
GENERATE_REPORT=false
REPORT_PATH="./load-test-reports"

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --students=*)
        STUDENTS="${arg#*=}"
        shift
        ;;
        --duration=*)
        DURATION="${arg#*=}"
        shift
        ;;
        --report)
        GENERATE_REPORT=true
        shift
        ;;
        *)
        # Unknown option
        echo "Unknown option: $arg"
        echo "Usage: ./run-load-tests.sh [--students=25] [--duration=3m] [--report]"
        exit 1
        ;;
    esac
done

# Create timestamp for test run
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_RUN_ID="load_test_${TIMESTAMP}"

# Ensure the report directory exists if generating a report
if [ "$GENERATE_REPORT" = true ]; then
    mkdir -p $REPORT_PATH
    echo "Report will be generated in $REPORT_PATH/$TEST_RUN_ID.json"
fi

# Display test configuration
echo "╔════════════════════════════════════════════╗"
echo "║   AIVoiceTranslator Classroom Load Test    ║"
echo "╚════════════════════════════════════════════╝"
echo
echo "Test Configuration:"
echo "- Students: $STUDENTS"
echo "- Duration: $DURATION"
echo "- Report: $([ "$GENERATE_REPORT" = true ] && echo "Yes" || echo "No")"
echo "- Test Run ID: $TEST_RUN_ID"
echo

# Run the load test
echo "Starting classroom simulation load test..."
echo

NODE_ENV=test node tests/load-tests/classroom_simulation_load_test.js \
    --students=$STUDENTS \
    --duration=$DURATION \
    $([ "$GENERATE_REPORT" = true ] && echo "--report=$REPORT_PATH/$TEST_RUN_ID.json")

# Check exit status
if [ $? -eq 0 ]; then
    echo
    echo "✅ Load test completed successfully!"
    
    # If report was generated, show path
    if [ "$GENERATE_REPORT" = true ]; then
        echo
        echo "📊 Report generated: $REPORT_PATH/$TEST_RUN_ID.json"
    fi
    
    # Update metrics
    echo
    echo "Updating metrics..."
    curl -s -X POST http://localhost:5000/api/metrics/refresh > /dev/null
    echo "✅ Metrics updated!"
else
    echo
    echo "❌ Load test failed!"
fi