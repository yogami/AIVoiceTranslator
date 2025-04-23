#!/bin/bash
# Absolute minimum script - No Node.js, no dependencies

echo "======================================="
echo "  Benedictaitor Test Runner (No-Deps)  "
echo "======================================="
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Function to check if Python is installed
check_python() {
  if command -v python3 >/dev/null 2>&1; then
    return 0
  elif command -v python >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Function to run a simple server
run_simple_server() {
  if check_python; then
    # Determine which Python command to use
    if command -v python3 >/dev/null 2>&1; then
      PY_CMD="python3"
    else
      PY_CMD="python"
    fi
    
    # Create a simple HTML file
    cat > simple_test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Benedictaitor Test Runner</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 20px;
      background-color: #f5f5f7;
    }
    header {
      background-color: #333;
      color: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
    }
    .test-button {
      background-color: #0071e3;
      color: white;
      border: none;
      padding: 10px 15px;
      margin: 5px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
    }
    .test-button:hover {
      background-color: #0077ed;
    }
    #output {
      background-color: #1e1e1e;
      color: #ddd;
      padding: 15px;
      border-radius: 6px;
      font-family: monospace;
      height: 300px;
      overflow-y: auto;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Benedictaitor Test Runner</h1>
  </header>
  
  <div>
    <button class="test-button" onclick="appendOutput('WebSocket connection test would be run here.')">WebSocket Test</button>
    <button class="test-button" onclick="appendOutput('Speech recognition test would be run here.')">Speech Test</button>
    <button class="test-button" onclick="appendOutput('Audio utilities test would be run here.')">Audio Utils Test</button>
    <button class="test-button" onclick="appendOutput('Selenium end-to-end test would be run here.')">E2E Test</button>
    <button class="test-button" onclick="appendOutput('Real hardware test would be run here.')">Hardware Test</button>
    <button class="test-button" onclick="document.getElementById('output').innerHTML = ''">Clear Output</button>
  </div>
  
  <div id="output">Welcome to Benedictaitor Test Runner.
Select a test to run from the buttons above.</div>

  <script>
    function appendOutput(text) {
      const output = document.getElementById('output');
      output.innerHTML += '<br>' + text;
      output.scrollTop = output.scrollHeight;
    }
  </script>
</body>
</html>
EOF
    
    # Start a simple HTTP server
    echo "Starting simple HTTP server on port 8000..."
    echo "Open your browser and go to: http://localhost:8000/simple_test.html"
    echo ""
    echo "Press Ctrl+C to stop the server"
    $PY_CMD -m http.server 8000 || $PY_CMD -m SimpleHTTPServer 8000
  else
    echo "Python is not installed. Cannot start simple server."
    return 1
  fi
}

# Main menu
echo "Select an option:"
echo "1. Start simple test runner in browser"
echo "2. Show available tests"
echo "3. Exit"
echo ""
echo "Enter option (1-3): "
read option

case $option in
  1)
    run_simple_server
    ;;
  2)
    echo "Available tests:"
    echo "- WebSocket Communication Tests"
    echo "- Speech Recognition Tests"
    echo "- Audio Utilities Tests"
    echo "- End-to-End Selenium Tests"
    echo "- Real Hardware Tests"
    echo ""
    echo "Note: To run these tests, you need Node.js installed."
    echo "Press Enter to continue..."
    read
    ;;
  3)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac