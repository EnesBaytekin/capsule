# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev openssl git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o api ./cmd/api

# Runtime stage
FROM alpine:latest

# Metadata labels
LABEL maintainer="enesbaytekin"
LABEL description="Time Capsule Backend - Zero-knowledge encrypted storage"
LABEL version="1.0.0"

# Install runtime dependencies
RUN apk add --no-cache sqlite-libs ca-certificates openssl

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/api .

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create data directories
RUN mkdir -p /app/data /app/certs /app/config

# Expose HTTPS port
EXPOSE 8443

# Set environment variables for HTTPS
ENV PORT=8443
ENV DATABASE_PATH=/app/data/capsule.db
ENV STORAGE_PATH=/app/data/users

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD nc -z localhost 8443 || exit 1

# Run entrypoint script
CMD ["/app/docker-entrypoint.sh"]
