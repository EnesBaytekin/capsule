package whitelist

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

type Manager struct {
	mu         sync.RWMutex
	whitelist  map[string]bool
	enabled    bool
	filePath   string
	watcher    *fsnotify.Watcher
	stopChan   chan struct{}
}

// New creates a new whitelist manager
func New(enabled bool, filePath string) (*Manager, error) {
	m := &Manager{
		whitelist: make(map[string]bool),
		enabled:   enabled,
		filePath:  filePath,
		stopChan:  make(chan struct{}),
	}

	// Load initial whitelist
	if err := m.load(); err != nil {
		return nil, err
	}

	// Start watching for file changes if enabled
	if enabled {
		if err := m.startWatcher(); err != nil {
			// Log warning but don't fail - the whitelist will still work, just won't auto-reload
			// You can add proper logging here if needed
		}
	}

	return m, nil
}

// load reads the whitelist file and populates the whitelist map
func (m *Manager) load() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Clear existing whitelist
	m.whitelist = make(map[string]bool)

	// If whitelist is not enabled, return success
	if !m.enabled {
		return nil
	}

	// Open the whitelist file
	file, err := os.Open(m.filePath)
	if err != nil {
		// If file doesn't exist, create an empty one
		if os.IsNotExist(err) {
			// Create directory if it doesn't exist
			dir := filepath.Dir(m.filePath)
			if dir != "." && dir != "" {
				if err := os.MkdirAll(dir, 0755); err != nil {
					return err
				}
			}
			// Create empty file
			file, err = os.Create(m.filePath)
			if err != nil {
				return err
			}
			file.Close()
			return nil
		}
		return err
	}
	defer file.Close()

	// Read file line by line
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Add username to whitelist (case-sensitive)
		m.whitelist[line] = true
	}

	return scanner.Err()
}

// startWatcher sets up a file watcher to automatically reload the whitelist when the file changes
func (m *Manager) startWatcher() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	m.watcher = watcher

	// Watch the directory containing the whitelist file
	dir := filepath.Dir(m.filePath)
	if dir == "." {
		dir = "./"
	}

	if err := watcher.Add(dir); err != nil {
		watcher.Close()
		return err
	}

	// Start watching in a goroutine
	go m.watch()

	return nil
}

// watch monitors the whitelist file for changes
func (m *Manager) watch() {
	// Debounce timer to avoid multiple reloads
	var debounceTimer *time.Timer

	for {
		select {
		case event, ok := <-m.watcher.Events:
			if !ok {
				return
			}

			// Only reload if the whitelist file was modified
			if event.Name == m.filePath && (event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create) {
				// Debounce: wait 100ms after last write event before reloading
				if debounceTimer != nil {
					debounceTimer.Stop()
				}
				debounceTimer = time.AfterFunc(100*time.Millisecond, func() {
					m.load()
				})
			}

		case _, ok := <-m.watcher.Errors:
			if !ok {
				return
			}
			// Log error if needed

		case <-m.stopChan:
			if debounceTimer != nil {
				debounceTimer.Stop()
			}
			return
		}
	}
}

// IsAllowed checks if a username is allowed to register
func (m *Manager) IsAllowed(username string) bool {
	// If whitelist is disabled, allow all usernames
	if !m.enabled {
		return true
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Check if username is in whitelist (case-sensitive)
	return m.whitelist[username]
}

// Stop stops the file watcher
func (m *Manager) Stop() {
	if m.watcher != nil {
		m.watcher.Close()
	}
	close(m.stopChan)
}

// Reload manually reloads the whitelist file
func (m *Manager) Reload() error {
	return m.load()
}
