package handlers

import (
	"capsule/internal/auth"
	"capsule/internal/config"
	"capsule/internal/models"
	"database/sql"
	"encoding/json"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db  *sql.DB
	cfg *config.Config
}

func NewAuthHandler(db *sql.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		db:  db,
		cfg: cfg,
	}
}

// Register handles user registration
// Users must provide their public key during registration
// The private key is generated on the client and never sent to the server
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Username == "" || req.Password == "" || req.PublicKey == "" {
		http.Error(w, "Username, password, and public key are required", http.StatusBadRequest)
		return
	}

	// Hash password with bcrypt (cost factor 12)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Insert user into database
	var userID int64
	err = h.db.QueryRow(
		"INSERT INTO users (username, password_hash, public_key) VALUES (?, ?, ?) RETURNING id",
		req.Username,
		string(hashedPassword),
		req.PublicKey,
	).Scan(&userID)

	if err != nil {
		if err.Error() == "UNIQUE constraint failed: users.username" {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(userID, req.Username, h.cfg.JWTSecret)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return token
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(models.AuthResponse{Token: token})
}

// CheckUsername checks if a username is available
// Public endpoint that returns 404 if username is available, 200 if taken
func (h *AuthHandler) CheckUsername(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		http.Error(w, "Username parameter is required", http.StatusBadRequest)
		return
	}

	// Check if username exists in database
	var exists bool
	err := h.db.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)",
		username,
	).Scan(&exists)

	if err != nil {
		http.Error(w, "Failed to check username", http.StatusInternalServerError)
		return
	}

	if exists {
		// Username is taken
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"available": false})
	} else {
		// Username is available
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]bool{"available": true})
	}
}

// Login handles user authentication
// Returns a JWT token on successful authentication
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Username == "" || req.Password == "" {
		http.Error(w, "Username and password are required", http.StatusBadRequest)
		return
	}

	// Retrieve user from database
	var user models.User
	err := h.db.QueryRow(
		"SELECT id, username, password_hash, public_key, created_at FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.PublicKey, &user.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid credentials"})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to query database"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid credentials"})
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(user.ID, user.Username, h.cfg.JWTSecret)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return token
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthResponse{Token: token})
}
