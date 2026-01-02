package handlers

import (
	"capsule/internal/middleware"
	"capsule/internal/models"
	"database/sql"
	"encoding/json"
	"net/http"
)

type KeyHandler struct {
	db *sql.DB
}

func NewKeyHandler(db *sql.DB) *KeyHandler {
	return &KeyHandler{
		db: db,
	}
}

// UploadPublicKey allows users to upload/update their public key
// This is useful for key rotation
// The server only stores public keys - private keys remain on the client
func (h *KeyHandler) UploadPublicKey(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.KeyUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.PublicKey == "" {
		http.Error(w, "Public key is required", http.StatusBadRequest)
		return
	}

	// Update user's public key
	_, err := h.db.Exec(
		"UPDATE users SET public_key = ? WHERE id = ?",
		req.PublicKey,
		userID,
	)

	if err != nil {
		http.Error(w, "Failed to update public key", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// GetPublicKey retrieves the current user's public key
// This is needed by the client to verify which public key is stored
func (h *KeyHandler) GetPublicKey(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var publicKey string
	err := h.db.QueryRow(
		"SELECT public_key FROM users WHERE id = ?",
		userID,
	).Scan(&publicKey)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to retrieve public key", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	encoder.Encode(map[string]string{
		"public_key": publicKey,
	})
}
