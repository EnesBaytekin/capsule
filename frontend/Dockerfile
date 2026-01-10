# Frontend with HTTPS support using nginx
FROM alpine:latest

# Metadata labels
LABEL maintainer="enesbaytekin"
LABEL description="Time Capsule Frontend - Zero-knowledge encrypted storage UI"
LABEL version="1.0.0"

# Install nginx and utilities
RUN apk add --no-cache nginx openssl

WORKDIR /app

# Copy static files to /static/ to match HTML paths
COPY static /usr/share/nginx/html/static
COPY templates/index.html /usr/share/nginx/html/index.html

# Fix permissions - make readable by nginx user
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create certificate directory
RUN mkdir -p /app/certs

# Expose HTTPS port only
EXPOSE 3443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD nc -z localhost 3443 || exit 1

# Start nginx
CMD ["/app/docker-entrypoint.sh"]
