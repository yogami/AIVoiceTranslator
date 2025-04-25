/**
 * AIVoiceTranslator Load Testing Suite
 * 
 * This script tests the WebSocket server's ability to handle
 * multiple concurrent connections by simulating 50 students
 * receiving translations simultaneously.
 * 
 * It measures:
 * 1. Connection success rate
 * 2. Message delivery success rate
 * 3. Average message delivery time
 * 4. System resource usage under load
 */

const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');

// Configuration
const NUM_CLIENTS = 50;  // Number of concurrent clients to simulate
const TEST_DURATION = 60000;  // Test duration in milliseconds (1 minute)
const REPORT_INTERVAL = 5000;  // Status reporting interval in milliseconds
const CONNECTION_DELAY = 100;  // Delay between client connections to avoid server floods

// Get the WebSocket URL from environment or use localhost
const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws';

// Test settings
const TEST_LANGUAGES = [
  'es', 'fr', 'de', 'it', 'zh', 'ja', 'ru', 'ar', 'hi', 'pt'
];

// Sample text to use in translation requests (short to minimize costs)
const SAMPLE_TEXTS = [
  'Hello, welcome to our class.',
  'Today we will learn about science.',
  'Please open your textbooks.',
  'Can anyone answer this question?',
  'Let\'s review the homework.',
];

// Metrics storage
const metrics = {
  connections: {
    attempted: 0,
    successful: 0,
    failed: 0,
    active: 0,
  },
  messages: {
    sent: 0,
    received: 0,
    failed: 0,
    deliveryTimes: [],
  },
  errors: {},
  ttsServices: {
    browser: {
      requests: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0,
    },
    openai: {
      requests: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0,
    },
  },
};

// Resource usage tracking
let initialMemoryUsage = process.memoryUsage();
let peakMemoryUsage = initialMemoryUsage;
let initialCpuUsage = process.cpuUsage();

// Client tracking
const clients = [];

/**
 * Create and connect a simulated student client
 * @param {number} id - Client identifier
 * @returns {Promise<WebSocket>} - Connected WebSocket client
 */
function createClient(id) {
  return new Promise((resolve, reject) => {
    metrics.connections.attempted++;
    
    // Create a new WebSocket connection
    const socket = new WebSocket(WS_URL);
    const clientInfo = {
      id,
      socket,
      connected: false,
      sessionId: null,
      language: TEST_LANGUAGES[id % TEST_LANGUAGES.length],
      messagesReceived: 0,
      ttsService: id % 2 === 0 ? 'browser' : 'openai', // Alternate between browser and OpenAI TTS
    };
    
    // Setup event handlers
    socket.on('open', () => {
      clientInfo.connected = true;
      metrics.connections.successful++;
      metrics.connections.active++;
      
      // Register as student with language preference
      registerAsStudent(socket, clientInfo);
      resolve(clientInfo);
    });
    
    socket.on('message', data => {
      const message = JSON.parse(data);
      
      if (message.type === 'connection' && message.sessionId) {
        clientInfo.sessionId = message.sessionId;
        console.log(`Client ${id} connected with session ID: ${message.sessionId}`);
      }
      
      if (message.type === 'translation') {
        clientInfo.messagesReceived++;
        metrics.messages.received++;
        
        // Track TTS service performance
        if (message.ttsService === 'browser') {
          metrics.ttsServices.browser.successes++;
        } else if (message.ttsService === 'openai') {
          metrics.ttsServices.openai.successes++;
        }
      }
      
      // Calculate delivery time for messages that have timestamps
      if (message.timestamp) {
        const deliveryTime = Date.now() - message.timestamp;
        metrics.messages.deliveryTimes.push(deliveryTime);
      }
    });
    
    socket.on('close', () => {
      clientInfo.connected = false;
      metrics.connections.active--;
      console.log(`Client ${id} disconnected`);
    });
    
    socket.on('error', err => {
      metrics.connections.failed++;
      const errorMessage = err.toString();
      
      // Aggregate similar errors
      if (metrics.errors[errorMessage]) {
        metrics.errors[errorMessage]++;
      } else {
        metrics.errors[errorMessage] = 1;
      }
      
      console.error(`Client ${id} error: ${errorMessage}`);
      reject(err);
    });
    
    // Add to client list
    clients.push(clientInfo);
  });
}

/**
 * Register a client as a student with the server
 * @param {WebSocket} socket - WebSocket connection
 * @param {Object} clientInfo - Client information
 */
function registerAsStudent(socket, clientInfo) {
  // Register as a student with the chosen language
  const registerMessage = {
    type: 'register',
    role: 'student',
    languageCode: clientInfo.language,
    ttsService: clientInfo.ttsService,
  };
  
  socket.send(JSON.stringify(registerMessage));
}

/**
 * Track and update resource usage metrics
 */
function updateResourceMetrics() {
  const memoryUsage = process.memoryUsage();
  
  // Update peak memory usage if current is higher
  if (memoryUsage.rss > peakMemoryUsage.rss) {
    peakMemoryUsage = memoryUsage;
  }
  
  return {
    memory: {
      current: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      },
      peak: {
        rss: Math.round(peakMemoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(peakMemoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(peakMemoryUsage.heapUsed / 1024 / 1024), // MB
      },
    },
    cpu: calculateCpuUsagePercent(),
  };
}

/**
 * Calculate CPU usage as a percentage
 * @returns {number} - CPU usage percentage
 */
function calculateCpuUsagePercent() {
  const currentCpuUsage = process.cpuUsage(initialCpuUsage);
  const totalCpuTime = currentCpuUsage.user + currentCpuUsage.system;
  
  // Roughly estimate CPU percentage (this is an approximation)
  return Math.round((totalCpuTime / (os.cpus().length * 1000)) * 100) / 100;
}

/**
 * Display current test status
 * @param {boolean} final - Whether this is the final report
 */
function displayStatus(final = false) {
  const resourceMetrics = updateResourceMetrics();
  const avgDeliveryTime = metrics.messages.deliveryTimes.length > 0 ? 
    (metrics.messages.deliveryTimes.reduce((a, b) => a + b, 0) / metrics.messages.deliveryTimes.length).toFixed(2) :
    'N/A';
  
  console.log('\n----- AIVoiceTranslator Load Test Status -----');
  console.log(`Active Connections: ${metrics.connections.active}/${NUM_CLIENTS}`);
  console.log(`Connection Success Rate: ${((metrics.connections.successful / metrics.connections.attempted) * 100).toFixed(2)}%`);
  console.log(`Messages Received: ${metrics.messages.received}`);
  console.log(`Average Message Delivery Time: ${avgDeliveryTime}ms`);
  console.log('\nTTS Service Performance:');
  console.log(`Browser TTS: ${metrics.ttsServices.browser.successes} successes`);
  console.log(`OpenAI TTS: ${metrics.ttsServices.openai.successes} successes`);
  console.log('\nResource Usage:');
  console.log(`Memory: ${resourceMetrics.memory.current.rss}MB (Peak: ${resourceMetrics.memory.peak.rss}MB)`);
  console.log(`CPU: ~${resourceMetrics.cpu}%`);
  
  if (final) {
    console.log('\n----- Test Complete -----');
    console.log(`Duration: ${TEST_DURATION/1000} seconds`);
    console.log(`Total Clients: ${NUM_CLIENTS}`);
    console.log(`Connection Success Rate: ${((metrics.connections.successful / metrics.connections.attempted) * 100).toFixed(2)}%`);
    console.log(`Message Delivery Rate: ${metrics.messages.received} messages received`);
    console.log(`Average Delivery Time: ${avgDeliveryTime}ms`);
    
    // Write results to file
    const resultPath = 'tests/load-testing/results.json';
    const results = {
      timestamp: new Date().toISOString(),
      configuration: {
        numClients: NUM_CLIENTS,
        testDuration: TEST_DURATION,
        wsUrl: WS_URL,
      },
      metrics: {
        connections: metrics.connections,
        messages: {
          received: metrics.messages.received,
          avgDeliveryTime: parseFloat(avgDeliveryTime) || 0,
        },
        ttsServices: metrics.ttsServices,
        resources: resourceMetrics,
      },
    };
    
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results written to ${resultPath}`);
  }
}

/**
 * Main test function
 */
async function runLoadTest() {
  console.log(`Starting load test with ${NUM_CLIENTS} clients for ${TEST_DURATION/1000} seconds`);
  console.log(`WebSocket server: ${WS_URL}`);
  
  // Create clients with delay to avoid overwhelming the server
  for (let i = 0; i < NUM_CLIENTS; i++) {
    try {
      setTimeout(async () => {
        await createClient(i);
      }, i * CONNECTION_DELAY);
    } catch (error) {
      console.error(`Failed to create client ${i}:`, error);
    }
  }
  
  // Set up status reporting interval
  const statusInterval = setInterval(() => {
    displayStatus();
  }, REPORT_INTERVAL);
  
  // Set test end timer
  setTimeout(() => {
    // Clean up
    clearInterval(statusInterval);
    
    // Display final status
    displayStatus(true);
    
    // Close all connections
    clients.forEach(client => {
      if (client.socket && client.connected) {
        client.socket.close();
      }
    });
    
    console.log('Load test completed');
  }, TEST_DURATION);
}

// Run the test if this script is executed directly
if (require.main === module) {
  runLoadTest();
}

module.exports = {
  runLoadTest,
  createClient,
};