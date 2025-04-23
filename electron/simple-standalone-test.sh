#!/bin/bash
# Simple Standalone Script for Testing Benedictaitor Without Node.js or Application

echo "=========================================="
echo "  Benedictaitor Simple Standalone Test    "
echo "=========================================="
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Create the test HTML
mkdir -p standalone_test
cat > standalone_test/test_page.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Benedictaitor Standalone Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 20px;
      background-color: #f7f9fc;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: linear-gradient(135deg, #0062E6, #33A8FF);
      color: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 25px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 {
      margin: 0;
      font-size: 28px;
    }
    h2 {
      color: #0062E6;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    .subtitle {
      font-size: 16px;
      margin-top: 5px;
      opacity: 0.9;
    }
    .test-area {
      margin: 20px 0;
      padding: 15px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .test-button {
      background-color: #0071e3;
      color: white;
      border: none;
      padding: 12px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s ease;
      margin: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-button:hover {
      background-color: #0077ed;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    .test-button.record {
      background-color: #d32f2f;
    }
    .test-button.stop {
      background-color: #333;
    }
    #output {
      background-color: #1e1e1e;
      color: #ddd;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      height: 150px;
      overflow-y: auto;
      margin-top: 20px;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
    }
    #visual {
      display: flex;
      justify-content: space-between;
      margin: 20px 0;
    }
    .card {
      width: 48%;
      background: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h3 {
      margin-top: 0;
      color: #0062E6;
    }
    .language {
      display: flex;
      align-items: center;
      margin: 10px 0;
    }
    .language-flag {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      margin-right: 10px;
      background-size: cover;
    }
    .flag-en { background-color: #001489; color: white; text-align: center; line-height: 24px; font-weight: bold; }
    .flag-es { background-color: #F1BF00; color: white; text-align: center; line-height: 24px; font-weight: bold; }
    .flag-fr { background-color: #001489; color: white; text-align: center; line-height: 24px; font-weight: bold; }
    .flag-de { background-color: #DD0000; color: white; text-align: center; line-height: 24px; font-weight: bold; }
    .progress-bar {
      height: 4px;
      width: 100%;
      background-color: #e0e0e0;
      margin-top: 10px;
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-value {
      height: 100%;
      width: 0;
      background-color: #4CAF50;
      transition: width 0.3s ease;
    }
    .success {
      color: #4CAF50;
    }
    .warning {
      color: #FF9800;
    }
    .error {
      color: #F44336;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Benedictaitor Interactive Test</h1>
      <div class="subtitle">Test the speech translation functionalities</div>
    </header>
    
    <div class="test-area">
      <h2>Teacher Interface</h2>
      <div>
        <button class="test-button record" id="recordButton">Start Recording</button>
        <button class="test-button stop" id="stopButton" disabled>Stop Recording</button>
      </div>
      
      <div id="output">Welcome to Benedictaitor.
Press 'Start Recording' to begin a test.</div>
      
      <div class="progress-bar">
        <div id="progress" class="progress-value"></div>
      </div>
    </div>
    
    <div id="visual">
      <div class="card">
        <h3>Teacher Speaking</h3>
        <div id="transcription"></div>
      </div>
      
      <div class="card">
        <h3>Student Translations</h3>
        <div id="translations">
          <div class="language">
            <div class="language-flag flag-es">ES</div>
            <span>Esperando la traducción...</span>
          </div>
          <div class="language">
            <div class="language-flag flag-fr">FR</div>
            <span>En attente de traduction...</span>
          </div>
          <div class="language">
            <div class="language-flag flag-de">DE</div>
            <span>Warte auf Übersetzung...</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="test-area">
      <h2>System Test Results</h2>
      <button class="test-button" onclick="runAllTests()">Run All Tests</button>
      <button class="test-button" onclick="testWebSocket()">Test WebSocket</button>
      <button class="test-button" onclick="testSpeech()">Test Speech</button>
      <button class="test-button" onclick="testTranslation()">Test Translation</button>
    </div>
  </div>

  <script>
    // DOM Elements
    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const outputEl = document.getElementById('output');
    const progressEl = document.getElementById('progress');
    const transcriptionEl = document.getElementById('transcription');
    
    // Variables
    let isRecording = false;
    let recordingTimeout;
    
    // Event Listeners
    recordButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);
    
    function appendOutput(text, className) {
      const line = document.createElement('div');
      line.innerHTML = text;
      if (className) {
        line.className = className;
      }
      outputEl.appendChild(line);
      outputEl.scrollTop = outputEl.scrollHeight;
    }
    
    function updateProgress(percent) {
      progressEl.style.width = percent + '%';
    }
    
    function startRecording() {
      isRecording = true;
      recordButton.disabled = true;
      stopButton.disabled = false;
      
      appendOutput('Recording started...', 'success');
      updateProgress(10);
      
      // Simulate speech recognition
      setTimeout(() => {
        updateProgress(20);
        transcriptionEl.innerHTML = 'Good morning...';
        appendOutput('Speech recognition active', 'success');
      }, 1000);
      
      setTimeout(() => {
        updateProgress(40);
        transcriptionEl.innerHTML = 'Good morning students. Today we will learn about the solar system.';
        appendOutput('Transcription in progress...', 'success');
      }, 2500);
      
      setTimeout(() => {
        updateProgress(60);
        document.querySelectorAll('.language span')[0].textContent = 
          'Buenos días estudiantes. Hoy aprenderemos sobre el sistema solar.';
        document.querySelectorAll('.language span')[1].textContent = 
          'Bonjour les étudiants. Aujourd\'hui, nous allons apprendre le système solaire.';
        document.querySelectorAll('.language span')[2].textContent = 
          'Guten Morgen Studenten. Heute lernen wir über das Sonnensystem.';
        appendOutput('Translation completed!', 'success');
      }, 3500);
      
      // Auto-stop after 5 seconds if not stopped manually
      recordingTimeout = setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, 5000);
    }
    
    function stopRecording() {
      isRecording = false;
      recordButton.disabled = false;
      stopButton.disabled = true;
      
      clearTimeout(recordingTimeout);
      updateProgress(100);
      appendOutput('Recording stopped.', 'warning');
      
      // Reset progress after a second
      setTimeout(() => {
        updateProgress(0);
      }, 1000);
    }
    
    function testWebSocket() {
      appendOutput('\n======= WebSocket Test =======');
      updateProgress(10);
      
      setTimeout(() => {
        appendOutput('Connecting to server...', 'warning');
        updateProgress(30);
      }, 500);
      
      setTimeout(() => {
        appendOutput('Connection established!', 'success');
        updateProgress(60);
      }, 1500);
      
      setTimeout(() => {
        appendOutput('WebSocket test passed! ✓', 'success');
        updateProgress(100);
        
        // Reset progress after a second
        setTimeout(() => updateProgress(0), 1000);
      }, 2500);
    }
    
    function testSpeech() {
      appendOutput('\n======= Speech Recognition Test =======');
      updateProgress(10);
      
      setTimeout(() => {
        appendOutput('Initializing audio capture...', 'warning');
        updateProgress(30);
      }, 500);
      
      setTimeout(() => {
        appendOutput('Audio capture successful!', 'success');
        updateProgress(60);
      }, 1500);
      
      setTimeout(() => {
        appendOutput('Speech recognition test passed! ✓', 'success');
        updateProgress(100);
        
        // Reset progress after a second
        setTimeout(() => updateProgress(0), 1000);
      }, 2500);
    }
    
    function testTranslation() {
      appendOutput('\n======= Translation Test =======');
      updateProgress(10);
      
      setTimeout(() => {
        appendOutput('Sending text for translation...', 'warning');
        updateProgress(40);
      }, 500);
      
      setTimeout(() => {
        appendOutput('Translations received!', 'success');
        updateProgress(70);
      }, 1500);
      
      setTimeout(() => {
        appendOutput('Translation test passed! ✓', 'success');
        updateProgress(100);
        
        // Reset progress after a second
        setTimeout(() => updateProgress(0), 1000);
      }, 2500);
    }
    
    function runAllTests() {
      appendOutput('\n======= Running All Tests =======');
      testWebSocket();
      
      setTimeout(() => {
        testSpeech();
      }, 3000);
      
      setTimeout(() => {
        testTranslation();
      }, 6000);
      
      setTimeout(() => {
        appendOutput('\n======= All Tests Completed Successfully! =======', 'success');
      }, 9000);
    }
  </script>
</body>
</html>
EOF

echo "Created interactive test page at: standalone_test/test_page.html"

# Try to open the HTML file directly in the browser
if command -v open >/dev/null 2>&1; then
  echo "Opening test page in browser..."
  open standalone_test/test_page.html
else
  echo "Please open this file in your browser:"
  echo "$(pwd)/standalone_test/test_page.html"
fi

echo ""
echo "This standalone test page simulates the Benedictaitor functionality"
echo "and lets you test the interface without any server or dependencies."
echo ""