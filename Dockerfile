FROM node:18-alpine

# Install system dependencies for Prisma and native modules
RUN apk add --no-cache \
    openssl \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema
COPY prisma ./prisma/

# Set Prisma binary target explicitly for Alpine Linux
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Install all dependencies (need prisma CLI for generate)
RUN npm ci

# Generate Prisma client at build time (works because we build with --platform linux/amd64)
RUN npx prisma generate

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy application code (backend only)
COPY server.cjs ./
COPY reset-password.html ./
COPY server ./server/
COPY public ./public/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server.cjs"]
