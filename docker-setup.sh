#!/bin/bash
# Setup and run Time Capsule with Docker (HTTPS only)

echo "🔒 Setting up Time Capsule with HTTPS..."

# Generate SSL certificates
echo "📜 Generating SSL certificates..."

# Backend
mkdir -p backend/certs
openssl req -x509 -newkey rsa:4096 -keyout backend/certs/key.pem \
  -out backend/certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost" 2>/dev/null

# Frontend
mkdir -p frontend/certs
openssl req -x509 -newkey rsa:4096 -keyout frontend/certs/key.pem \
  -out frontend/certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost" 2>/dev/null

echo "✅ Certificates generated!"
echo ""
echo "🚀 Starting Docker Compose..."
echo ""

docker-compose up --build
