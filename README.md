# 🕰️ Time Capsule

Time Capsule is a **self-hosted** web application for securely storing personal memories (text and images) and accessing them later.

You can use it as a digital time capsule:
- **Write memories** throughout the year
- **Lock them** away
- **Open them** in the future using your private key.

The core idea is simple:\
**Your data is encrypted before it leaves your browser, and the server can never read it.**

## 🎯 What is this for?

- Storing personal notes and journals securely
- Saving private photos with strong privacy guarantees
- Creating long-term memory archives (yearly, event-based, etc.)
- Hosting a shared service for friends while keeping everyone’s data isolated

The application is designed to be **self-hosted**, giving you full control over your data.

## ✨ Features

- Client-side (end-to-end) encryption
- Multi-user support on a single server
- Zero-knowledge server (no plaintext, no private keys)
- Text and image capsules
- Secure authentication
- Simple and modern web interface
- Fully self-hosted with Docker

## 🚀 Getting Started

### Requirements

- Docker
- Docker Compose

### HTTPS Setup (Required)

This application runs **HTTPS-only**.

You must provide TLS certificates in the `certs/` directory:

```
certs/
  ├─ cert.pem
  └─ key.pem
```

For local or self-hosted setups, you can generate a self-signed certificate by running this script or using your own method:

```bash
./generate-certs.sh
```

You may also use certificates from a trusted CA (e.g. Let’s Encrypt) for production.


### Configure JWT secret (optional but recommended)
Edit `.env` and change `JWT_SECRET`

```bash
cp .env.example .env
```

### Run the Application

```bash
docker compose up -d
```

The application will be available at:

```
https://localhost:3443
```

## 👤 Typical User Flow

1. Register and log in
2. Generate a cryptographic key pair (client-side)
3. Download and safely store your private key
4. Add text or image memories (encrypted locally)
5. Later, load your private key to view and decrypt your memories

If you lose your private key, your data is permanently inaccessible.\
This is an intentional trade-off for strong privacy.

## 🏗️ Architecture
```
.---------------------------------.                                   
| Local Machine                   |                                   
|               .---------.       |                                   
|               | private |       |                                   
|               '----^----'       |                                   
|                    |  |         |                                   
| .------------------|--|-------. |           .----------------------.
| | Browser          |  |       | |           | Server               |
| |                  |  |       | |           |                      |
| |                  |  |       | |           |                      |
| | Register:        |  |       | |           |                      |
| |                  |  |       | |           | .------------------. |
| | .------------.   |  |       | |           | | SQLite           | |
| | | Key Pair   |   |  |       | |           | |                  | |
| | |.---------. |   |  |       | |           | |                  | |
| | || private |-----'  |       | |           | |                  | |
| | |'---------' |      |       | |           | |                  | |
| | |.--------.  |      |       | |           | |   .--------.     | |
| | || public |---------|----------->-HTTPS->------>| public |     | |
| | |'--------'  |      |       | |           | |   '--------'     | |
| | '------------'      |       | |           | |       |          | |
| |                     |       | |           | |       |          | |
| |            .--------'       | |           | |       |          | |
| | Upload:    |                | |           | |       |          | |
| |            |     .-------.  | |           | |       |          | |
| |            |     | Plain |  | |           | |       |          | |
| |            |     | Data  |  | |           | |       |          | |
| |            |     '-------'  | |           | |       |          | |
| |            |         |      | |           | |       |          | |
| |            |         o----------<-HTTPS-<-----------'          | |
| |            |         |      | |           | |                  | |
| |            |         |      | |           | |                  | |
| |            |    .----v----. | |           | |   .---------.    | |
| |            |    |Encrypted| | |           | |   |Encrypted|    | |
| |            |    |  Data   |----->-HTTPS->------>|  Data   |    | |
| |            |    '---------' | |           | |   '---------'    | |
| | View:      |                | |           | |       |          | |
| |            |                | |           | |       |          | |
| | .-------.  |  .---------.   | |           | |       |          | |
| | | Plain |  |  |Encrypted|   | |           | |       |          | |
| | | Data  |<-o--|  Data   |<------<-HTTPS-<-----------'          | |
| | '-------'     '---------'   | |           | |                  | |
| |                             | |           | |                  | |
| '-----------------------------' |           | '------------------' |
|                                 |           |                      |
'---------------------------------'           '----------------------'
```

The backend never decrypts any data.

## 🛠 Tech Stack

### Backend

- Go
- SQLite
- JWT authentication

### Frontend

- HTML / CSS / JavaScript
- Web Crypto API

### Infrastructure

- Docker
- Docker Compose
- Persistent volumes

## 📦 Production Deployment

For production deployments, pre-built Docker images are available on Docker Hub:

```bash
# Backend
enesbaytekin/capsule-server:latest

# Frontend
enesbaytekin/capsule-ui:latest
```

### Quick Production Setup

1. **Download the production docker-compose file:**
   ```bash
   wget https://github.com/enesbaytekin/capsule/releases/latest/download/docker-compose.release.yml -O docker-compose.yml
   ```

2. **Run the automated setup script:**
   ```bash
   ./.release/setup.sh
   ```

This will:
- Create required directories
- Generate a secure JWT secret
- Guide you through SSL certificate setup (Let's Encrypt recommended)
- Pull Docker images
- Start the application

### Manual Setup

For manual setup or custom configurations, see the [Deployment Guide](docs/DEPLOYMENT.md).

### Certificate Management

For production, use trusted SSL certificates:

- **Let's Encrypt (Free):** Automated certificate authority
- **Commercial Certificates:** From your preferred CA
- **Self-Signed:** For testing only (browsers will show warnings)

See [SSL/TLS Certificate Management](docs/DEPLOYMENT.md#ssltls-certificate-management) in the deployment guide.

### Backup & Restore

The project includes helper scripts for managing your deployment:

- **Setup:** `.release/setup.sh` - Initial production setup
- **Backup:** `.release/backup.sh` - Backup database and data
- **Restore:** `.release/restore.sh` - Restore from backup
- **Update:** `.release/update.sh` - Update to latest version

See [.release/README.md](.release/README.md) for details.

## 🔄 Updates & Releases

### Using Release Tags

When you push a git tag (e.g., `v1.0.0`), the GitHub Actions workflow will:

1. Build Docker images for both backend and frontend
2. Push images to Docker Hub with version tags
3. Create a GitHub release with assets
4. Attach the production docker-compose file

Example:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Manual Build

To build images locally:
```bash
docker compose build
```

### Update Production

To update to the latest version:
```bash
# Using the update script (includes automatic backup)
./.release/update.sh

# Or manually:
docker compose pull
docker compose up -d
```

## 📚 Documentation

- [Project Structure](PROJECT_STRUCTURE.md) - Detailed architecture and API documentation
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment instructions
- [Release Scripts](.release/README.md) - Helper scripts for production management
