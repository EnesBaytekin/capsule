#!/bin/bash
# Setup certificates for Docker deployment

echo "Setting up Time Capsule for Docker with HTTPS..."

# Generate backend certificates
echo "Generating backend SSL certificates..."
mkdir -p backend/certs
openssl req -x509 -newkey rsa:4096 -keyout backend/certs/key.pem -out backend/certs/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost" 2>/dev/null

# Generate frontend certificates
echo "Generating frontend SSL certificates..."
mkdir -p frontend/certs
openssl req -x509 -newkey rsa:4096 -keyout frontend/certs/key.pem -out frontend/certs/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost" 2>/dev/null

echo "Certificates generated!"
echo ""
echo "=========================================="
echo "Starting Docker Compose..."
echo "=========================================="
echo ""

# Start Docker Compose
docker-compose up --build

# Note: Use docker-compose up -d for detached mode
