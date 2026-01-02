# Frontend with HTTPS support using nginx
FROM alpine:latest

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy static files
COPY static /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy HTTPS startup script
COPY https-entrypoint.sh /app/https-entrypoint.sh
RUN chmod +x /app/https-entrypoint.sh

# Create certificate directory
RUN mkdir -p /app/certs

# Expose HTTPS port only
EXPOSE 3443

# Start nginx
CMD ["/app/https-entrypoint.sh"]
