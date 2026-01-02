# Frontend with HTTPS support using nginx
FROM alpine:latest

# Install nginx and openssl
RUN apk add --no-cache nginx openssl

WORKDIR /app

# Copy static files
COPY static /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create certificate directory
RUN mkdir -p /app/certs

# Expose HTTPS port only
EXPOSE 3443

# Start nginx
CMD ["/app/docker-entrypoint.sh"]
