# Docker Deployment

Time Capsule with HTTPS support. Certificates are auto-generated on first start.

## Quick Start

```bash
docker compose up -d --build
```

That's it! Certificates are generated automatically.

## Access

- **Frontend:** `https://localhost:3443`
- **Backend:** `https://localhost:8443`
- **From other machines:** `https://<YOUR_IP>:3443`

Accept the self-signed certificate warning in your browser.

## Commands

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Remove all data (including certs)
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

## How It Works

1. On first start, each container generates its own SSL certificate
2. Certificates are stored in Docker volumes
3. Both services run HTTPS only

## Why HTTPS?

Web Crypto API requires secure contexts (HTTPS) for encryption/decryption.
Without HTTPS, the app fails with:
```
Cannot read properties of undefined (reading 'generateKey')
```

## Production

Replace auto-generated certificates with proper ones from Let's Encrypt or a CA.
Mount them as volumes:
```yaml
volumes:
  - ./certs/cert.pem:/app/certs/cert.pem:ro
  - ./certs/key.pem:/app/certs/key.pem:ro
```
