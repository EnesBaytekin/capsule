package config

import (
	"os"
)

type Config struct {
	Port         string
	DatabasePath string
	StoragePath  string
	JWTSecret    string
}

// Load reads configuration from environment variables with sensible defaults
func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabasePath: getEnv("DATABASE_PATH", "./data/capsule.db"),
		StoragePath:  getEnv("STORAGE_PATH", "./data/users"),
		JWTSecret:    getEnv("JWT_SECRET", "change-this-secret-in-production"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
