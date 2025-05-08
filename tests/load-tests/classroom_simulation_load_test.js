/**
 * Classroom Simulation Load Test
 * 
 * This test simulates a real classroom environment with:
 * - 1 teacher speaking German
 * - 25 students listening in different languages simultaneously
 * 
 * The test measures:
 * - Connection time for all participants
 * - Translation latency (time from teacher speech to student reception)
 * - Audio playback success rate
 * - System stability under load
 * 
 * Run this test only for staging/production deployments.
 * Not recommended for regular CI/CD pipeline due to resource intensity.
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Test configuration
const CONFIG = {
  // Connection settings
  serverUrl: process.env.TEST_SERVER_URL || 'ws://localhost:5000/ws',
  numStudents: 25,
  connectionTimeoutMs: 5000,
  
  // Test duration
  testDurationMs: 60000, // 1 minute by default
  
  // Teacher settings
  teacherLanguage: 'de-DE', // German
  
  // Available student languages
  studentLanguages: [
    'en-US',   // English (US)
    'en-GB',   // English (UK)
    'es-ES',   // Spanish
    'fr-FR',   // French
    'it-IT',   // Italian
    'pt-BR',   // Portuguese
    'ru-RU',   // Russian
    'ja-JP',   // Japanese
    'zh-CN',   // Chinese (Simplified)
    'ar-SA',   // Arabic
    'hi-IN',   // Hindi
    'ko-KR',   // Korean
    'tr-TR',   // Turkish
    'pl-PL',   // Polish
    'nl-NL',   // Dutch
    'sv-SE',   // Swedish
    'vi-VN',   // Vietnamese
    'th-TH',   // Thai
    'id-ID',   // Indonesian
    'uk-UA',   // Ukrainian
    'cs-CZ',   // Czech
    'ro-RO',   // Romanian
    'bg-BG',   // Bulgarian
    'el-GR',   // Greek
    'hu-HU',   // Hungarian
  ],
  
  // Test messages (in German)
  testMessages: [
    "Guten Morgen, liebe Schülerinnen und Schüler. Heute werden wir über nachhaltige Energie sprechen.",
    "Die Sonne ist eine erneuerbare Energiequelle, die uns unbegrenzt zur Verfügung steht.",
    "Wind- und Wasserkraft sind ebenfalls wichtige Formen erneuerbarer Energie.",
    "Fossile Brennstoffe wie Kohle und Öl tragen zur globalen Erwärmung bei.",
    "Jeder von uns kann durch seinen Lebensstil zum Klimaschutz beitragen.",
    "Bitte schreibt eure Gedanken zu diesem Thema in euren Heften auf.",
    "In der nächsten Woche werden wir eine Klassenarbeit über dieses Thema schreiben.",
    "Hat jemand eine Frage zu diesem Thema?",
    "Vielen Dank für eure Aufmerksamkeit."
  ],
  
  // Performance thresholds
  maxLatencyMs: 2000, // 2 seconds max translation latency
  minSuccessRate: 0.95, // 95% success rate
};

// Class to manage a single WebSocket connection (teacher or student)
class Participant {
  constructor(role, languageCode, name) {
    this.id = uuidv4();
    this.role = role;
    this.languageCode = languageCode;
    this.name = name;
    this.connected = false;
    this.socket = null;
    this.messagesReceived = 0;
    this.translationsReceived = 0;
    this.audioPlaybacks = 0;
    this.errors = [];
    this.connectionStartTime = null;
    this.connectionTime = null;
    this.latencies = [];
    this.lastMessageSentTime = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.connectionStartTime = performance.now();
        this.socket = new WebSocket(CONFIG.serverUrl);
        
        // Set up timeout
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            const error = new Error(`Connection timeout for ${this.role} ${this.name}`);
            this.errors.push(error);
            reject(error);
          }
        }, CONFIG.connectionTimeoutMs);
        
        // Connection opened
        this.socket.on('open', () => {
          this.connected = true;
          this.connectionTime = performance.now() - this.connectionStartTime;
          clearTimeout(connectionTimeout);
          
          // Register role and language
          this.register();
          
          resolve(this);
        });
        
        // Listen for messages
        this.socket.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.handleMessage(message);
          } catch (err) {
            this.errors.push(new Error(`Failed to parse message: ${err.message}`));
          }
        });
        
        // Handle errors
        this.socket.on('error', (error) => {
          this.errors.push(new Error(`WebSocket error: ${error.message}`));
          if (!this.connected) {
            clearTimeout(connectionTimeout);
            reject(error);
          }
        });
        
        // Handle disconnection
        this.socket.on('close', () => {
          this.connected = false;
        });
        
      } catch (error) {
        this.errors.push(error);
        reject(error);
      }
    });
  }
  
  register() {
    if (!this.connected) return;
    
    const registerMessage = {
      type: 'register',
      role: this.role,
      languageCode: this.languageCode,
      name: this.name
    };
    
    this.socket.send(JSON.stringify(registerMessage));
  }
  
  sendTranscription(text) {
    if (!this.connected || this.role !== 'teacher') return;
    
    const message = {
      type: 'transcription',
      text: text,
      sourceLanguage: this.languageCode
    };
    
    this.lastMessageSentTime = performance.now();
    this.socket.send(JSON.stringify(message));
  }
  
  handleMessage(message) {
    this.messagesReceived++;
    
    // Handle different message types
    switch (message.type) {
      case 'connection':
        // Connection confirmation received
        break;
        
      case 'translation':
        // Translation received (for students)
        if (this.role === 'student') {
          this.translationsReceived++;
          
          // Calculate latency if this is a response to teacher's message
          if (message.originalText && message.text) {
            const receivedTime = performance.now();
            // Use a shared timestamp from classroom for latency calculation
            if (this.classroom && this.classroom.lastTeacherMessageTime) {
              const latency = receivedTime - this.classroom.lastTeacherMessageTime;
              this.latencies.push(latency);
            }
          }
          
          // Count audio playbacks (either method)
          if (message.audioData || message.useClientSpeech) {
            this.audioPlaybacks++;
          }
        }
        break;
        
      default:
        // Other messages
        break;
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.connected = false;
    }
  }
  
  getStats() {
    return {
      id: this.id,
      role: this.role,
      languageCode: this.languageCode,
      name: this.name,
      connected: this.connected,
      connectionTime: this.connectionTime,
      messagesReceived: this.messagesReceived,
      translationsReceived: this.translationsReceived,
      audioPlaybacks: this.audioPlaybacks,
      avgLatencyMs: this.latencies.length > 0 
        ? this.latencies.reduce((sum, val) => sum + val, 0) / this.latencies.length 
        : null,
      errors: this.errors.map(e => e.message)
    };
  }
}

// Class to manage the entire classroom
class ClassroomSimulation {
  constructor() {
    this.teacher = null;
    this.students = [];
    this.startTime = null;
    this.testDuration = CONFIG.testDurationMs;
    this.lastTeacherMessageTime = null;
    this.testMessages = [...CONFIG.testMessages]; // Clone messages
    this.running = false;
    this.testInterval = null;
    this.results = {
      startTime: null,
      endTime: null,
      teacherStats: null,
      studentStats: [],
      overallStats: {
        avgConnectionTimeMs: null,
        avgLatencyMs: null,
        successRate: null,
        completedMessages: 0,
        totalParticipants: 0,
        connectedParticipants: 0
      }
    };
  }
  
  async setup() {
    console.log('Setting up classroom simulation...');
    
    // Create teacher (speaking German)
    this.teacher = new Participant('teacher', CONFIG.teacherLanguage, 'TestTeacher');
    this.teacher.classroom = this;
    
    // Create students with random languages
    for (let i = 0; i < CONFIG.numStudents; i++) {
      // Select random language from available languages
      const randomIndex = Math.floor(Math.random() * CONFIG.studentLanguages.length);
      const languageCode = CONFIG.studentLanguages[randomIndex];
      
      const student = new Participant('student', languageCode, `Student${i+1}`);
      student.classroom = this;
      this.students.push(student);
    }
    
    console.log(`Created 1 teacher and ${this.students.length} students with diverse languages`);
  }
  
  async connect() {
    console.log('Connecting all participants...');
    
    try {
      // Connect teacher first
      await this.teacher.connect();
      console.log(`Teacher connected (${this.teacher.languageCode})`);
      
      // Connect all students (in parallel)
      const connectionPromises = this.students.map(async (student, index) => {
        try {
          await student.connect();
          process.stdout.write(`.`); // Progress indicator
          if ((index + 1) % 10 === 0) process.stdout.write('\n');
          return true;
        } catch (error) {
          console.error(`Failed to connect student ${student.name}: ${error.message}`);
          return false;
        }
      });
      
      const results = await Promise.allSettled(connectionPromises);
      const connectedCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      
      console.log(`\nConnected ${connectedCount}/${this.students.length} students`);
      
      if (connectedCount < (CONFIG.numStudents * 0.8)) {
        throw new Error(`Too few students connected (${connectedCount}/${CONFIG.numStudents})`);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to connect classroom: ${error.message}`);
      return false;
    }
  }
  
  async start() {
    if (!this.teacher.connected) {
      throw new Error('Teacher not connected. Cannot start test.');
    }
    
    const connectedStudents = this.students.filter(s => s.connected);
    if (connectedStudents.length === 0) {
      throw new Error('No students connected. Cannot start test.');
    }
    
    console.log(`\n\nStarting classroom simulation with ${connectedStudents.length} students...`);
    this.startTime = Date.now();
    this.results.startTime = new Date().toISOString();
    this.running = true;
    
    // Send messages at regular intervals
    let messageIndex = 0;
    this.testInterval = setInterval(() => {
      if (messageIndex >= this.testMessages.length) {
        // We've sent all messages, stop the test
        this.stop();
        return;
      }
      
      const message = this.testMessages[messageIndex];
      console.log(`\nTeacher (${messageIndex + 1}/${this.testMessages.length}): "${message}"`);
      
      // Record timestamp for latency calculation
      this.lastTeacherMessageTime = performance.now();
      
      // Send the message
      this.teacher.sendTranscription(message);
      messageIndex++;
      
      // Track completed messages
      this.results.overallStats.completedMessages = messageIndex;
      
    }, 5000); // Send a new message every 5 seconds
    
    // Set a timeout to end the test
    setTimeout(() => {
      if (this.running) {
        this.stop();
      }
    }, this.testDuration);
    
    return true;
  }
  
  stop() {
    if (!this.running) return;
    
    console.log('\n\nStopping classroom simulation...');
    this.running = false;
    
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
    }
    
    this.results.endTime = new Date().toISOString();
    this.collectResults();
    
    // Disconnect all participants
    this.teacher.disconnect();
    this.students.forEach(student => student.disconnect());
    
    console.log('Classroom simulation completed');
  }
  
  collectResults() {
    console.log('Collecting test results...');
    
    // Collect teacher stats
    this.results.teacherStats = this.teacher.getStats();
    
    // Collect student stats
    this.results.studentStats = this.students.map(student => student.getStats());
    
    // Calculate overall stats
    const connectedStudents = this.results.studentStats.filter(s => s.connected);
    
    // Connection times
    const allConnectionTimes = [
      this.results.teacherStats.connectionTime,
      ...connectedStudents.map(s => s.connectionTime)
    ].filter(Boolean);
    
    this.results.overallStats.avgConnectionTimeMs = 
      allConnectionTimes.length > 0 
        ? allConnectionTimes.reduce((sum, time) => sum + time, 0) / allConnectionTimes.length 
        : null;
    
    // Latency
    const allLatencies = connectedStudents
      .map(s => s.avgLatencyMs)
      .filter(Boolean);
    
    this.results.overallStats.avgLatencyMs = 
      allLatencies.length > 0 
        ? allLatencies.reduce((sum, latency) => sum + latency, 0) / allLatencies.length 
        : null;
    
    // Success rate (translations received vs expected)
    const expectedTranslations = this.results.overallStats.completedMessages;
    const totalExpected = connectedStudents.length * expectedTranslations;
    const totalReceived = connectedStudents.reduce((sum, s) => sum + s.translationsReceived, 0);
    
    this.results.overallStats.successRate = 
      totalExpected > 0 ? totalReceived / totalExpected : 0;
    
    // Participant counts
    this.results.overallStats.totalParticipants = 1 + this.students.length; // Teacher + students
    this.results.overallStats.connectedParticipants = 1 + connectedStudents.length; // Connected teacher + students
    
    // Print summary
    this.printResultSummary();
    
    // Save results to file
    this.saveResultsToFile();
  }
  
  printResultSummary() {
    const stats = this.results.overallStats;
    const testDurationSec = (new Date(this.results.endTime) - new Date(this.results.startTime)) / 1000;
    
    console.log('\n============================================');
    console.log('         CLASSROOM SIMULATION RESULTS        ');
    console.log('============================================');
    console.log(`Test Duration: ${testDurationSec.toFixed(1)} seconds`);
    console.log(`Connected Participants: ${stats.connectedParticipants}/${stats.totalParticipants}`);
    console.log(`Messages Sent: ${stats.completedMessages}/${CONFIG.testMessages.length}`);
    console.log(`Avg. Connection Time: ${stats.avgConnectionTimeMs ? `${stats.avgConnectionTimeMs.toFixed(1)} ms` : 'N/A'}`);
    console.log(`Avg. Translation Latency: ${stats.avgLatencyMs ? `${stats.avgLatencyMs.toFixed(1)} ms` : 'N/A'}`);
    console.log(`Translation Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
    
    // Test pass/fail criteria
    const latencyOK = !stats.avgLatencyMs || stats.avgLatencyMs <= CONFIG.maxLatencyMs;
    const successRateOK = stats.successRate >= CONFIG.minSuccessRate;
    const testPassed = latencyOK && successRateOK;
    
    console.log('\nTest Result:');
    console.log(`- Latency Requirement (< ${CONFIG.maxLatencyMs} ms): ${latencyOK ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`- Success Rate Requirement (> ${CONFIG.minSuccessRate * 100}%): ${successRateOK ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`\nOverall: ${testPassed ? '✓ PASS' : '✗ FAIL'}`);
    console.log('============================================');
  }
  
  saveResultsToFile() {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const resultsDir = path.join(__dirname, '../../test-results');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      const filePath = path.join(resultsDir, `classroom-simulation-${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
      
      console.log(`\nDetailed results saved to: ${filePath}`);
    } catch (error) {
      console.error(`Failed to save results: ${error.message}`);
    }
  }
}

// Main function to run the test
async function runClassroomSimulation() {
  try {
    console.log('=================================================');
    console.log('  CLASSROOM SIMULATION LOAD TEST - STARTING UP');
    console.log('=================================================');
    console.log(`Server: ${CONFIG.serverUrl}`);
    console.log(`Students: ${CONFIG.numStudents}`);
    console.log(`Teacher Language: ${CONFIG.teacherLanguage}`);
    console.log(`Test Duration: ${CONFIG.testDurationMs / 1000} seconds`);
    console.log('=================================================\n');
    
    const classroom = new ClassroomSimulation();
    
    // Setup the classroom
    await classroom.setup();
    
    // Connect all participants
    const connected = await classroom.connect();
    if (!connected) {
      throw new Error('Failed to connect participants. Aborting test.');
    }
    
    // Start the simulation
    await classroom.start();
    
    // The test will stop automatically
    return true;
  } catch (error) {
    console.error(`\nClassroom simulation failed: ${error.message}`);
    return false;
  }
}

// Run the test if executed directly
if (require.main === module) {
  (async () => {
    try {
      const success = await runClassroomSimulation();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Unhandled error:', error);
      process.exit(1);
    }
  })();
}

module.exports = { runClassroomSimulation, ClassroomSimulation, Participant };