FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY client/ ./client/

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
