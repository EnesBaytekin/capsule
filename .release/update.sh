#!/bin/bash
# Time Capsule - Update Script
# This script updates Time Capsule to the latest version

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Time Capsule - Update"
echo "=========================================="
echo ""

# Warning
echo -e "${YELLOW}Warning: This will update Time Capsule to the latest version${NC}"
read -p "Do you want to continue? (y/N): " -n 1 -r confirm
echo

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Update cancelled"
    exit 0
fi

# Create backup
echo ""
echo "Creating backup before update..."
./.release/backup.sh
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Pull new images
echo "Pulling latest images..."
docker compose pull
echo -e "${GREEN}✓ Images pulled${NC}"
echo ""

# Restart containers
echo "Restarting containers..."
docker compose up -d
echo -e "${GREEN}✓ Containers restarted${NC}"
echo ""

# Wait for containers to be healthy
echo "Waiting for containers to be healthy..."
sleep 5

# Check status
docker compose ps

echo ""
echo -e "${GREEN}=========================================="
echo "  Update Complete!"
echo "==========================================${NC}"
echo ""
echo "If you encounter any issues, you can restore from backup:"
echo "  ./.release/restore.sh"
echo ""
