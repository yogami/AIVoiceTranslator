/**
 * Simple test script for metrics API
 * 
 * This script tests the metrics API endpoints without using Jest
 * to avoid timeouts and other issues in the Replit environment.
 */

const http = require('http');

// Test configuration
const HOST = 'localhost';
const PORT = process.env.PORT || 3000;
const API_BASE = '/api';

/**
 * Make an HTTP request to the API
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API path
 * @returns {Promise<object>} - Response data
 */
function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      host: HOST,
      port: PORT,
      path: `${API_BASE}${path}`,
      method: method
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== Testing Metrics API ===');
  
  try {
    // Test 1: Get all metrics
    console.log('\nTest 1: Get all metrics');
    const allMetricsResponse = await makeRequest('GET', '/metrics');
    if (allMetricsResponse.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${allMetricsResponse.statusCode}`);
    }
    
    console.log('✓ Status code is 200');
    
    const allMetrics = allMetricsResponse.data;
    if (!allMetrics.coverage || !allMetrics.complexity || !allMetrics.codeSmells) {
      throw new Error('Response is missing expected metrics');
    }
    
    console.log('✓ Response contains coverage, complexity, and code smells metrics');
    console.log(`  - Overall coverage: ${allMetrics.coverage.overall}%`);
    console.log(`  - Average complexity: ${allMetrics.complexity.average}`);
    console.log(`  - Code smells: ${allMetrics.codeSmells.total}`);
    
    // Test 2: Get coverage metrics
    console.log('\nTest 2: Get coverage metrics');
    const coverageResponse = await makeRequest('GET', '/metrics/coverage');
    if (coverageResponse.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${coverageResponse.statusCode}`);
    }
    
    console.log('✓ Status code is 200');
    
    const coverage = coverageResponse.data;
    if (typeof coverage.overall !== 'number') {
      throw new Error('Coverage metrics are invalid');
    }
    
    console.log('✓ Coverage metrics are valid');
    console.log(`  - Overall coverage: ${coverage.overall}%`);
    console.log(`  - Line coverage: ${coverage.line}%`);
    console.log(`  - Function coverage: ${coverage.function}%`);
    
    // Test 3: Get complexity metrics
    console.log('\nTest 3: Get complexity metrics');
    const complexityResponse = await makeRequest('GET', '/metrics/complexity');
    if (complexityResponse.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${complexityResponse.statusCode}`);
    }
    
    console.log('✓ Status code is 200');
    
    const complexity = complexityResponse.data;
    if (typeof complexity.average !== 'number') {
      throw new Error('Complexity metrics are invalid');
    }
    
    console.log('✓ Complexity metrics are valid');
    console.log(`  - Average complexity: ${complexity.average}`);
    console.log(`  - Max complexity: ${complexity.max}`);
    console.log(`  - Average function length: ${complexity.functionLength.average} lines`);
    
    // Test 4: Refresh metrics
    console.log('\nTest 4: Refresh metrics');
    const refreshResponse = await makeRequest('POST', '/metrics/refresh');
    if (refreshResponse.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${refreshResponse.statusCode}`);
    }
    
    console.log('✓ Status code is 200');
    
    const refreshedMetrics = refreshResponse.data;
    if (!refreshedMetrics.coverage || !refreshedMetrics.complexity || !refreshedMetrics.codeSmells) {
      throw new Error('Refreshed metrics are missing expected properties');
    }
    
    console.log('✓ Refreshed metrics are valid');
    console.log(`  - Overall coverage: ${refreshedMetrics.coverage.overall}%`);
    
    // Summary
    console.log('\n=== Tests completed successfully ===');
    console.log('All metrics API endpoints are working correctly');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();