#!/bin/bash

# Run the audio e2e tests using Mocha
cd tests/selenium
npx mocha audio-e2e-test.js --timeout 60000

# Return the exit code from the test
exit $?