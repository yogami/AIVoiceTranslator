FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY client/ ./client/
# Add any other folders/files needed for runtime

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
