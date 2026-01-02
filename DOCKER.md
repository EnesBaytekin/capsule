# Docker Deployment

Time Capsule with HTTPS support. You need to generate SSL certificates before starting.

## Quick Start

```bash
# 1. Generate SSL certificates
./generate-certs.sh

# 2. Start the application
docker compose up -d --build
```

## Access

- **Frontend:** `https://localhost:3443`
- **Backend:** `https://localhost:8443`
- **From other machines:** `https://<YOUR_IP>:3443`

Accept the self-signed certificate warning in your browser.

## Commands

```bash
# Generate certificates
./generate-certs.sh

# Start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Remove data
docker compose down -v
```

## Ports

| Service | Port |
|---------|------|
| Frontend (HTTPS) | 3443 |
| Backend (HTTPS) | 8443 |

## Environment Variables

Create a `.env` file:

```env
JWT_SECRET=your-secret-here
```

## Certificates

Certificates are stored in `./certs/`:
- `cert.pem` - Certificate
- `key.pem` - Private key

This directory is gitignored for security.

## Why HTTPS?

Web Crypto API requires secure contexts (HTTPS) for encryption/decryption.
Without HTTPS, the app fails with:
```
Cannot read properties of undefined (reading 'generateKey')
```

## Production

Replace self-signed certificates with proper ones from Let's Encrypt or a CA.
Place them in `./certs/cert.pem` and `./certs/key.pem`.
