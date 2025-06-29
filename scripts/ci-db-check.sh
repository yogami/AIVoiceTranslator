#!/bin/bash
# Database Integrity Check for CI/CD
# Add this to your deployment pipeline

echo "🔍 Running database integrity audit..."

# Check test database
npm run db:audit:test
if [ $? -ne 0 ]; then
    echo "❌ Test database integrity check FAILED"
    echo "🚨 Schema.ts is out of sync with test database"
    exit 1
fi

# Check production database  
npm run db:audit
if [ $? -ne 0 ]; then
    echo "❌ Production database integrity check FAILED"
    echo "🚨 Schema.ts is out of sync with production database"
    exit 1
fi

echo "✅ Database integrity checks passed"
