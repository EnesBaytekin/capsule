# Time Capsule - Production Deployment Guide

This guide covers production deployment of Time Capsule using Docker Hub images.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [SSL/TLS Certificate Management](#ssltls-certificate-management)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Steps](#deployment-steps)
6. [Production Considerations](#production-considerations)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/enesbaytekin/capsule.git
cd capsule

# 2. Download the release docker-compose file
wget https://github.com/enesbaytekin/capsule/releases/latest/download/docker-compose.release.yml
mv docker-compose.release.yml docker-compose.yml

# 3. Create environment file
cp .env.example .env

# 4. Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env

# 5. Generate SSL certificates (for testing - use Let's Encrypt for production)
./generate-certs.sh

# 6. Start the application
docker compose up -d

# 7. Check status
docker compose ps
```

Access the application at:
- Frontend: `https://your-domain:3443`
- Backend API: `https://your-domain:8443`

---

## Prerequisites

### System Requirements

- **Operating System:** Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+)
- **Docker:** 20.10 or later
- **Docker Compose:** 2.0 or later
- **Memory:** Minimum 512MB RAM
- **Disk:** Minimum 1GB free space
- **Ports:** 8443 (backend), 3443 (frontend)

### Install Docker and Docker Compose

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**RHEL/CentOS:**
```bash
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

---

## SSL/TLS Certificate Management

Time Capsule requires HTTPS/TLS for secure communication. You have several options:

### Option 1: Self-Signed Certificates (Testing/Development)

For testing purposes, use the provided script to generate self-signed certificates:

```bash
./generate-certs.sh
```

This creates:
- `certs/cert.pem` - SSL certificate
- `certs/key.pem` - SSL private key

**Warning:** Self-signed certificates will cause browser warnings. Only use for testing.

### Option 2: Let's Encrypt (Recommended for Production)

For production deployments, use Let's Encrypt for free, trusted SSL certificates.

#### Using Certbot with Standalone Mode

```bash
# Install certbot
sudo apt-get update
sudo apt-get install -y certbot

# Generate certificates for your domain
sudo certbot certonly --standalone -d capsule.yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/capsule.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/capsule.yourdomain.com/privkey.pem

# Copy certificates to project directory
sudo cp /etc/letsencrypt/live/capsule.yourdomain.com/fullchain.pem ./certs/cert.pem
sudo cp /etc/letsencrypt/live/capsule.yourdomain.com/privkey.pem ./certs/key.pem

# Set proper permissions
sudo chmod 644 ./certs/cert.pem
sudo chmod 600 ./certs/key.pem

# Make sure files are owned by the user running Docker
sudo chown $USER:$USER ./certs/*.pem
```

#### Using Certbot with Nginx Reverse Proxy

If you're running Time Capsule behind an Nginx reverse proxy:

```bash
# Install certbot and nginx plugin
sudo apt-get install -y certbot python3-certbot-nginx

# Generate and install certificates
sudo certbot --nginx -d capsule.yourdomain.com

# Certificates are automatically configured in Nginx
```

Then configure your Nginx reverse proxy:

```nginx
# /etc/nginx/sites-available/capsule
server {
    listen 443 ssl http2;
    server_name capsule.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/capsule.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/capsule.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    location / {
        proxy_pass https://localhost:3443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass https://localhost:8443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Automatic Certificate Renewal

Certbot automatically sets up a cron job or systemd timer for renewal. Verify it:

```bash
# Test renewal (dry-run)
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer  # or cron: sudo crontab -l | grep certbot
```

### Option 3: Commercial Certificates

If you have commercial SSL certificates:

1. Copy your certificate files to `./certs/`:
   - Certificate: `./certs/cert.pem`
   - Private key: `./certs/key.pem`

2. Ensure proper permissions:
   ```bash
   chmod 644 ./certs/cert.pem
   chmod 600 ./certs/key.pem
   ```

3. Include certificate chain if applicable:
   ```bash
   cat your-domain.crt intermediate.crt > ./certs/cert.pem
   ```

### Option 4: Wildcard Certificates

For multiple subdomains (e.g., capsule.example.com, api.example.com):

```bash
# Request wildcard certificate from Let's Encrypt
sudo certbot certonly --manual -d "*.example.com" -d "example.com" \
  --preferred-challenges dns-01

# Follow DNS TXT record prompts
# Copy certificates as in Option 2
```

---

## Environment Configuration

### Required Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Required - Generate a secure random secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Optional - Enable username whitelist
USE_WHITELIST=false

# Whitelist file path (auto-configured in docker-compose.yml)
WHITELIST_FILE=/app/config/whitelist.txt
```

### Generate Secure JWT Secret

```bash
# Generate a strong random secret
openssl rand -base64 32

# Or using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Or using /dev/urandom
cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1
```

### Whitelist Configuration (Optional)

To restrict registration to specific usernames:

1. Enable whitelist in `.env`:
   ```bash
   USE_WHITELIST=true
   ```

2. Edit `config/whitelist.txt`:
   ```bash
   mkdir -p config
   cat > config/whitelist.txt << EOF
   # One username per line
   # Lines starting with # are comments
   # Case-sensitive

   alice
   bob
   charlie
   EOF
   ```

3. Changes to the whitelist file take effect automatically without restart.

---

## Deployment Steps

### Step 1: Prepare Directory Structure

```bash
# Create project directory
mkdir -p capsule
cd capsule

# Create required directories
mkdir -p certs config
```

### Step 2: Download Docker Compose File

```bash
# Download latest release
wget https://github.com/enesbaytekin/capsule/releases/latest/download/docker-compose.release.yml -O docker-compose.yml

# Or download specific version
VERSION="1.0.0"
wget https://github.com/enesbaytekin/capsule/releases/download/v${VERSION}/docker-compose.release.yml -O docker-compose.yml
```

### Step 3: Configure Environment

```bash
# Create .env file
cat > .env << EOF
# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Enable/disable whitelist
USE_WHITELIST=false
EOF
```

### Step 4: Setup SSL Certificates

Choose one of the certificate options from [SSL/TLS Certificate Management](#ssltls-certificate-management).

For testing:
```bash
# If you have the generate-certs.sh script from the repository
./generate-certs.sh
```

Or manually:
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=$(hostname)"
```

### Step 5: Start Application

```bash
# Pull latest images
docker compose pull

# Start containers
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

### Step 6: Verify Deployment

```bash
# Check if services are running
docker compose ps

# Test backend health
curl -k https://localhost:8443/auth/check-username?username=test

# Test frontend
curl -k https://localhost:3443
```

Expected output:
```bash
# docker compose ps
NAME                COMMAND                  SERVICE     STATUS
capsule-backend     "/app/docker-entr…"      backend     running (healthy)
capsule-frontend    "/app/docker-entr…"      frontend    running (healthy)
```

---

## Production Considerations

### Security Best Practices

1. **Use Strong Secrets:**
   ```bash
   # Generate cryptographically secure random secrets
   openssl rand -base64 48
   ```

2. **Firewall Configuration:**
   ```bash
   # Only expose necessary ports
   sudo ufw allow 443/tcp    # HTTPS
   sudo ufw allow 80/tcp     # HTTP for Let's Encrypt
   sudo ufw enable
   ```

3. **Regular Updates:**
   ```bash
   # Update images regularly
   docker compose pull
   docker compose up -d
   ```

4. **Backup Database:**
   ```bash
   # Backup SQLite database
   docker compose exec backend cp /app/data/capsule.db /app/data/capsule.db.backup
   docker cp capsule-backend:/app/data/capsule.db.backup ./backups/capsule-$(date +%Y%m%d).db
   ```

5. **Monitor Logs:**
   ```bash
   # View logs
   docker compose logs -f

   # Rotate logs
   docker compose logs --tail=100 -f
   ```

### Performance Tuning

1. **Database Backups:**
   ```bash
   # Automated backup script
   cat > backup.sh << 'EOF'
   #!/bin/bash
   BACKUP_DIR="./backups"
   mkdir -p "$BACKUP_DIR"
   docker compose exec backend cp /app/data/capsule.db /app/data/capsule.db.backup
   docker cp capsule-backend:/app/data/capsule.db.backup "$BACKUP_DIR/capsule-$(date +%Y%m%d-%H%M%S).db"
   find "$BACKUP_DIR" -name "*.db" -mtime +7 -delete
   EOF

   chmod +x backup.sh
   ```

2. **Resource Limits:**
   ```yaml
   # Add to docker-compose.yml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1.0'
             memory: 512M
           reservations:
             cpus: '0.5'
             memory: 256M
   ```

3. **Persistent Volume Management:**
   ```bash
   # List volumes
   docker volume ls

   # Backup volume
   docker run --rm -v capsule_backend-data:/data -v $(pwd):/backup alpine \
     tar czf /backup/backend-data-backup.tar.gz -C /data .

   # Restore volume
   docker run --rm -v capsule_backend-data:/data -v $(pwd):/backup alpine \
     tar xzf /backup/backend-data-backup.tar.gz -C /data
   ```

### Reverse Proxy Configuration

For production deployment behind a reverse proxy:

**Nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name capsule.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/capsule.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/capsule.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    # Frontend
    location / {
        proxy_pass https://localhost:3443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_verify off;
    }

    # Backend API
    location /api {
        proxy_pass https://localhost:8443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_verify off;
    }
}
```

---

## Troubleshooting

### Container Won't Start

**Check certificates:**
```bash
ls -la certs/
# Should show:
# cert.pem (readable)
# key.pem (readable by owner only)
```

**Check environment variables:**
```bash
docker compose config
```

**View logs:**
```bash
docker compose logs backend
docker compose logs frontend
```

### Certificate Errors

**Browser warnings (self-signed certs):**
- This is expected for self-signed certificates
- For production, use Let's Encrypt or commercial certificates

**Permission denied:**
```bash
chmod 644 certs/cert.pem
chmod 600 certs/key.pem
```

### Database Errors

**Database locked:**
```bash
docker compose restart backend
```

**Reset database (WARNING: deletes all data):**
```bash
docker compose down -v
docker compose up -d
```

### Network Issues

**Ports already in use:**
```bash
sudo netstat -tulpn | grep -E '8443|3443'
# Change ports in docker-compose.yml if needed
```

**Container can't reach backend:**
```bash
docker compose logs frontend
# Ensure both containers are on the same network
docker network inspect capsule_capsule-network
```

### Health Check Failures

```bash
# Check container health
docker compose ps

# Inspect health check
docker inspect capsule-backend | grep -A 10 Health

# Manually test endpoint
curl -k https://localhost:8443/auth/check-username?username=test
```

---

## Updating

### Update to Latest Version

```bash
# Pull new images
docker compose pull

# Restart containers
docker compose up -d

# Remove old images
docker image prune -a
```

### Rollback to Previous Version

```bash
# List available versions
docker images | grep capsule

# Edit docker-compose.yml to use specific version tag
# Then restart:
docker compose up -d
```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/enesbaytekin/capsule/issues
- Documentation: [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)
- API Reference: [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md#api-endpoints)
