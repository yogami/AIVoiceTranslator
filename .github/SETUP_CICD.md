# 🚀 CI/CD Pipeline Setup Guide

This guide will help you set up the complete CI/CD pipeline for your AI Voice Translator application with automated testing and deployment to Railway.

## 📋 Prerequisites

Before you begin, ensure you have:

1. ✅ **GitHub repository** with push access
2. ✅ **Railway account** ([railway.app](https://railway.app))
3. ✅ **OpenAI API key** for testing
4. ✅ **Production database** (Aiven PostgreSQL or Railway PostgreSQL)

## 🔧 Step 1: Set Up GitHub Repository Secrets

Go to your GitHub repository → Settings → Secrets and Variables → Actions, and add these secrets:

### 🔑 Required Secrets

```bash
# OpenAI API Key (for testing)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Railway Tokens (get from Railway dashboard)
RAILWAY_TOKEN_STAGING=your-railway-staging-token
RAILWAY_TOKEN_PRODUCTION=your-railway-production-token

# Railway Service IDs (get from Railway dashboard)
RAILWAY_SERVICE_ID_STAGING=your-staging-service-id
RAILWAY_SERVICE_ID_PRODUCTION=your-production-service-id
```

### 🎯 How to Get Railway Tokens & Service IDs

1. **Login to Railway**: Go to [railway.app](https://railway.app) and log in
2. **Get Railway Token**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and get token
   railway login
   railway auth
   ```
3. **Get Service IDs**:
   ```bash
   # List your projects
   railway projects
   
   # Connect to your project
   railway link
   
   # Get service information
   railway status
   ```

## 🏗️ Step 2: Create Railway Projects

### Production Environment
```bash
# Create production project
railway create aivoicetranslator-production

# Add PostgreSQL database
railway add postgresql

# Deploy initial version
railway up
```

### Staging Environment (Optional)
```bash
# Create staging project
railway create aivoicetranslator-staging

# Add PostgreSQL database
railway add postgresql

# Deploy to staging
railway up
```

## 🔧 Step 3: Configure Railway Environment Variables

For each Railway project, set these environment variables:

### Production Environment Variables
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
TTS_SERVICE_TYPE=openai

# Database (auto-configured by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Server Configuration
PORT=${{PORT}}
HOST=0.0.0.0
NODE_ENV=production

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-here
SESSION_TIMEOUT=3600000
INACTIVE_SESSION_TIMEOUT=1800000

# Frontend URLs (update with your Railway domains)
VITE_API_URL=https://aivoicetranslator.railway.app
VITE_WS_URL=wss://aivoicetranslator.railway.app

# Feature Flags
ENABLE_DETAILED_TRANSLATION_LOGGING=true
ENABLE_AUDIO_CACHING=true
ENABLE_SESSION_PERSISTENCE=true

# Logging
LOG_LEVEL=info
```

### Staging Environment Variables
Same as production, but update the URLs:
```bash
VITE_API_URL=https://aivoicetranslator-staging.railway.app
VITE_WS_URL=wss://aivoicetranslator-staging.railway.app
```

## 🎛️ Step 4: Configure CI/CD Pipeline

The pipeline is already configured in `.github/workflows/ci-cd.yml` with:

### 🔄 Trigger Conditions
- **Production**: Deploys on push to `main` branch
- **Staging**: Deploys on push to `develop` branch
- **Pull Requests**: Runs tests on PRs to `main`

### 🧪 Test Pipeline
1. **Lint Code**: ESLint and security audit
2. **Unit Tests**: Fast unit tests with Vitest
3. **Integration Tests**: Full integration tests with PostgreSQL & Redis
4. **Audio Tests**: Audio functionality tests with FFmpeg

### 🚀 Deployment Pipeline
1. **Build**: Compile TypeScript and build assets
2. **Deploy**: Deploy to Railway using Railway CLI
3. **Migrations**: Run database migrations
4. **Smoke Tests**: Verify deployment health
5. **E2E Tests**: Run end-to-end tests on live environment

## 📊 Step 5: Set Up Monitoring & Notifications

### Health Check Endpoint
Make sure your app has a health check endpoint:
```javascript
// In your server
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

### Optional: Slack Notifications
Add these secrets for deployment notifications:
```bash
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

## 🎯 Step 6: First Deployment

### Manual Deploy (Testing)
```bash
# Build and test locally
npm ci
npm run build
npm run test:unit
npm run test:integration

# Deploy to Railway
railway login
railway link
railway up
```

### Automated Deploy (CI/CD)
```bash
# Push to main branch for production
git checkout main
git add .
git commit -m "feat: setup CI/CD pipeline"
git push origin main

# Push to develop branch for staging
git checkout develop
git add .
git commit -m "feat: setup CI/CD pipeline"
git push origin develop
```

## 📈 Step 7: Monitor Your Pipeline

### GitHub Actions Dashboard
- Go to your repository → Actions tab
- Monitor pipeline runs and debug any failures

### Railway Dashboard
- Monitor deployment status and logs
- Check resource usage and performance metrics

### Health Checks
- Production: `https://aivoicetranslator.railway.app/api/health`
- Staging: `https://aivoicetranslator-staging.railway.app/api/health`

## 🔧 Troubleshooting

### Common Issues

**1. Railway CLI Not Found**
```bash
npm install -g @railway/cli@latest
```

**2. Database Connection Issues**
```bash
# Check Railway logs
railway logs

# Verify environment variables
railway variables
```

**3. Build Failures**
```bash
# Check build logs in GitHub Actions
# Verify all dependencies are in package.json
npm ci
npm run build
```

**4. Test Failures**
```bash
# Run tests locally first
npm run test:unit
npm run test:integration

# Check environment variables in GitHub secrets
```

## 🎉 Success Checklist

- [ ] GitHub secrets configured
- [ ] Railway projects created
- [ ] Environment variables set
- [ ] Health check endpoint working
- [ ] CI/CD pipeline runs successfully
- [ ] Staging deployment works
- [ ] Production deployment works
- [ ] All tests pass in CI/CD
- [ ] Monitoring and notifications set up

## 🔄 Daily Workflow

Once set up, your workflow will be:

1. **Development**: Work on feature branches
2. **Testing**: Create PR to `main` → CI runs tests
3. **Staging**: Merge to `develop` → Auto-deploy to staging
4. **Production**: Merge to `main` → Auto-deploy to production
5. **Monitoring**: Check Railway dashboard and GitHub Actions

## 📞 Support

If you need help:
1. Check GitHub Actions logs for CI/CD issues
2. Check Railway logs for deployment issues
3. Verify all environment variables are set correctly
4. Test deployments manually first before relying on automation

---

🚀 **Ready to ship!** Your AI Voice Translator now has a robust CI/CD pipeline that will handle automated testing and deployment for your client demo period.
