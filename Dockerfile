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

# Install production dependencies only
# Note: bcrypt requires build tools, but the pre-built binary should work on alpine
RUN npm ci --only=production

# Generate Prisma Client
RUN npx prisma generate

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

# Start application
CMD ["node", "server.cjs"]
