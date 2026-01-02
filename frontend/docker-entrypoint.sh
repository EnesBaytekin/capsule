#!/bin/sh
set -e

# Generate SSL certificates if they don't exist
if [ ! -f /app/certs/cert.pem ] || [ ! -f /app/certs/key.pem ]; then
    echo "🔒 Generating SSL certificates..."
    openssl req -x509 -newkey rsa:4096 -keyout /app/certs/key.pem \
        -out /app/certs/cert.pem -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=Capsule/CN=localhost" 2>/dev/null
    echo "✅ Certificates generated!"
fi

echo "🚀 Starting nginx on https://0.0.0.0:3443"

# Start nginx
exec nginx -g 'daemon off;'
