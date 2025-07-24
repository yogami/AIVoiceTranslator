FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (needed for build process)
RUN npm ci

# Copy source code and configuration files
COPY . .

# Build the application (client and server)
RUN npm run build:client
RUN npm run build:server

# Verify build outputs exist
RUN ls -la dist/ && ls -la dist/client/

# Clean up dev dependencies and install only production dependencies
RUN npm prune --production && npm cache clean --force

# Remove development files to reduce image size
RUN rm -rf server/ client/ docs/ tests/ playwright-report/ test-results/ .git/

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (Railway will override this)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "http.get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start with migrations and server
CMD ["sh", "-c", "echo 'Starting production server...' && echo 'Checking DATABASE_URL...' && echo 'Running migrations...' && npm run db:migrations:apply && echo 'Starting application...' && node dist/index.js"]
