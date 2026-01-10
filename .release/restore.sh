#!/bin/bash
# Time Capsule - Restore Script
# This script restores backups of the database and user data

set -e

# Configuration
BACKUP_DIR="./backups"
CONTAINER_NAME="capsule-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Time Capsule - Restore"
echo "=========================================="
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found ($BACKUP_DIR)${NC}"
    exit 1
fi

# List available backups
echo "Available backups:"
echo ""

echo "Database backups:"
ls -lh "$BACKUP_DIR"/capsule-db-*.db 2>/dev/null || echo "  No database backups found"
echo ""

echo "User data backups:"
ls -lh "$BACKUP_DIR"/users-data-*.tar.gz 2>/dev/null || echo "  No user data backups found"
echo ""

# Prompt user to select backup
read -p "Enter the database backup filename (e.g., capsule-db-20250110-120000.db): " db_backup

if [ ! -f "$BACKUP_DIR/$db_backup" ]; then
    echo -e "${RED}Error: Backup file not found${NC}"
    exit 1
fi

# Warning
echo ""
echo -e "${YELLOW}Warning: This will replace the current database${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Stop containers
echo ""
echo "Stopping containers..."
docker compose down
echo -e "${GREEN}✓ Containers stopped${NC}"

# Restore database
echo "Restoring database..."
docker cp "$BACKUP_DIR/$db_backup" $CONTAINER_NAME:/app/data/capsule.db
echo -e "${GREEN}✓ Database restored${NC}"

# Start containers
echo ""
echo "Starting containers..."
docker compose up -d
echo -e "${GREEN}✓ Containers started${NC}"

echo ""
echo -e "${GREEN}=========================================="
echo "  Restore Complete!"
echo "==========================================${NC}"
echo ""
echo "You can verify the restore with:"
echo "  docker compose logs -f"
echo ""
