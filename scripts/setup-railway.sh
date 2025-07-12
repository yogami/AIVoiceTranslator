#!/bin/bash

# 🚀 Railway Deployment Setup Script
# This script helps set up Railway deployment for the AI Voice Translator app

set -e

echo "🚂 AI Voice Translator - Railway Deployment Setup"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found${NC}"
    echo -e "${YELLOW}💡 Installing Railway CLI...${NC}"
    npm install -g @railway/cli
    echo -e "${GREEN}✅ Railway CLI installed${NC}"
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 Please login to Railway${NC}"
    railway login
fi

echo -e "${BLUE}👤 Logged in as: $(railway whoami)${NC}"

# Function to create and configure a Railway project
setup_railway_project() {
    local project_name=$1
    local env_type=$2
    
    echo -e "${YELLOW}🏗️ Setting up $project_name...${NC}"
    
    # Create project
    railway create $project_name
    
    # Add PostgreSQL
    echo -e "${YELLOW}📊 Adding PostgreSQL database...${NC}"
    railway add postgresql
    
    # Set environment variables
    echo -e "${YELLOW}⚙️ Setting environment variables for $env_type...${NC}"
    
    # Read OpenAI API key
    read -p "Enter your OpenAI API key: " openai_key
    
    # Read session secret
    read -p "Enter a session secret (or press Enter for auto-generated): " session_secret
    if [ -z "$session_secret" ]; then
        session_secret=$(openssl rand -base64 32)
    fi
    
    # Set common environment variables
    railway variables set OPENAI_API_KEY="$openai_key"
    railway variables set TTS_SERVICE_TYPE="openai"
    railway variables set NODE_ENV="production"
    railway variables set HOST="0.0.0.0"
    railway variables set SESSION_SECRET="$session_secret"
    railway variables set SESSION_TIMEOUT="3600000"
    railway variables set INACTIVE_SESSION_TIMEOUT="1800000"
    railway variables set ENABLE_DETAILED_TRANSLATION_LOGGING="true"
    railway variables set ENABLE_AUDIO_CACHING="true"
    railway variables set ENABLE_SESSION_PERSISTENCE="true"
    railway variables set LOG_LEVEL="info"
    
    # Set environment-specific URLs
    if [ "$env_type" = "production" ]; then
        railway variables set VITE_API_URL="https://aivoicetranslator.railway.app"
        railway variables set VITE_WS_URL="wss://aivoicetranslator.railway.app"
    else
        railway variables set VITE_API_URL="https://aivoicetranslator-staging.railway.app"
        railway variables set VITE_WS_URL="wss://aivoicetranslator-staging.railway.app"
    fi
    
    # Get project info
    echo -e "${BLUE}📋 Project Information:${NC}"
    railway status
    
    # Get service ID and token for CI/CD
    echo -e "${YELLOW}🔑 Getting credentials for CI/CD...${NC}"
    service_id=$(railway service | grep -o 'Service ID: [a-zA-Z0-9-]*' | cut -d' ' -f3)
    
    echo -e "${GREEN}✅ $project_name setup complete!${NC}"
    echo -e "${BLUE}📝 Add these to your GitHub repository secrets:${NC}"
    echo -e "   RAILWAY_SERVICE_ID_$(echo $env_type | tr '[:lower:]' '[:upper:]'): $service_id"
    echo -e "   RAILWAY_TOKEN_$(echo $env_type | tr '[:lower:]' '[:upper:]'): [Get from 'railway auth' command]"
    echo ""
}

# Main menu
echo -e "${YELLOW}🎯 What would you like to set up?${NC}"
echo "1. Production environment only"
echo "2. Staging environment only"
echo "3. Both production and staging"
echo "4. Just show current Railway projects"
echo "5. Get Railway token for CI/CD"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        setup_railway_project "aivoicetranslator-production" "production"
        ;;
    2)
        setup_railway_project "aivoicetranslator-staging" "staging"
        ;;
    3)
        setup_railway_project "aivoicetranslator-production" "production"
        echo -e "${YELLOW}🔄 Setting up staging environment...${NC}"
        setup_railway_project "aivoicetranslator-staging" "staging"
        ;;
    4)
        echo -e "${BLUE}📋 Current Railway projects:${NC}"
        railway projects
        ;;
    5)
        echo -e "${BLUE}🔑 Railway authentication token:${NC}"
        railway auth
        echo -e "${YELLOW}💡 Copy this token to your GitHub repository secrets${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${BLUE}📚 Next steps:${NC}"
echo "1. Add the Railway tokens and service IDs to your GitHub repository secrets"
echo "2. Push your code to trigger the CI/CD pipeline"
echo "3. Monitor the deployment in the Railway dashboard"
echo ""
echo -e "${YELLOW}📖 For detailed instructions, see: .github/SETUP_CICD.md${NC}"
