FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# Install dependencies first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Create directory for SQLite database
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/gonzalo-plata.db"

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
