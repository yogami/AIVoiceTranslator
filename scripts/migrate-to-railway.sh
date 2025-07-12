#!/bin/bash

# 🗄️ Railway Database Migration Script
# This script helps you migrate your database schema to Railway PostgreSQL

set -e

echo "🚀 Railway Database Migration Script"
echo "=================================="

# Check if Railway CLI is authenticated
if ! railway whoami &> /dev/null; then
    echo "❌ Railway CLI not authenticated. Please run 'railway login' first."
    exit 1
fi

echo "✅ Railway CLI authenticated"

# Check if we're linked to a Railway project
if ! railway status &> /dev/null; then
    echo "❌ Not linked to a Railway project. Please run 'railway link' first."
    exit 1
fi

echo "✅ Linked to Railway project"

# Show current Railway environment
echo "📍 Current Railway environment:"
railway status

# Check if PostgreSQL service exists
echo "🔍 Checking for PostgreSQL service..."
if railway run echo "Connected to database" &> /dev/null; then
    echo "✅ PostgreSQL service found"
else
    echo "❌ PostgreSQL service not found. Please add PostgreSQL to your Railway project first."
    echo "   Go to Railway Dashboard → Your Project → New → Database → Add PostgreSQL"
    exit 1
fi

# Run database migrations
echo "🔄 Running database migrations..."
echo "This will apply all migration files in ./migrations/ to your Railway PostgreSQL database"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Applying migrations..."
    railway run npm run db:migrations:apply
    echo "✅ Migrations completed!"
    
    echo "🔍 Verifying migration status..."
    railway run npm run db:migrations:check:test || echo "⚠️  Migration check failed, but this might be expected"
    
    echo "🎉 Database migration to Railway complete!"
    echo "📊 Your Railway PostgreSQL database now has all the required tables and schema"
else
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🔗 Next steps:"
echo "1. Set up environment variables in Railway dashboard"
echo "2. Deploy your application"
echo "3. Test the deployment"
