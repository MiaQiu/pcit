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

# Install production dependencies only
# Note: bcrypt requires build tools, but the pre-built binary should work on alpine
RUN npm ci --only=production

# NOTE: Prisma generate moved to runtime to avoid M-chip/QEMU binary corruption

# Copy application code (backend only)
COPY server.cjs ./
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

# Generate Prisma client at runtime (avoids M-chip/QEMU binary corruption) and start
CMD ["sh", "-c", "npx prisma generate && node server.cjs"]
