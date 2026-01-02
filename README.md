# 🔒 Time Capsule - Zero-Knowledge Encrypted Storage

A self-hosted, zero-knowledge web application for storing personal memories (text and images) with client-side encryption. The server never sees your plaintext data or private keys.

## 🎯 Security Guarantees

- **Client-side encryption ONLY** - All encryption happens in your browser
- **Zero-knowledge server** - The server stores only encrypted blobs + metadata
- **Private keys NEVER stored on server** - You keep your private key locally
- **AES-256-GCM encryption** - Industry-standard symmetric encryption
- **RSA-4096-OAEP key encryption** - Military-grade asymmetric encryption
- **Protected even if database is stolen** - All files remain encrypted

## 🏗️ Architecture

```
┌─────────────┐                    ┌──────────────┐
│   Browser   │                    │   Server     │
│             │                    │              │
│  ┌────────┐ │                    │  ┌────────┐  │
│  │ Plain  │ │                    │  │        │  │
│  │  Data  │ │                    │  │  Enc   │  │
│  └────┬───┘ │                    │  │  Data  │  │
│       │     │                    │  │        │  │
│       ▼     │                    │  └────────┘  │
│  ┌────────┐ │   Encrypted Only   │              │
│  │ AES-   │ │ ─────────────────► │              │
│  │ GCM    │ │                    │              │
│  │ Encrypt│ │                    │              │
│  └────────┘ │                    │              │
└─────────────┘                    └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker
- Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd capsule
   ```

2. **Configure JWT secret** (optional but recommended)
   ```bash
   cp .env.example .env
   # Edit .env and change JWT_SECRET
   ```

3. **Start the application**
   ```bash
   docker compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

## 📖 Usage Guide

### Registration & Key Generation

1. Navigate to http://localhost:3000
2. Click "Register" tab
3. Enter username and password
4. **Click "Generate Encryption Keys"**
5. **IMPORTANT**: Download and save your private key safely!
   - You cannot recover data without your private key
   - The server never stores it
   - Save it in a secure location (password manager, encrypted USB, etc.)
6. Click "Register"

### Creating a Capsule

1. Login with your credentials
2. Paste your private key in the "Private Key Required" section
3. Click "Unlock Capsules"
4. Choose type: "Text" or "Image"
5. For text: Type your message
6. For image: Select an image file
7. Click "Encrypt & Upload"

**What happens during upload:**
- Your data is encrypted with AES-256-GCM in your browser
- A random AES key is generated
- The AES key is encrypted with your RSA-4096 public key
- ONLY encrypted data is sent to the server
- Server stores encrypted file on disk (cannot decrypt)

### Viewing a Capsule

1. Ensure you're unlocked with your private key
2. Click "Decrypt & View" on any capsule
3. Browser downloads encrypted file
4. Decrypts AES key using your private key
5. Decrypts content using AES key
6. Displays content

**What happens during download:**
- Server returns encrypted file only
- Decryption happens entirely in your browser
- Server never sees plaintext

## 🔐 Encryption Details

### Encryption Flow (Upload)

1. **Client generates random AES-256 key**
2. **Client encrypts content with AES-GCM**
   - Uses 12-byte random nonce
   - Authenticated encryption (prevents tampering)
3. **Client encrypts AES key with RSA-OAEP**
   - Uses user's public key (stored on server)
   - Only user's private key can decrypt
4. **Client sends to server:**
   - `encrypted_data` - AES-GCM encrypted content
   - `encrypted_aes_key` - RSA-OAEP encrypted AES key
   - `nonce` - GCM nonce
5. **Server stores:**
   - Encrypted file on disk: `encrypted_aes_key + nonce + encrypted_data`
   - Metadata in database: user_id, type, file_path

### Decryption Flow (Download)

1. **Client downloads encrypted file**
2. **Client decrypts AES key**
   - Uses RSA-OAEP with private key
   - Extracts `encrypted_aes_key` from first 256 bytes
3. **Client decrypts content**
   - Uses AES-GCM with decrypted AES key
   - Extracts `nonce` from next 12 bytes
   - Decrypts remaining data
4. **Client displays content**

### Cryptographic Primitives

- **AES-256-GCM**: Symmetric encryption for content
  - 256-bit key
  - Galois/Counter Mode (authenticated)
  - 12-byte nonce
- **RSA-4096-OAEP**: Asymmetric encryption for key wrapping
  - 4096-bit modulus
  - Optimal Asymmetric Encryption Padding
  - SHA-256 hash
- **bcrypt**: Password hashing
  - Cost factor: 12
- **JWT**: Session tokens
  - HS256 signing
  - 24-hour expiration

## 📁 Project Structure

```
capsule/
├── backend/
│   ├── cmd/
│   │   └── api/
│   │       └── main.go           # Backend entry point
│   ├── internal/
│   │   ├── auth/                 # JWT authentication
│   │   ├── config/               # Configuration
│   │   ├── database/             # SQLite database
│   │   ├── handlers/             # HTTP handlers
│   │   ├── middleware/           # JWT middleware
│   │   ├── models/               # Data models
│   │   └── storage/              # Encrypted file storage
│   ├── Dockerfile
│   └── go.mod
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css         # Styles
│   │   └── js/
│   │       └── app.js            # Client-side encryption logic
│   ├── templates/
│   │   └── index.html            # Main UI
│   ├── main.go                   # Frontend server
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /auth/register` - Register new user (with public key)
- `POST /auth/login` - Login and receive JWT token

### Keys
- `POST /keys/upload` - Upload/update public key
- `GET /keys/public` - Get your stored public key

### Capsules
- `POST /capsule/upload` - Upload encrypted capsule
- `GET /capsule/list` - List your capsules (metadata only)
- `GET /capsule/download/:id` - Download encrypted capsule

## ⚠️ Security Considerations

### Private Key Management

**CRITICAL**: If you lose your private key, your data is permanently unrecoverable.

**Best practices:**
- Store private key in a password manager
- Keep an offline backup (encrypted USB drive)
- Never share your private key
- Never upload private key to the server

### Password Security

- Use a strong, unique password
- The password protects your account (not your data)
- Even if someone has your password, they cannot decrypt data without your private key

### Server Security

- Change the default JWT_SECRET in production
- Use HTTPS in production (reverse proxy with nginx/caddy)
- Keep the application updated
- Regular database backups (of encrypted data)

## 🐳 Docker Volumes

The application uses Docker volumes for persistent storage:

- `backend-data`: Contains SQLite database and encrypted files
  - Database: `/app/data/capsule.db`
  - Encrypted storage: `/app/data/users/`

## 🔒 Database Schema

### users
- `id` - Primary key
- `username` - Unique username
- `password_hash` - Bcrypt hashed password
- `public_key` - PEM-encoded RSA public key
- `created_at` - Timestamp

### capsules
- `id` - Primary key
- `user_id` - Foreign key to users
- `type` - "text" or "image"
- `file_path` - Path to encrypted file on disk
- `created_at` - Timestamp

**Note**: The database NEVER stores plaintext content or private keys.

## 🛠️ Development

### Backend Development

```bash
cd backend
go mod download
go run cmd/api/main.go
```

### Frontend Development

```bash
cd frontend
go run main.go
```

### Building Docker Images

```bash
docker compose build
```

## 📝 License

MIT License - Feel free to use and modify for your own needs.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Security principles are maintained
- Client-side encryption is never compromised
- Tests pass
- Code is documented

## ⚠️ Disclaimer

This project is provided as-is for educational and personal use. While strong cryptographic primitives are used, no security system is perfect. Always:
- Keep regular backups of encrypted data
- Test the system before storing critical data
- Keep private keys secure
- Use strong passwords

---

Made with ❤️ for privacy and security
