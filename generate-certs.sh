#!/bin/bash
# Generate self-signed SSL certificates for Time Capsule

echo "🔒 Generating SSL certificates..."

mkdir -p certs

openssl req -x509 -newkey rsa:4096 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -nodes \
  -subj "/C=US/ST=State/L=City/O=Capsule/CN=localhost"

chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "✅ Certificates generated in ./certs/"
echo ""
echo "🚀 Now run: docker compose up -d"
