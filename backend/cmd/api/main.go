package main

import (
	"fmt"
	"log"
	"net/http"

	"capsule/internal/config"
	"capsule/internal/database"
	"capsule/internal/handlers"
	"capsule/internal/middleware"
	"capsule/internal/storage"

	"github.com/gorilla/mux"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize storage
	fileStorage, err := storage.New(cfg.StoragePath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg)
	keyHandler := handlers.NewKeyHandler(db)
	capsuleHandler := handlers.NewCapsuleHandler(db, fileStorage)

	// Setup router
	r := mux.NewRouter()

	// Apply CORS middleware to all routes
	r.Use(middleware.CORSMiddleware)

	// Public routes
	r.HandleFunc("/auth/register", authHandler.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/auth/login", authHandler.Login).Methods("POST", "OPTIONS")

	// Protected routes
	protected := r.PathPrefix("").Subrouter()
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))

	protected.HandleFunc("/keys/upload", keyHandler.UploadPublicKey).Methods("POST", "OPTIONS")
	protected.HandleFunc("/keys/public", keyHandler.GetPublicKey).Methods("GET", "OPTIONS")
	protected.HandleFunc("/capsule/upload", capsuleHandler.UploadCapsule).Methods("POST", "OPTIONS")
	protected.HandleFunc("/capsule/list", capsuleHandler.ListCapsules).Methods("GET", "OPTIONS")
	protected.HandleFunc("/capsule/download/{id}", capsuleHandler.DownloadCapsule).Methods("GET", "OPTIONS")

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Starting Time Capsule API on %s", addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
