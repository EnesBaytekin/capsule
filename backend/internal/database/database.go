package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

// Initialize creates a connection to the SQLite database
func Initialize(dbPath string) (*sql.DB, error) {
	// Ensure the directory exists
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(1) // SQLite doesn't support multiple writers
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// Migrate creates the necessary tables if they don't exist
// This follows the zero-knowledge principle: we only store metadata,
// never plaintext content or private keys
func Migrate(db *sql.DB) error {
	queries := []string{
		// Users table - stores authentication and public keys only
		// Private keys are NEVER stored here
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			public_key TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		// Capsules table - stores metadata only
		// The actual encrypted content is stored on disk
		`CREATE TABLE IF NOT EXISTS capsules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			type TEXT NOT NULL CHECK(type IN ('text', 'image', 'mixed')),
			file_path TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		// Index for faster user lookups
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
		// Index for faster capsule lookups by user
		`CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules(user_id)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute migration: %w", err)
		}
	}

	// Migration: Update capsules table to support 'mixed' type
	// Check if the table already has the old constraint
	var oldConstraintExists bool
	row := db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('capsules') WHERE name = 'type'")
	if err := row.Scan(&oldConstraintExists); err == nil && oldConstraintExists {
		// Try to add 'mixed' type support by recreating the table
		migration := `
			-- Create new table with updated constraint
			CREATE TABLE IF NOT EXISTS capsules_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				type TEXT NOT NULL CHECK(type IN ('text', 'image', 'mixed')),
				file_path TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);

			-- Copy existing data
			INSERT INTO capsules_new SELECT * FROM capsules;

			-- Drop old table and rename new one
			DROP TABLE capsules;
			ALTER TABLE capsules_new RENAME TO capsules;

			-- Recreate indexes
			CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules(user_id);
		`
		// Execute migration (will fail if already migrated, which is fine)
		db.Exec(migration)
	}

	return nil
}
