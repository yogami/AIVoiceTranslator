
# Dockerfile for Railway deployment (Node.js/TypeScript)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
# Railway injects DATABASE_URL and OPENAI_API_KEY automatically

CMD ["node", "server.js"]
