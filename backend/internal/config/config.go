package config

import (
	"os"
)

type Config struct {
	Port          string
	DatabasePath  string
	StoragePath   string
	JWTSecret     string
	TLSCertFile   string
	TLSKeyFile    string
	UseWhitelist  bool
	WhitelistFile string
}

// Load reads configuration from environment variables with sensible defaults
func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "8080"),
		DatabasePath:  getEnv("DATABASE_PATH", "./data/capsule.db"),
		StoragePath:   getEnv("STORAGE_PATH", "./data/users"),
		JWTSecret:     getEnv("JWT_SECRET", "change-this-secret-in-production"),
		TLSCertFile:   getEnv("TLS_CERT", ""),
		TLSKeyFile:    getEnv("TLS_KEY", ""),
		UseWhitelist:  getBoolEnv("USE_WHITELIST", false),
		WhitelistFile: getEnv("WHITELIST_FILE", "./config/whitelist.txt"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}
