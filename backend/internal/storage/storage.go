package storage

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
)

// Storage handles encrypted file storage
// IMPORTANT: This storage ONLY handles encrypted data
// The server never attempts to decrypt these files
type Storage struct {
	basePath string
}

// New creates a new Storage instance
func New(basePath string) (*Storage, error) {
	// Ensure base directory exists
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	return &Storage{
		basePath: basePath,
	}, nil
}

// SaveEncryptedFile saves an encrypted file to disk
// The data parameter is already encrypted by the client
// Returns the file path for storage in database
func (s *Storage) SaveEncryptedFile(userID int64, encryptedData []byte) (string, error) {
	// Create user directory
	userDir := filepath.Join(s.basePath, fmt.Sprintf("user_%d", userID), "capsules")
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create user directory: %w", err)
	}

	// Generate unique filename
	filename, err := generateUUID()
	if err != nil {
		return "", fmt.Errorf("failed to generate filename: %w", err)
	}

	filePath := filepath.Join(userDir, filename+".enc")

	// Write encrypted data to disk
	if err := os.WriteFile(filePath, encryptedData, 0644); err != nil {
		return "", fmt.Errorf("failed to write encrypted file: %w", err)
	}

	// Return relative path for database storage
	return filepath.Join(fmt.Sprintf("user_%d", userID), "capsules", filename+".enc"), nil
}

// ReadEncryptedFile reads an encrypted file from disk
// Returns the encrypted bytes - decryption happens on the client
func (s *Storage) ReadEncryptedFile(relativePath string) ([]byte, error) {
	fullPath := filepath.Join(s.basePath, relativePath)

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read encrypted file: %w", err)
	}

	return data, nil
}

// DeleteFile deletes a file from disk
func (s *Storage) DeleteFile(relativePath string) error {
	fullPath := filepath.Join(s.basePath, relativePath)

	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

// generateUUID generates a random UUID v4
func generateUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	// Set version bits to 4 (random UUID)
	b[6] = (b[6] & 0x0f) | 0x40
	// Set variant bits to RFC 4122
	b[8] = (b[8] & 0x3f) | 0x80

	return hex.EncodeToString(b), nil
}
