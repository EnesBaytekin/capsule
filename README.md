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
