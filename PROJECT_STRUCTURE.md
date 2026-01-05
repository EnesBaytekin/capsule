# Time Capsule - Project Structure Documentation

## Overview

**Time Capsule** is a zero-knowledge encrypted storage application where users can store text and images that are encrypted on the client side before upload. The server never sees private keys and cannot decrypt user data.

**Architecture:** Client-side encryption with server-side metadata storage
**Backend:** Go with Gorilla Mux, SQLite database
**Frontend:** Vanilla JavaScript, Web Crypto API
**Deployment:** Docker Compose with HTTPS/TLS

---

## Directory Structure

```
capsule/
├── backend/                      # Go backend API
│   ├── cmd/
│   │   └── api/
│   │       └── main.go          # Application entry point
│   ├── internal/
│   │   ├── auth/                # JWT token generation
│   │   │   └── jwt.go
│   │   ├── config/              # Configuration management
│   │   │   └── config.go        # Environment variable loading
│   │   ├── database/            # Database initialization & migrations
│   │   │   └── database.go
│   │   ├── handlers/            # HTTP request handlers
│   │   │   ├── auth.go          # Register, login, password change
│   │   │   ├── capsule.go       # Capsule CRUD operations
│   │   │   └── keys.go          # Public key management
│   │   ├── middleware/          # HTTP middleware
│   │   │   ├── auth.go          # JWT authentication
│   │   │   └── cors.go          # CORS handling
│   │   ├── models/              # Data models
│   │   │   └── models.go        # Request/response structs
│   │   ├── storage/             # File storage management
│   │   │   └── storage.go       # Encrypted file operations
│   │   └── whitelist/           # Username whitelist feature
│   │       └── whitelist.go     # Whitelist manager with hot-reload
│   ├── go.mod                   # Go module dependencies
│   └── Dockerfile
├── frontend/                     # Frontend application
│   ├── static/
│   │   ├── css/
│   │   │   └── styles.css       # Main stylesheet
│   │   └── js/
│   │       └── app.js           # Main application logic
│   ├── templates/
│   │   └── index.html           # Single page application template
│   ├── main.go                  # Frontend server entry point
│   ├── go.mod
│   └── Dockerfile
├── config/                       # Configuration files
│   └── whitelist.txt            # Username whitelist (one per line)
├── certs/                        # TLS certificates (HTTPS)
│   ├── cert.pem                 # SSL certificate
│   └── key.pem                  # SSL private key
├── data/                         # Persistent data (Docker volume)
│   ├── capsule.db               # SQLite database
│   └── users/                   # Encrypted user files
│       └── user_{id}/
│           └── capsules/
│               └── {uuid}.enc   # Encrypted capsule data
├── docker-compose.yml            # Multi-container orchestration
├── .env                         # Environment variables (not in git)
├── .env.example                 # Environment variables template
└── README.md                    # User documentation
```

---

## Architecture

### Zero-Knowledge Design

1. **Client-side encryption:** All data is encrypted in the browser using Web Crypto API
2. **RSA-4096 key pair:** Generated on client during registration
3. **Private key never leaves client:** Stored in browser localStorage
4. **Server stores only:** Public key (for encryption), encrypted data blobs, metadata
5. **Server cannot decrypt:** Even if compromised, server cannot read user data

### Data Flow

**Registration:**
```
Client → Generates RSA-4096 key pair
       → Sends public key + username + password to server
       → Server stores public key, hashes password with bcrypt
       → Returns JWT token
       → Client stores private key in localStorage
```

**Upload Capsule:**
```
Client → Generates AES-256 key
       → Encrypts data with AES-256-GCM
       → Encrypts AES key with RSA public key
       → Uploads encrypted data + encrypted AES key
       → Server stores without decrypting
```

**Download Capsule:**
```
Client → Requests capsule by ID
Server → Returns encrypted data + encrypted AES key
Client → Decrypts AES key with RSA private key
       → Decrypts data with AES key
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,        -- bcrypt hash
    public_key TEXT NOT NULL,           -- PEM-encoded RSA public key
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Capsules Table
```sql
CREATE TABLE capsules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('text', 'image', 'mixed')),
    file_path TEXT NOT NULL,            -- Path to encrypted file
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

---

## API Endpoints

### Public Endpoints

#### `POST /auth/register`
Registers a new user.

**Request:**
```json
{
  "username": "alice",
  "password": "securepassword123",
  "public_key": "-----BEGIN PUBLIC KEY-----\n..."
}
```

**Response (201 Created):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Whitelist Check:** If `USE_WHITELIST=true`, username must be in `whitelist.txt` (case-sensitive match).

#### `POST /auth/login`
Authenticates user and returns JWT token.

**Request:**
```json
{
  "username": "alice",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `GET /auth/check-username?username={username}`
Checks username availability and whitelist status.

**Response (404 Not Found - available):**
```json
{
  "available": true,
  "in_whitelist": true
}
```

**Response (200 OK - taken):**
```json
{
  "available": false,
  "in_whitelist": true
}
```

### Protected Endpoints (require JWT Bearer token)

#### `POST /keys/upload`
Uploads a new public key for key rotation.

**Request:**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n..."
}
```

#### `GET /keys/public`
Retrieves current user's public key.

**Response (200 OK):**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n..."
}
```

#### `POST /auth/change-password`
Changes user password.

**Request:**
```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword123"
}
```

#### `POST /capsule/upload`
Uploads encrypted capsule data.

**Request (multipart/form-data):**
```
type: "text" | "image" | "mixed"
file: <encrypted binary data>
```

**Response (201 Created):**
```json
{
  "id": 123,
  "message": "Capsule uploaded successfully"
}
```

#### `GET /capsule/list`
Lists all capsules for authenticated user.

**Response (200 OK):**
```json
{
  "capsules": [
    {
      "id": 123,
      "type": "text",
      "created_at": "2025-01-05T10:30:00Z"
    }
  ]
}
```

#### `GET /capsule/download/{id}`
Downloads encrypted capsule by ID.

**Response (200 OK):**
- Binary encrypted data

---

## Configuration

### Environment Variables

Located in `.env` file (use `.env.example` as template):

```bash
# JWT Secret (required for production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=8443                              # Default: 8080

# Database & Storage
DATABASE_PATH=/app/data/capsule.db     # Default: ./data/capsule.db
STORAGE_PATH=/app/data/users           # Default: ./data/users

# TLS/SSL Certificates (for HTTPS)
TLS_CERT=/app/certs/cert.pem
TLS_KEY=/app/certs/key.pem

# Whitelist Feature
USE_WHITELIST=false                    # Enable/disable whitelist
WHITELIST_FILE=/app/config/whitelist.txt  # Path to whitelist file
```

### Whitelist Feature

**Purpose:** Restrict registration to specific usernames only.

**Configuration:**
1. Set `USE_WHITELIST=true` in `.env`
2. Edit `config/whitelist.txt`:
   ```
   # One username per line
   # Case-sensitive (bob, Bob, BOB are different)
   bob
   alice
   charlie
   ```

**Behavior:**
- When enabled: Only usernames in whitelist can register
- Hot-reload: Changes to `whitelist.txt` take effect within 100ms without restart
- Case-sensitive: Exact username match required
- When disabled: Anyone can register

---

## Frontend Structure

### Single Page Application (SPA)

Located in `frontend/templates/index.html`

**Main Components:**

1. **Registration Flow** (app.js:1264+)
   - Client-side RSA-4096 key generation using Web Crypto API
   - Encrypts password before sending (optional double encryption)
   - Stores private key in localStorage: `localStorage.getItem('privateKey')`

2. **Login Flow** (app.js:1200+)
   - Authenticates with username/password
   - Receives JWT token
   - Retrieves stored private key from localStorage

3. **Capsule Upload** (app.js:900+)
   - Type selection: text, image, or mixed
   - Text content: Captured from textarea
   - Image content: File input
   - Encryption flow:
     - Generate random AES-256 key
     - Encrypt content with AES-256-GCM
     - Encrypt AES key with RSA public key
     - Upload as multipart/form-data

4. **Capsule List & Download** (app.js:700+)
   - Fetch user's capsules
   - Download and decrypt on demand
   - Decryption flow:
     - Decrypt AES key with RSA private key
     - Decrypt content with AES key
     - Display or trigger download

5. **Username Validation** (app.js:1222+)
   - Debounced (500ms) real-time checking
   - Shows availability status
   - Shows whitelist status when enabled
   - Messages:
     - "Checking availability..." (yellow)
     - "✓ Username is available" (green)
     - "✗ Username is already taken" (red)
     - "This username is not in the whitelist" (red)

### Key Frontend Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `handleRegister()` | app.js:1264 | User registration with key generation |
| `handleLogin()` | app.js:1200 | User authentication |
| `handleUpload()` | app.js:900 | Encrypt and upload capsule |
| `loadCapsules()` | app.js:700 | List user's capsules |
| `decryptAndDownload()` | app.js:800 | Decrypt and display/download capsule |
| `checkUsernameAvailability()` | app.js:1222 | Real-time username validation |
| `generateKeyPair()` | app.js:1100 | RSA-4096 key generation |
| `encryptData()` | app.js:1000 | AES-256-GCM encryption |
| `decryptData()` | app.js:1050 | AES-256-GCM decryption |

---

## Backend Handlers

### Auth Handler (`internal/handlers/auth.go`)

**Functions:**
- `Register()` - User registration with whitelist check
- `Login()` - User authentication with password verification
- `CheckUsername()` - Username availability + whitelist status
- `ChangePassword()` - Password update with current password verification

**Dependencies:**
- Database (for user lookups)
- Whitelist manager (for registration control)
- JWT secret (for token generation)
- bcrypt (cost factor: 12)

### Capsule Handler (`internal/handlers/capsule.go`)

**Functions:**
- `UploadCapsule()` - Accepts encrypted file, stores on disk
- `ListCapsules()` - Returns user's capsule metadata
- `DownloadCapsule()` - Streams encrypted file to client

**File Storage:**
- Pattern: `users/user_{id}/capsules/{uuid}.enc`
- Server never decrypts files
- UUID prevents filename collisions

### Key Handler (`internal/handlers/keys.go`)

**Functions:**
- `UploadPublicKey()` - Key rotation (replace existing public key)
- `GetPublicKey()` - Retrieve current public key for encryption

**Important:** Old encrypted data cannot be decrypted after key rotation unless client re-encrypts with new key.

---

## Middleware

### Auth Middleware (`internal/middleware/auth.go`)

**Purpose:** Validates JWT tokens on protected routes.

**Implementation:**
- Extracts `Authorization: Bearer <token>` header
- Validates token signature using `JWT_SECRET`
- Extracts user ID and username from token claims
- Adds user context to request: `context.WithValue(r.Context(), "userID", userID)`

**Helper:** `GetUserID(r *http.Request)` retrieves user ID from context.

### CORS Middleware (`internal/middleware/cors.go`)

**Purpose:** Handles cross-origin requests.

**Headers:**
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- OPTIONS requests return 200 OK immediately

---

## Whitelist System

### Manager (`internal/whitelist/whitelist.go`)

**Features:**
- Thread-safe with RWMutex
- Hot-reload with file system watcher (fsnotify)
- 100ms debounce to prevent multiple reloads
- Case-sensitive username matching
- Auto-creates whitelist file if missing

**Key Methods:**
- `New(enabled bool, filePath string)` - Initialize manager
- `IsAllowed(username string) bool` - Check if username can register
- `Reload()` - Manual reload
- `Stop()` - Cleanup watcher

**File Format:**
```
# Lines starting with # are comments
bob
alice
charlie
```

---

## Docker Deployment

### Docker Compose Configuration

**Services:**

1. **Backend** (`capsule-backend`)
   - Port: 8443 (HTTPS)
   - Volume mounts:
     - `backend-data:/app/data` (persistent)
     - `./certs:/app/certs:ro` (TLS certificates)
     - `./config:/app/config:ro` (whitelist file)
   - Environment: From `.env` file

2. **Frontend** (`capsule-frontend`)
   - Port: 3443 (HTTPS)
   - Volume mounts:
     - `./certs:/app/certs:ro` (TLS certificates)
   - Depends on: backend

**Networks:**
- `capsule-network` (bridge network)

### Deployment Steps

1. **Generate TLS certificates:**
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes
   ```

2. **Create `.env` file:**
   ```bash
   JWT_SECRET=<generate-strong-secret>
   USE_WHITELIST=true  # Optional
   ```

3. **Configure whitelist (if enabled):**
   ```bash
   vim config/whitelist.txt
   ```

4. **Start containers:**
   ```bash
   docker-compose up -d
   ```

5. **Access:**
   - Frontend: https://localhost:3443
   - Backend API: https://localhost:8443

---

## Security Features

1. **Zero-knowledge architecture:** Server cannot decrypt user data
2. **RSA-4096:** Industry-standard asymmetric encryption
3. **AES-256-GCM:** Symmetric encryption for data (authenticated encryption)
4. **bcrypt:** Password hashing with cost factor 12
5. **JWT tokens:** 24-hour expiration, signed with secret
6. **HTTPS only:** TLS certificates required for production
7. **Whitelist:** Optional username restrictions
8. **CORS:** Configurable for specific origins
9. **SQL injection prevention:** Parameterized queries
10. **Private key isolation:** Never transmitted to server

---

## Development Workflow

### Running Locally

1. **Backend:**
   ```bash
   cd backend
   go run cmd/api/main.go
   ```

2. **Frontend:**
   ```bash
   cd frontend
   go run main.go
   ```

3. **With Docker:**
   ```bash
   docker-compose up
   ```

### Building

```bash
# Backend
cd backend
go build -o capsule-api ./cmd/api

# Frontend
cd frontend
go build -o capsule-frontend .
```

### Dependencies

**Backend Go modules:**
- `github.com/golang-jwt/jwt/v5` - JWT tokens
- `github.com/gorilla/mux` - HTTP routing
- `github.com/mattn/go-sqlite3` - SQLite driver
- `github.com/fsnotify/fsnotify` - File watcher for whitelist
- `golang.org/x/crypto/bcrypt` - Password hashing

---

## Important Notes

### Key Rotation
When user uploads new public key:
- Old encrypted data CANNOT be decrypted with new key
- Client must re-encrypt all data with new public key
- Or keep old key for decrypting legacy data

### Database Backups
SQLite database is at:
- Local: `./data/capsule.db`
- Docker: `backend-data` volume

Backup command:
```bash
cp data/capsule.db data/capsule.db.backup
```

### Whitelist File
- Location: `config/whitelist.txt`
- Auto-reloads on save (100ms debounce)
- Can be edited while server is running
- Empty file = no one can register (when enabled)

### Private Key Storage
Client-side localStorage: `localStorage.getItem('privateKey')`
- Cleared when browser data is cleared
- Users should export/backup their private keys
- Lost private key = lost access to all data

---

## Troubleshooting

### Common Issues

1. **CORS errors:** Check CORS middleware, ensure frontend origin allowed
2. **JWT errors:** Verify JWT_SECRET matches between frontend and backend
3. **Certificate errors:** Generate new TLS certs, verify paths in docker-compose.yml
4. **Whitelist not working:** Check USE_WHITELIST=true and file path
5. **Cannot decrypt data:** Private key may be lost, check browser localStorage
6. **Database locked:** SQLite file may be corrupted, restore from backup

---

## Future Enhancements

Potential improvements:
- Email verification for registration
- Rate limiting on auth endpoints
- Password reset flow (security challenge questions)
- Private key export/import
- End-to-end encrypted sharing between users
- Multi-factor authentication
- Audit logging
- Data expiration (self-destructing capsules)
- S3-compatible storage backend
- PostgreSQL support for horizontal scaling
