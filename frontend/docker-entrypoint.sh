#!/bin/sh
set -e

# Check if certificates exist
if [ ! -f /app/certs/cert.pem ] || [ ! -f /app/certs/key.pem ]; then
    echo "❌ Error: SSL certificates not found!"
    echo "Please run: ./generate-certs.sh"
    exit 1
fi

echo "🚀 Starting nginx on https://0.0.0.0:3443"

# Start nginx
exec nginx -g 'daemon off;'

