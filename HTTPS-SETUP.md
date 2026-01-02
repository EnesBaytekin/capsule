# HTTPS Setup for Time Capsule

The Web Crypto API (`window.crypto.subtle`) **only works in secure contexts** (HTTPS or localhost).

## Problem
When accessing the app from another machine over HTTP, the browser disables the Web Crypto API for security, causing encryption/decryption to fail with:
```
Cannot read properties of undefined (reading 'generateKey')
```

## Solution: Use HTTPS

### Quick Start (with self-signed certificates)

1. **Start both servers with HTTPS:**
   ```bash
   ./start-https.sh
   ```

2. **Access the app:**
   - On this machine: `https://localhost:3443`
   - On other machines: `https://<YOUR_IP>:3443`

3. **Accept the certificate warning** in your browser (it's self-signed for development)

### Manual Start

**Backend (HTTPS):**
```bash
cd backend
export TLS_CERT="./certs/cert.pem"
export TLS_KEY="./certs/key.pem"
go run cmd/api/main.go
```

**Frontend (HTTPS - Python):**
```bash
cd frontend
python3 https-server.py
```

**Frontend (HTTPS - Node.js):**
```bash
cd frontend
npm install  # First time only
node https-server.js
```

### URLs
- **Frontend:** `https://localhost:3443` (or `https://<YOUR_IP>:3443` from other machines)
- **Backend:** `https://localhost:8080` (or `https://<YOUR_IP>:8080` from other machines)

### Note on Self-Signed Certificates
Browsers will show a security warning for self-signed certificates. This is normal for development. Click "Advanced" and "Proceed to localhost" to continue.
