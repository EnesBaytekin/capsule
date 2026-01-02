package models

import "time"

// User represents a user in the system
// IMPORTANT: We only store the public key, never the private key
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never expose in JSON
	PublicKey    string    `json:"public_key"` // PEM-encoded public key
	CreatedAt    time.Time `json:"created_at"`
}

// Capsule represents an encrypted time capsule
// The server stores ONLY metadata and references to encrypted files
// The actual content is encrypted on the client before upload
type Capsule struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Type      string    `json:"type"` // "text", "image", or "mixed"
	FilePath  string    `json:"file_path"` // Path to encrypted file on disk
	CreatedAt time.Time `json:"created_at"`
}

// UploadRequest represents a capsule upload request from client
// All data in this request is already encrypted on the client side
type UploadRequest struct {
	Type           string `json:"type"` // "text", "image", or "mixed"
	EncryptedData  []byte `json:"encrypted_data"` // AES-256-GCM encrypted content
	EncryptedAESKey []byte `json:"encrypted_aes_key"` // RSA-OAEP encrypted AES key
	Nonce          []byte `json:"nonce"` // GCM nonce for decryption
}

// RegisterRequest represents user registration
type RegisterRequest struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	PublicKey string `json:"public_key"` // PEM-encoded public key
}

// LoginRequest represents user login
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthResponse represents successful authentication response
type AuthResponse struct {
	Token string `json:"token"`
}

// KeyUploadRequest represents public key upload (for key rotation)
type KeyUploadRequest struct {
	PublicKey string `json:"public_key"` // PEM-encoded public key
}
