#!/bin/bash
# AIVoiceTranslator Project Cleanup Script for Local Environment
# WARNING: This script removes files and directories. Use with caution.
# Run from the project root directory.

echo "Starting AIVoiceTranslator project cleanup for local environment..."

# Create a backup of important configuration files
echo "Creating backup of important configuration files..."
mkdir -p .cleanup_backup
cp package.json .cleanup_backup/
cp drizzle.config.ts .cleanup_backup/
cp tsconfig.json .cleanup_backup/
cp vite.config.ts .cleanup_backup/

# Remove backup directory (old code versions)
echo "Removing backup directory..."
rm -rf backup

# Remove benedicataitor directory (separate tool)
echo "Removing benedicataitor directory..."
rm -rf benedicataitor

# Remove extracted_text directory
echo "Removing extracted text directory..."
rm -rf extracted_text

# Remove attached_assets directory (documentation)
echo "Removing attached assets directory..."
rm -rf attached_assets

# Remove test directories and files
echo "Removing test directories and files..."
rm -rf tests
rm -rf test-results
rm -f test-*.js test-*.ts test-*.sh
rm -f jest.config.js

# Remove code metrics files
echo "Removing code metrics files..."
rm -f client/public/code-metrics.html
rm -f client/public/js/code-metrics.js
rm -f client/public/metrics-dashboard.html
rm -f server/metrics.ts
rm -f test-metrics-api.js
rm -f test-metrics.sh

# Remove utility scripts and documentation
echo "Removing utility scripts and documentation..."
rm -f ci-cd-trigger.sh
rm -f commit-to-github.sh
rm -f force-push-to-github.sh
rm -f extract_pdf_text.py
rm -f install-hooks.sh
rm -f generate-qr-code.js
rm -f manual-tts-verify.js
rm -f pdf_checker.py
rm -f text_to_pdf.py
rm -f validate-tts-autoplay.cjs

# Remove markdown documentation files
echo "Removing documentation files..."
rm -f CI-CD-SETUP.md
rm -f DEVELOPMENT_WORKFLOW.md
rm -f LOAD-TESTING.md
rm -f SELENIUM-TESTING.md
rm -f TESTING.md
rm -f TRUNK_BASED_DEVELOPMENT.md
rm -f TTS_COMPARISON_REFACTORING_METRICS.md

# Remove Replit-specific files
echo "Removing Replit-specific files..."
rm -f .replit
rm -f .replit.nix
rm -f replit.nix
rm -f .ai_workflow_reminder
rm -rf .cache
rm -rf .upm

# Remove additional files
echo "Removing additional files..."
rm -rf cleanup_backup
rm -f pyproject.toml
rm -f uv.lock
rm -f generated-icon.png 
rm -f student-interface-qr.png
rm -f postcss.config.js

# Remove unused temp and log files
echo "Removing temp and log files..."
rm -f server-output.log
rm -f server-stderr.log
rm -f *.temp
rm -f run-load-tests.sh
rm -f run-tests.sh

# Clean temp directory without deleting it
echo "Cleaning temp directory..."
rm -f temp/*.mp3

echo "Cleanup complete! Your project is now optimized for local development."
echo "A backup of critical configuration files was created in .cleanup_backup/"
