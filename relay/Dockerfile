# Graceful Books Sync Relay - Self-Hosted Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S gracefulbooks && \
    adduser -S gracefulbooks -u 1001 -G gracefulbooks

# Create directories for data persistence
RUN mkdir -p /app/data && \
    chown -R gracefulbooks:gracefulbooks /app

# Switch to non-root user
USER gracefulbooks

# Expose port (default 8787)
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Set environment variables
ENV NODE_ENV=production \
    PORT=8787 \
    LOG_LEVEL=info

# Start the server
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL maintainer="Graceful Books <support@gracefulbooks.com>"
LABEL description="Self-hosted sync relay for Graceful Books - zero-knowledge encrypted financial data sync"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/gracefulbooks/graceful-books"
LABEL org.opencontainers.image.documentation="https://docs.gracefulbooks.com/self-hosted"
LABEL org.opencontainers.image.licenses="Proprietary"
