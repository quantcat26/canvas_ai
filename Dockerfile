# ---- Build Stage: Client ----
FROM node:20-alpine AS client-builder

WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy only what's needed for Vite build
COPY vite.config.js ./
COPY client/ ./client/

RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies (and rebuild native modules)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3

# Copy server source
COPY server/ ./server/

# Copy built client assets from the builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create data directory for SQLite (persistent volume mount point)
RUN mkdir -p /app/data

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 5176

ENV NODE_ENV=production
ENV PORT=5176
ENV AI_CONFIG_SECRET=

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5176/api || exit 1

CMD ["node", "server/server.js"]
