#!/bin/sh
set -e

# Check if SSL certificates exist
if [ -f /app/certs/cert.pem ] && [ -f /app/certs/key.pem ]; then
    echo "Starting nginx with HTTPS support..."
    echo "HTTP: http://0.0.0.0:3000"
    echo "HTTPS: https://0.0.0.0:3443"
else
    echo "Warning: SSL certificates not found. Starting HTTP only..."
    echo "To enable HTTPS, mount certificates to /app/certs"
    echo "HTTP: http://0.0.0.0:3000"
fi

# Start nginx
exec nginx -g 'daemon off;'
