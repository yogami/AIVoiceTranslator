#!/bin/bash

# Run the audio e2e tests
cd tests/selenium
node audio-e2e-test.js

# Return the exit code from the test
exit $?