# Docker Deployment with HTTPS

This application requires HTTPS for the Web Crypto API to work properly when accessing from machines other than localhost.

## Quick Start

1. **Generate certificates and start everything:**
   ```bash
   ./docker-setup.sh
   ```

2. **Access the application:**
   - Frontend: `https://localhost:3443`
   - Backend: `https://localhost:8443`
   - From other machines: `https://<YOUR_IP>:3443`

3. **Accept the self-signed certificate warning** in your browser

## Manual Setup

### 1. Generate SSL Certificates

```bash
# Backend certificates
mkdir -p backend/certs
openssl req -x509 -newkey rsa:4096 -keyout backend/certs/key.pem \
  -out backend/certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost"

# Frontend certificates
mkdir -p frontend/certs
openssl req -x509 -newkey rsa:4096 -keyout frontend/certs/key.pem \
  -out frontend/certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Dev/CN=localhost"
```

### 2. Start with Docker Compose

```bash
# Build and start (foreground)
docker-compose up --build

# Or start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Architecture

- **Frontend** (nginx): Serves static files on port 3443 (HTTPS)
- **Backend** (Go): API server on port 8443 (HTTPS)
- **Data persistence**: Docker volume for database and encrypted files

## Ports

| Service | Protocol | Port |
|---------|----------|------|
| Frontend | HTTPS | 3443 |
| Backend | HTTPS | 8443 |

## Environment Variables

Edit `.env` file or set in docker-compose.yml:

- `JWT_SECRET`: Secret for JWT token signing (change in production!)

## Why HTTPS?

The Web Crypto API (`window.crypto.subtle`) is only available in **secure contexts**:
- ✅ HTTPS
- ✅ localhost
- ❌ HTTP from other machines

Without HTTPS, encryption/decryption will fail with:
```
Cannot read properties of undefined (reading 'generateKey')
```

## Production Deployment

For production, use proper SSL certificates from Let's Encrypt or a commercial CA. Replace the self-signed certificates in:
- `backend/certs/`
- `frontend/certs/`
