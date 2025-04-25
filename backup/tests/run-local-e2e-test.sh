#!/bin/bash
# Run local E2E Selenium test for Benedictaitor
# This script automates the setup and execution of E2E tests

# ANSI color codes for formatting output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}     Benedictaitor End-to-End Testing Script        ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# Check if OpenAI API key is set (needed for test audio generation)
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${YELLOW}Warning: OPENAI_API_KEY is not set.${NC}"
  echo -e "If you want to generate test audio, please set it with:"
  echo -e "  export OPENAI_API_KEY=your_api_key_here"
  echo ""
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is not installed.${NC}"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed.${NC}"
  echo "Please install npm which usually comes with Node.js"
  exit 1
fi

# Check if Python is available
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
  PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
  PYTHON_CMD="python"
else
  echo -e "${YELLOW}Warning: Python is not installed.${NC}"
  echo "Python is needed if you want to run the Python version of the test."
  echo "JavaScript tests will still work."
fi

# Function to check if required npm packages are installed
function check_npm_packages() {
  echo -e "${BLUE}Checking required npm packages...${NC}"
  
  local packages=("selenium-webdriver" "chromedriver" "openai")
  local missing_packages=()
  
  for pkg in "${packages[@]}"; do
    if ! npm list -g $pkg &> /dev/null && ! npm list $pkg &> /dev/null; then
      missing_packages+=($pkg)
    fi
  done
  
  if [ ${#missing_packages[@]} -gt 0 ]; then
    echo -e "${YELLOW}Installing missing packages: ${missing_packages[*]}${NC}"
    npm install "${missing_packages[@]}" --save-dev
  else
    echo -e "${GREEN}All required npm packages are installed.${NC}"
  fi
}

# Function to check if required Python packages are installed
function check_python_packages() {
  if [ -n "$PYTHON_CMD" ]; then
    echo -e "${BLUE}Checking required Python packages...${NC}"
    
    if ! $PYTHON_CMD -c "import selenium" 2>/dev/null || ! $PYTHON_CMD -c "import webdriver_manager" 2>/dev/null; then
      echo -e "${YELLOW}Installing required Python packages...${NC}"
      $PYTHON_CMD -m pip install selenium webdriver-manager
    else
      echo -e "${GREEN}All required Python packages are installed.${NC}"
    fi
  fi
}

# Function to generate test audio
function generate_test_audio() {
  if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "${BLUE}Generating test audio file...${NC}"
    
    if [ -f "test-audio.mp3" ]; then
      echo -e "${YELLOW}Test audio file already exists. Using existing file.${NC}"
    else
      node setup-test-audio.js
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}Test audio generated successfully!${NC}"
      else
        echo -e "${RED}Error generating test audio.${NC}"
        echo "Continuing with tests, but speech recognition may not work properly."
      fi
    fi
  else
    echo -e "${YELLOW}Skipping test audio generation (OPENAI_API_KEY not set).${NC}"
    echo "If you already have test audio, the tests can still run."
  fi
}

# Main menu function
function show_menu() {
  echo ""
  echo -e "${BLUE}Choose a test to run:${NC}"
  echo "1) JavaScript E2E Test (recommended)"
  echo "2) Python E2E Test"
  echo "3) Generate Test Audio Only"
  echo "4) Install Dependencies Only"
  echo "q) Quit"
  echo ""
  read -p "Enter your choice: " choice
  
  case $choice in
    1)
      run_js_test
      ;;
    2)
      run_python_test
      ;;
    3)
      generate_test_audio
      show_menu
      ;;
    4)
      check_npm_packages
      check_python_packages
      show_menu
      ;;
    q|Q)
      echo -e "${GREEN}Exiting. Goodbye!${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid choice. Please try again.${NC}"
      show_menu
      ;;
  esac
}

# Function to run JavaScript test
function run_js_test() {
  echo -e "${BLUE}Preparing to run JavaScript E2E test...${NC}"
  check_npm_packages
  generate_test_audio
  
  echo -e "${BLUE}Running JavaScript E2E test...${NC}"
  echo -e "${YELLOW}Note: This will open a Chrome browser window.${NC}"
  echo -e "${YELLOW}Please do not interact with the browser during the test.${NC}"
  echo ""
  
  node full-e2e-test.js
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}JavaScript E2E test completed successfully!${NC}"
    echo "Check the screenshots for visual verification."
  else
    echo -e "${RED}JavaScript E2E test failed.${NC}"
    echo "Check the error messages for more information."
  fi
  
  echo ""
  read -p "Press Enter to continue..."
  show_menu
}

# Function to run Python test
function run_python_test() {
  if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}Error: Python is not installed.${NC}"
    echo "Please install Python to run this test."
    echo ""
    read -p "Press Enter to continue..."
    show_menu
    return
  fi
  
  echo -e "${BLUE}Preparing to run Python E2E test...${NC}"
  check_python_packages
  generate_test_audio
  
  echo -e "${BLUE}Running Python E2E test...${NC}"
  echo -e "${YELLOW}Note: This will open a Chrome browser window.${NC}"
  echo -e "${YELLOW}Please do not interact with the browser during the test.${NC}"
  echo ""
  
  $PYTHON_CMD python_full_e2e_test.py
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Python E2E test completed successfully!${NC}"
    echo "Check the screenshots for visual verification."
  else
    echo -e "${RED}Python E2E test failed.${NC}"
    echo "Check the error messages for more information."
  fi
  
  echo ""
  read -p "Press Enter to continue..."
  show_menu
}

# Start the script
echo -e "${BLUE}Checking environment...${NC}"

# Make sure we're in the right directory
if [ ! -f "full-e2e-test-guide.md" ] || [ ! -f "setup-test-audio.js" ] || [ ! -f "python_full_e2e_test.py" ]; then
  echo -e "${YELLOW}Warning: Some test files are missing.${NC}"
  echo "Make sure you're running this script from the directory containing the E2E test files."
  echo "If you haven't extracted the e2e-selenium-tests.zip file, please do so first."
fi

# Show the menu
show_menu