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

# Install production dependencies
RUN npm ci --omit=dev

# Copy application code (backend only)
COPY server.cjs ./
COPY reset-password.html ./
COPY server ./server/
COPY public ./public/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

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

# Start the server (prisma generate runs at startup on native hardware, avoiding QEMU issues)
CMD ["./entrypoint.sh"]
