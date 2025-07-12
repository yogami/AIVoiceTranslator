# 🚀 AI Voice Translator - Production Deployment Guide

## Railway Deployment (Recommended)

### Prerequisites
- Railway account (railway.app)
- GitHub repository with your code
- OpenAI API key

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Initialize Project
```bash
railway init
```

### Step 4: Add PostgreSQL Database
```bash
railway add postgresql
```

### Step 5: Set Environment Variables
Go to your Railway dashboard and set these environment variables:

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `SESSION_SECRET` - Generate a secure random string
- `VITE_API_URL` - https://your-app-name.railway.app  
- `VITE_WS_URL` - wss://your-app-name.railway.app

**Railway Auto-Generated:**
- `DATABASE_URL` - Automatically set by Railway PostgreSQL
- `PORT` - Automatically set by Railway

### Step 6: Deploy
```bash
railway deploy
```

## Alternative: Fly.io Deployment

### Prerequisites
- Fly.io account
- flyctl CLI installed

### Step 1: Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login and Initialize
```bash
fly auth login
fly launch
```

### Step 3: Add PostgreSQL
```bash
fly postgres create
fly postgres attach <postgres-app-name>
```

### Step 4: Set Environment Variables
```bash
fly secrets set OPENAI_API_KEY=your-key-here
fly secrets set SESSION_SECRET=your-session-secret
fly secrets set VITE_API_URL=https://your-app.fly.dev
fly secrets set VITE_WS_URL=wss://your-app.fly.dev
```

### Step 5: Deploy
```bash
fly deploy
```

## Cost Estimates (1 Month)

### Railway
- **Hobby Plan**: $5/month
  - 512 MB RAM
  - Shared CPU
  - PostgreSQL included
  - Custom domain
  - **Total: ~$5-10/month**

### Fly.io  
- **Apps v2**: ~$2-5/month
- **PostgreSQL**: ~$2-5/month
- **Total: ~$4-10/month**

## Pre-Deployment Checklist

- [ ] OpenAI API key ready
- [ ] Database URLs updated
- [ ] Environment variables configured
- [ ] Build process working locally
- [ ] WebSocket connections tested
- [ ] HTTPS/WSS URLs configured
- [ ] Domain name (optional)

## Production Monitoring

### Health Checks
The app includes health check endpoints:
- `GET /health` - Basic health check
- `GET /api/health` - Detailed health with database status

### Logs
Monitor your application logs through:
- Railway: Dashboard → Your App → Logs
- Fly.io: `fly logs`

### Database Migrations
Run database migrations after deployment:
```bash
# Railway
railway run npm run db:migrations:apply

# Fly.io  
fly ssh console -C "npm run db:migrations:apply"
```

## Security Notes for Production

1. **HTTPS Only**: Ensure all client URLs use HTTPS
2. **Environment Variables**: Never commit API keys to Git
3. **Database Security**: Use connection pooling and SSL
4. **Rate Limiting**: Consider adding rate limiting for API endpoints
5. **CORS**: Configure appropriate CORS settings

## Demo Setup for Client

1. **Custom Domain** (Optional): Set up a custom domain like `demo.yourcompany.com`
2. **Demo Data**: Consider seeding demo classrooms/sessions
3. **User Guide**: Provide simple setup instructions for teachers and students
4. **Support Contact**: Include support contact information

## Troubleshooting

### Common Issues:
- **WebSocket Connection Failed**: Check WSS URL configuration
- **Database Connection Error**: Verify DATABASE_URL is set correctly
- **OpenAI API Errors**: Confirm API key is valid and has credits
- **Build Failures**: Check Node.js version compatibility

### Debug Commands:
```bash
# Railway
railway logs
railway shell

# Fly.io
fly logs
fly ssh console
```
