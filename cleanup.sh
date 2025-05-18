#!/bin/bash

# Remove obsolete test scripts
rm -f run-tests.sh
echo "Removed obsolete run-tests.sh script."

# Remove unused configuration files
find test-config -type f -name 'jest-*.js' -delete
echo "Removed unused Jest configuration files."

# Remove empty coverage directory
if [ -d "test-config/coverage" ]; then
    rmdir test-config/coverage 2>/dev/null && echo "Removed empty coverage directory in test-config."
fi

# Ensure configs are organized
mkdir -p config/backup

# Check and consolidate redundant config files
for config in drizzle.config.ts tailwind.config.ts vite.config.ts; do
  if [ -f "$config" ]; then
    if cmp -s "$config" "config/$config"; then
      echo "Config $config is already consolidated."
    else
      mv "$config" "config/backup/"
      echo "Moved redundant $config to config/backup/."
    fi
  fi
done

echo "Cleanup process completed successfully!"
