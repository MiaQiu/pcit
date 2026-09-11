FROM node:20-alpine

# Install system dependencies for Prisma and native modules.
# fontconfig + ttf-dejavu: Alpine ships no fonts, so sharp's librsvg/Pango
# renders the share-card image's SVG <text> as tofu boxes without them
# (see server/services/shareImage.cjs). DejaVu is the last-resort fallback;
# Plus Jakarta Sans (the brand font) is copied in below.
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    fontconfig \
    ttf-dejavu

WORKDIR /app

# ── Build web signup app ──────────────────────────────────────────────────────
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web ./web/
ARG VITE_API_URL=https://wpwpawhz29.ap-southeast-1.awsapprunner.com
RUN cd web && VITE_API_URL=$VITE_API_URL npm run build
# ─────────────────────────────────────────────────────────────────────────────

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy Prisma schema and migrations (after npm ci so migrations aren't cached)
COPY prisma ./prisma/

# Copy application code (backend only)
COPY server.cjs ./
COPY reset-password.html ./
COPY server ./server/
COPY public ./public/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Register the bundled Plus Jakarta Sans faces so the share-card image
# renders in the brand font instead of the DejaVu fallback.
RUN mkdir -p /usr/share/fonts/truetype/jakarta \
    && cp server/assets/fonts/*.ttf /usr/share/fonts/truetype/jakarta/ \
    && fc-cache -f
# web/dist already present from the build step above

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
