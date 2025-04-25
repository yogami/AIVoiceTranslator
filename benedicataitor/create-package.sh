#!/bin/bash
# Simple script to create a zip package of the Benedicataitor Student Interface

# Make sure the script is being run from the correct directory
if [ ! -f "index.html" ] || [ ! -f "README.md" ]; then
    echo "Error: This script must be run from the directory containing index.html and README.md"
    exit 1
fi

# Create a zip file
echo "Creating package..."
zip -r benedicataitor-student-interface.zip index.html js/ README.md QUICK-START.md test-server.js

echo ""
echo "Package created: benedicataitor-student-interface.zip"
echo "You can now send this file to anyone who needs to use the Benedicataitor Student Interface."
echo "The recipient just needs to unzip the file and open index.html in a browser."