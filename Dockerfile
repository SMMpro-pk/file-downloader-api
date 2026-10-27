# Multi-stage production Dockerfile for SMMpro File Downloader API
# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Stage 2: Final Minimal Runtime Image
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Install dumb-init for proper signal handling and PID 1 reaper
RUN apk add --no-cache dumb-init wget

# Copy dependencies and source from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY src/ ./src/
COPY openapi.yaml ./
COPY .env.example ./.env.example

# Create data and tmp directories and set permissions for unprivileged node user
RUN mkdir -p /usr/src/app/data /usr/src/app/tmp && \
    chown -R node:node /usr/src/app && \
    chmod 750 /usr/src/app/data /usr/src/app/tmp

# Run as non-root user
USER node

# Expose standard application port
EXPOSE 3000

# Docker healthcheck using dynamic port detection
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-3000}/api/v1/health" || exit 1

# Execute with dumb-init to guarantee clean SIGTERM/SIGINT propagation and graceful draining
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
