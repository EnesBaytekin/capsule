package handlers

import (
	"capsule/internal/middleware"
	"capsule/internal/models"
	"capsule/internal/storage"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type CapsuleHandler struct {
	db            *sql.DB
	fileStorage   *storage.Storage
}

func NewCapsuleHandler(db *sql.DB, fileStorage *storage.Storage) *CapsuleHandler {
	return &CapsuleHandler{
		db:          db,
		fileStorage: fileStorage,
	}
}

// UploadCapsule handles uploading an encrypted capsule
// CRITICAL: All data received here is already encrypted on the client
// The server stores the encrypted blob without attempting to decrypt
func (h *CapsuleHandler) UploadCapsule(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.UploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Type != "text" && req.Type != "image" && req.Type != "mixed" {
		http.Error(w, "Type must be 'text', 'image', or 'mixed'", http.StatusBadRequest)
		return
	}

	if len(req.EncryptedData) == 0 || len(req.EncryptedAESKey) == 0 || len(req.Nonce) == 0 {
		http.Error(w, "Encrypted data, AES key, and nonce are required", http.StatusBadRequest)
		return
	}

	// Combine encrypted data with metadata for storage
	// We store: encrypted_aes_key + nonce + encrypted_content
	// This structure allows the client to decrypt everything later
	encryptedFile := append(req.EncryptedAESKey, req.Nonce...)
	encryptedFile = append(encryptedFile, req.EncryptedData...)

	// Save encrypted file to disk
	filePath, err := h.fileStorage.SaveEncryptedFile(userID, encryptedFile)
	if err != nil {
		http.Error(w, "Failed to save encrypted file", http.StatusInternalServerError)
		return
	}

	// Store metadata in database
	var capsuleID int64
	err = h.db.QueryRow(
		"INSERT INTO capsules (user_id, type, file_path) VALUES (?, ?, ?) RETURNING id",
		userID,
		req.Type,
		filePath,
	).Scan(&capsuleID)

	if err != nil {
		http.Error(w, "Failed to create capsule record", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      capsuleID,
		"message": "Capsule uploaded successfully",
	})
}

// ListCapsules returns paginated capsules for the authenticated user
// Note: We only return metadata, not the actual encrypted content
func (h *CapsuleHandler) ListCapsules(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// Parse pagination parameters
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page := 1
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p >= 1 {
			page = p
		}
	}

	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l >= 1 && l <= 50 {
			limit = l
		}
	}

	// Get total count
	var totalCount int64
	err := h.db.QueryRow("SELECT COUNT(*) FROM capsules WHERE user_id = ?", userID).Scan(&totalCount)
	if err != nil {
		http.Error(w, "Failed to count capsules", http.StatusInternalServerError)
		return
	}

	// Calculate offset
	offset := (page - 1) * limit

	// Query paginated capsules
	rows, err := h.db.Query(
		"SELECT id, type, file_path, created_at FROM capsules WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
		userID,
		limit,
		offset,
	)

	if err != nil {
		http.Error(w, "Failed to retrieve capsules", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var capsules []models.Capsule
	capsules = make([]models.Capsule, 0)

	for rows.Next() {
		var c models.Capsule
		if err := rows.Scan(&c.ID, &c.Type, &c.FilePath, &c.CreatedAt); err != nil {
			http.Error(w, "Failed to scan capsule", http.StatusInternalServerError)
			return
		}
		capsules = append(capsules, c)
	}

	// Calculate if there are more pages
	hasMore := int64(page*limit) < totalCount

	// Build paginated response
	response := map[string]interface{}{
		"capsules":    capsules,
		"total_count": totalCount,
		"page":        page,
		"limit":       limit,
		"has_more":    hasMore,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DownloadCapsule downloads an encrypted capsule
// CRITICAL: The server returns encrypted data only
// Decryption happens on the client side using the user's private key
func (h *CapsuleHandler) DownloadCapsule(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// Extract capsule ID from URL
	vars := mux.Vars(r)
	capsuleIDStr := vars["id"]

	capsuleID, err := strconv.ParseInt(capsuleIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid capsule ID", http.StatusBadRequest)
		return
	}

	// Verify capsule belongs to user and get file path
	var filePath string
	err = h.db.QueryRow(
		"SELECT file_path FROM capsules WHERE id = ? AND user_id = ?",
		capsuleID,
		userID,
	).Scan(&filePath)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Capsule not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to retrieve capsule", http.StatusInternalServerError)
		return
	}

	// Read encrypted file from disk
	encryptedData, err := h.fileStorage.ReadEncryptedFile(filePath)
	if err != nil {
		http.Error(w, "Failed to read encrypted file", http.StatusInternalServerError)
		return
	}

	// Return encrypted data
	// The client will decrypt this using their private key
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=capsule.enc")
	w.Write(encryptedData)
}
