# Time Capsule - Release Scripts

This directory contains helper scripts for managing Time Capsule in production.

## Scripts

### setup.sh
Initial setup script for production deployment.

```bash
./.release/setup.sh
```

This script will:
- Check Docker and Docker Compose installation
- Create required directories (`certs/`, `config/`)
- Generate a secure JWT secret
- Create `.env` file
- Guide you through SSL certificate setup
- Optionally configure username whitelist
- Pull Docker images
- Start containers

### backup.sh
Backup script for database and user data.

```bash
./.release/backup.sh
```

This script will:
- Create timestamped backups of SQLite database
- Create timestamped backups of user data
- Store backups in `./backups/` directory
- Automatically clean up backups older than 7 days

**Recommended:** Set up a cron job for automatic backups:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/capsule && ./.release/backup.sh >> logs/backup.log 2>&1
```

### restore.sh
Restore script for database and user data.

```bash
./.release/restore.sh
```

This script will:
- List available backups
- Prompt you to select a backup
- Stop containers
- Restore database from backup
- Restart containers

### update.sh
Update script to upgrade to the latest version.

```bash
./.release/update.sh
```

This script will:
- Create a backup before updating
- Pull latest Docker images
- Restart containers
- Verify container status

## Usage Examples

### Initial Deployment

```bash
# Clone repository
git clone https://github.com/enesbaytekin/capsule.git
cd capsule

# Run setup
./.release/setup.sh
```

### Daily Backups

```bash
# Manual backup
./.release/backup.sh

# Or automate with cron
crontab -e
# Add: 0 2 * * * cd /path/to/capsule && ./.release/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls -lh backups/

# Run restore script
./.release/restore.sh
# Select the backup file when prompted
```

### Update to Latest Version

```bash
# Update (includes automatic backup)
./.release/update.sh
```

## Backup Structure

Backups are stored in `./backups/`:

```
backups/
├── capsule-db-20250110-120000.db      # Database backup
├── users-data-20250110-120000.tar.gz  # User data backup
└── ...
```

## Security Notes

1. **Protect your backups:** Backup files contain sensitive encrypted data. Set proper permissions:
   ```bash
   chmod 700 backups/
   chmod 600 backups/*
   ```

2. **Store backups securely:** Consider encrypting backups and storing them off-site:
   ```bash
   # Encrypt backup
   gpg --symmetric --cipher-algo AES256 backups/capsule-db-20250110-120000.db

   # Decrypt backup
   gpg --decrypt backups/capsule-db-20250110-120000.db.gpg > capsule.db
   ```

3. **Test restores:** Regularly test your backup and restore procedures to ensure they work when needed.

## Troubleshooting

### Permission Denied

If you get "permission denied" when running scripts:
```bash
chmod +x .release/*.sh
```

### Container Not Found

If restore script fails with "container not found":
```bash
# Start containers first
docker compose up -d

# Then run restore
./.release/restore.sh
```

### Out of Disk Space

If backup fails due to disk space:
```bash
# Check disk usage
df -h

# Clean old backups (older than 30 days)
find backups/ -name "*.db" -mtime +30 -delete
find backups/ -name "*.tar.gz" -mtime +30 -delete

# Clean Docker images
docker image prune -a
```
