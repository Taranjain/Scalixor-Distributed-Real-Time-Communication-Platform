FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema and generate client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port (will be overridden by docker-compose)
EXPOSE 5000

# Start server (runs migrations then starts)
CMD ["npm", "start"]