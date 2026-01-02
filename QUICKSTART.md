# Time Capsule - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Docker installed and running
- Docker Compose installed

### Starting the Application

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

## 📝 First Time Setup

### 1. Register a New Account

1. Open http://localhost:3000
2. Click the **"Register"** tab
3. Enter a username and password
4. **CRITICAL**: Click **"Generate Encryption Keys"**
5. **CRITICAL**: Download your private key using the **"Download Private Key"** button
6. Save your private key in a secure location (password manager, encrypted USB, etc.)
7. Click **"Register"**

### 2. Create Your First Capsule

1. After registration, login with your credentials
2. Paste your private key in the **"Private Key Required"** section
3. Click **"Unlock Capsules"**
4. Select type: **"Text"** or **"Image"**
5. Enter your message or select an image
6. Click **"Encrypt & Upload"**

### 3. View a Capsule

1. Click **"Decrypt & View"** on any capsule
2. The content will be decrypted in your browser

## 🔐 How It Works

### Upload Process (Client-Side Encryption)

```
Your Data (Plaintext)
    ↓
Generate Random AES-256 Key
    ↓
Encrypt with AES-256-GCM → Encrypted Content
    ↓
Encrypt AES Key with RSA-4096-OAEP (using your public key)
    ↓
Send ONLY Encrypted Data to Server
    ↓
Server stores encrypted file (cannot decrypt)
```

### Download Process (Client-Side Decryption)

```
Download Encrypted File from Server
    ↓
Decrypt AES Key using your Private Key (RSA-OAEP)
    ↓
Decrypt Content using AES Key (AES-GCM)
    ↓
Display Plaintext in Browser
```

## ⚠️ CRITICAL SECURITY NOTES

### Private Key Management

**If you lose your private key, your data is PERMANENTLY unrecoverable.**

**DO:**
- Save your private key in a password manager
- Keep an offline backup on an encrypted USB drive
- Store multiple copies in different secure locations

**DON'T:**
- Share your private key with anyone
- Upload your private key to the server
- Lose your only copy

### What the Server Knows

The server stores:
- Your username and bcrypt-hashed password
- Your public key (cannot decrypt data)
- Encrypted files (cannot read content)
- Metadata (file type, creation date)

The server does NOT know:
- Your plaintext data
- Your private key
- Your AES encryption keys

Even if the database and disk are stolen, all files remain encrypted.

## 🛠️ Troubleshooting

### Docker Issues

```bash
# Rebuild containers
docker compose build --no-cache

# Remove old volumes and start fresh
docker compose down -v
docker compose up -d
```

### Can't Decrypt Capsules

- Ensure you're using the correct private key
- The private key must be the one generated during registration
- Without the original private key, data cannot be recovered

### Want to Test Without Docker?

```bash
# Backend
cd backend
go run cmd/api/main.go

# Frontend (in another terminal)
cd frontend
go run main.go
```

## 📂 Project Structure

```
capsule/
├── backend/              # Go backend API
│   ├── cmd/api/         # Main entry point
│   ├── internal/        # Internal packages
│   │   ├── auth/        # JWT authentication
│   │   ├── config/      # Configuration
│   │   ├── database/    # SQLite database
│   │   ├── handlers/    # HTTP handlers
│   │   ├── middleware/  # JWT middleware
│   │   ├── models/      # Data models
│   │   └── storage/     # Encrypted file storage
│   └── Dockerfile
│
├── frontend/            # Go frontend server
│   ├── static/
│   │   ├── css/        # Styles
│   │   └── js/         # Client-side encryption logic
│   ├── templates/      # HTML templates
│   ├── main.go         # Frontend server
│   └── Dockerfile
│
├── docker-compose.yml
├── README.md           # Full documentation
└── QUICKSTART.md       # This file
```

## 🔄 Development Workflow

### Local Development

```bash
# Terminal 1: Backend
cd backend
go run cmd/api/main.go

# Terminal 2: Frontend
cd frontend
go run main.go
```

### Production Deployment

1. Change `JWT_SECRET` in `.env`
2. Use a reverse proxy (nginx/caddy) for HTTPS
3. Set up database backups (of encrypted data)
4. Monitor logs for suspicious activity

## 📚 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token

### Keys
- `POST /keys/upload` - Update public key
- `GET /keys/public` - Get your public key

### Capsules
- `POST /capsule/upload` - Upload encrypted capsule
- `GET /capsule/list` - List your capsules
- `GET /capsule/download/:id` - Download encrypted capsule

All API endpoints require JWT authentication except registration and login.

## 🎯 Next Steps

1. **Change the JWT secret** in production
2. **Set up HTTPS** with a reverse proxy
3. **Configure automated backups** of the Docker volume
4. **Test the system** with non-critical data first
5. **Save your private key** in multiple secure locations

---

Need help? Check the full [README.md](README.md) for detailed documentation.
