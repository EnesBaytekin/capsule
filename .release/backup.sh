#!/bin/bash
# Time Capsule - Backup Script
# This script creates backups of the database and user data

set -e

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)
CONTAINER_NAME="capsule-backend"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Time Capsule - Backup"
echo "=========================================="
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup directory ready${NC}"
echo ""

# Backup database
echo "Backing up SQLite database..."
docker compose exec -T $CONTAINER_NAME \
    cp /app/data/capsule.db /app/data/capsule.db.backup
docker cp $CONTAINER_NAME:/app/data/capsule.db.backup \
    "$BACKUP_DIR/capsule-db-$DATE.db"
echo -e "${GREEN}✓ Database backed up${NC}"
echo ""

# Backup user data
echo "Backing up user data..."
docker run --rm \
    -v capsule_backend-data:/data:ro \
    -v "$(pwd)/$BACKUP_DIR:/backup" \
    alpine tar czf "/backup/users-data-$DATE.tar.gz" -C /data .
echo -e "${GREEN}✓ User data backed up${NC}"
echo ""

# Cleanup old backups (keep last 7 days)
echo "Cleaning up old backups (older than 7 days)..."
find "$BACKUP_DIR" -name "capsule-db-*.db" -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "users-data-*.tar.gz" -mtime +7 -delete 2>/dev/null || true
echo -e "${GREEN}✓ Old backups cleaned${NC}"
echo ""

echo -e "${GREEN}=========================================="
echo "  Backup Complete!"
echo "==========================================${NC}"
echo ""
echo "Backup location: $BACKUP_DIR/"
echo "  - Database: capsule-db-$DATE.db"
echo "  - User data: users-data-$DATE.tar.gz"
echo ""
