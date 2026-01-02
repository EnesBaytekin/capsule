# Docker Deployment

Time Capsule with HTTPS support using self-signed certificates.

## Quick Start

```bash
./docker-setup.sh
```

This will:
1. Generate SSL certificates
2. Build and start services
3. Run on HTTPS only

## Access

- **Frontend:** `https://localhost:3443`
- **Backend:** `https://localhost:8443`
- **From other machines:** `https://<YOUR_IP>:3443`

Accept the self-signed certificate warning in your browser.

## Manual Setup

### 1. Generate Certificates

```bash
mkdir -p backend/certs frontend/certs

openssl req -x509 -newkey rsa:4096 -keyout backend/certs/key.pem \
  -out backend/certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost"

openssl req -x509 -newkey rsa:4096 -keyout frontend/certs/key.pem \
  -out frontend/certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost"
```

### 2. Start Services

```bash
docker-compose up --build
```

Or run in background:

```bash
docker-compose up -d --build
```

## Commands

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Remove data
docker-compose down -v
```

## Ports

| Service | Port |
|---------|------|
| Frontend (HTTPS) | 3443 |
| Backend (HTTPS) | 8443 |

## Environment Variables

Set in `.env` or docker-compose.yml:

- `JWT_SECRET`: Secret for JWT tokens (change in production!)

## Why HTTPS?

Web Crypto API requires secure contexts (HTTPS) for encryption/decryption.
Without HTTPS, the app fails with:
```
Cannot read properties of undefined (reading 'generateKey')
```

## Production

Replace self-signed certificates with proper ones from Let's Encrypt or a CA.
