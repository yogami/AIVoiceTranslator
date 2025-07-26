FROM node:20-alpine

WORKDIR /app

# Install build dependencies for whisper.cpp compilation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    cmake \
    pkgconfig \
    && ln -sf python3 /usr/bin/python

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (needed for build process)
RUN npm ci

# Initialize whisper-node to compile whisper.cpp binaries during build
RUN node -e "try { console.log('Initializing whisper-node...'); require('whisper-node'); console.log('whisper-node initialized successfully'); } catch (error) { console.error('Failed to initialize whisper-node:', error.message); console.log('This is expected during build - whisper.cpp will compile on first use'); }"

# Copy source code and configuration files
COPY . .

# Build the application (client and server)
RUN npm run build:client
RUN npm run build:server

# Verify build outputs exist
RUN ls -la dist/ && ls -la dist/client/

# Clean up dev dependencies and install only production dependencies
RUN npm prune --production && npm cache clean --force

# Remove development files to reduce image size (preserve dist/, db-migration-scripts, migrations, config)
RUN rm -rf server/ client/ docs/ tests/ playwright-report/ test-results/ .git/ temp/ logs/ shared/ test-config/ test-scripts/

# Verify that built files and migration files are still present
RUN ls -la dist/ && ls -la dist/client/ && ls -la db-migration-scripts/ && ls -la migrations/

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
CMD ["sh", "-c", "echo 'Starting production server...' && echo 'Running migrations...' && npm run db:migrations:apply && echo 'Starting application...' && node dist/index.js"]
