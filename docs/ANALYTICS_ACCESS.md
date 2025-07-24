# Analytics Access & Environment Configuration Guide

## How to Access Analytics

### 🔐 Authentication

The analytics page is now protected with Basic Authentication for security:

1. **Without Password (Development)**:
   - If `ANALYTICS_PASSWORD` is not set in your environment file
   - Analytics page is accessible without authentication (development only)
   - You'll see a warning: `⚠️  ANALYTICS_PASSWORD not set`

2. **With Password Protection**:
   - Set `ANALYTICS_PASSWORD=your-secure-password` in your `.env` file
   - Access the page at `http://localhost:5000/analytics`
   - Browser will prompt for credentials:
     - **Username**: `admin`
     - **Password**: Your `ANALYTICS_PASSWORD` value

### 📍 Analytics URLs by Environment

| Environment | URL | Database Source |
|------------|-----|----------------|
| **Local Development** | `http://localhost:5000/analytics` | Local `.env` `DATABASE_URL` |
| **Test** | `http://localhost:5000/analytics` | `.env.test` `DATABASE_URL` |
| **Production** | `https://your-domain.com/analytics` | Production `DATABASE_URL` |
| **CI/CD** | Varies by deployment | CI environment variables |

## 🗄️ Database Environment Configuration

**Yes!** Each environment automatically connects to its respective database based on the `DATABASE_URL` environment variable:

### Environment Priority

```bash
# The system loads environment variables in this order:
# 1. .env.local (highest priority, git-ignored)
# 2. .env.{NODE_ENV} (e.g., .env.test, .env.production)
# 3. .env (default environment file)
```

### Database Connection Logic

```typescript
// From server/db.ts
const databaseUrl = process.env.DATABASE_URL;

// Automatic driver selection:
if (databaseUrl.includes('aivencloud.com')) {
  // Uses Aiven (local/test) with connection limits
} else {
  // Uses standard PostgreSQL driver
}

// Environment-specific connection pooling:
const isTestEnvironment = process.env.NODE_ENV === 'test';
const maxConnections = isTestEnvironment ? 1 : 10;
```

### Typical Database URLs by Environment

```bash
# .env (local development)
DATABASE_URL=postgresql://postgres:password@localhost:5432/aivoicetranslator_dev

# .env.test (testing)
DATABASE_URL=postgresql://postgres:password@localhost:5432/aivoicetranslator_test

# Production environment
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/aivoicetranslator

# CI/CD environment
DATABASE_URL=postgresql://ci_user:ci_pass@ci-db.example.com:5432/aivoicetranslator_ci
```

## 🚀 Quick Setup Guide

### 1. Set Up Analytics Password

```bash
# Add to your .env file
echo "ANALYTICS_PASSWORD=your-secure-password" >> .env

# Optional: Restrict IP access
echo "ANALYTICS_ALLOWED_IPS=127.0.0.1,192.168.1.100" >> .env
```

### 2. Access Analytics

```bash
# Start your server
npm run dev

# Open browser and navigate to:
# http://localhost:5000/analytics

# When prompted for credentials:
# Username: admin
# Password: your-secure-password
```

### 3. Use Analytics

Once authenticated, you can:
- Ask natural language questions about your session data
- View interactive charts and visualizations
- Get AI-powered insights and recommendations
- Export data for further analysis

## 🔒 Security Features

### Multi-Layer Protection

1. **Basic Authentication**: Username/password protection
2. **Rate Limiting**: 50 requests per 15 minutes per IP
3. **Input Validation**: Query sanitization and validation
4. **Prompt Injection Prevention**: 20+ detection patterns
5. **IP Allowlisting**: Optional IP-based access control
6. **AI Security**: Secure prompts prevent misuse

### Example Queries That Work

✅ **Allowed**:
- "How many sessions do we have?"
- "Show me daily trends for the last week"
- "What are the most popular language pairs?"
- "Create a pie chart of session quality distribution"

🚫 **Blocked**:
- "Delete all sessions" → AI responds with safety message
- "Run shell commands" → Blocked by security middleware
- "Ignore previous instructions" → Blocked by injection detection

## 🌍 Environment-Specific Configurations

### Local Development
```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/dev_db
ANALYTICS_PASSWORD=dev123
PORT=5000
```

### Testing
```bash
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/test_db
# No password needed for testing
PORT=5001
```

### Production
```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod-server:5432/prod_db
ANALYTICS_PASSWORD=super-secure-production-password
ANALYTICS_ALLOWED_IPS=10.0.0.100,10.0.0.101
PORT=5000
HOST=0.0.0.0
```

### CI/CD
```bash
NODE_ENV=test
DATABASE_URL=${{ secrets.CI_DATABASE_URL }}
# CI environments typically don't need analytics access
```

## 📊 Database Connection Summary

| Component | How It Works |
|-----------|-------------|
| **Environment Detection** | Reads `NODE_ENV` variable |
| **Database URL** | Uses `DATABASE_URL` from appropriate `.env` file |
| **Driver Selection** | Auto-detects Aiven/Supabase/Railway from URL |
| **Connection Pooling** | Adjusts pool size based on environment |
| **Analytics Data** | Always queries from connected database |

This ensures that:
- **Local development** uses your local database
- **Testing** uses the test database (isolated data)
- **Production** uses the production database
- **CI/CD** uses the CI database environment

The analytics will show data from whichever database is connected in that environment, providing environment-appropriate insights without any additional configuration needed!
