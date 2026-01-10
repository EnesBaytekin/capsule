#!/bin/bash
# Time Capsule - Production Setup Script
# This script helps you set up Time Capsule for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  Time Capsule - Production Setup"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not available${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Check if required directories exist
echo "Creating required directories..."
mkdir -p certs config
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Generate JWT secret
echo "Generating secure JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ JWT secret generated${NC}"
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo -e "${YELLOW}Warning: .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm .env
    else
        echo "Skipping .env creation"
    fi
fi

# Create .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# JWT Secret - auto-generated on $(date)
JWT_SECRET=$JWT_SECRET

# Whitelist Settings
USE_WHITELIST=false
WHITELIST_FILE=/app/config/whitelist.txt
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
    echo ""
fi

# Check for certificates
echo "Checking SSL certificates..."
if [ ! -f certs/cert.pem ] || [ ! -f certs/key.pem ]; then
    echo -e "${YELLOW}Warning: SSL certificates not found in ./certs/${NC}"
    echo ""
    echo "Choose certificate option:"
    echo "  1) Generate self-signed certificates (for testing only)"
    echo "  2) Use Let's Encrypt (recommended for production)"
    echo "  3) I have my own certificates"
    echo ""
    read -p "Enter your choice (1/2/3): " -n 1 -r cert_choice
    echo

    case $cert_choice in
        1)
            echo ""
            echo "Generating self-signed certificates..."
            openssl req -x509 -newkey rsa:4096 \
                -keyout certs/key.pem \
                -out certs/cert.pem \
                -days 365 \
                -nodes \
                -subj "/C=US/ST=State/L=City/O=Capsule/CN=localhost"
            chmod 600 certs/key.pem
            chmod 644 certs/cert.pem
            echo -e "${GREEN}✓ Self-signed certificates generated${NC}"
            echo -e "${YELLOW}Note: Your browser will show security warnings${NC}"
            ;;
        2)
            echo ""
            echo "To use Let's Encrypt, follow these steps:"
            echo ""
            echo "1. Install certbot:"
            echo "   sudo apt-get install -y certbot"
            echo ""
            echo "2. Generate certificates:"
            echo "   sudo certbot certonly --standalone -d yourdomain.com"
            echo ""
            echo "3. Copy certificates:"
            echo "   sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/cert.pem"
            echo "   sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/key.pem"
            echo ""
            echo "4. Set permissions:"
            echo "   sudo chown \$USER:\$USER ./certs/*.pem"
            echo "   chmod 644 ./certs/cert.pem"
            echo "   chmod 600 ./certs/key.pem"
            echo ""
            read -p "Press enter after you've completed these steps..." dummy
            ;;
        3)
            echo ""
            echo "Please copy your certificates to:"
            echo "  Certificate: ./certs/cert.pem"
            echo "  Private Key:  ./certs/key.pem"
            echo ""
            echo "Then set permissions:"
            echo "  chmod 644 ./certs/cert.pem"
            echo "  chmod 600 ./certs/key.pem"
            echo ""
            read -p "Press enter after you've copied the certificates..." dummy
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${GREEN}✓ SSL certificates found${NC}"
fi
echo ""

# Configure whitelist (optional)
read -p "Do you want to enable the username whitelist? (y/N): " -n 1 -r whitelist_choice
echo
if [[ $whitelist_choice =~ ^[Yy]$ ]]; then
    sed -i 's/USE_WHITELIST=false/USE_WHITELIST=true/' .env
    echo ""
    echo "Creating whitelist.txt..."
    if [ ! -f config/whitelist.txt ]; then
        cat > config/whitelist.txt << EOF
# Time Capsule Username Whitelist
# Add one username per line (case-sensitive)
# Lines starting with # are comments

# Example users:
# alice
# bob
# charlie
EOF
        echo -e "${GREEN}✓ Whitelist created${NC}"
        echo "Edit config/whitelist.txt to add allowed usernames"
    else
        echo "Whitelist file already exists"
    fi
fi
echo ""

# Pull images
echo "Pulling Docker images..."
docker compose pull
echo -e "${GREEN}✓ Images pulled${NC}"
echo ""

# Start containers
read -p "Do you want to start the containers now? (Y/n): " -n 1 -r start_choice
echo
if [[ ! $start_choice =~ ^[Nn]$ ]]; then
    echo "Starting containers..."
    docker compose up -d
    echo -e "${GREEN}✓ Containers started${NC}"
    echo ""
    echo "Checking container status..."
    sleep 3
    docker compose ps
    echo ""
    echo -e "${GREEN}=========================================="
    echo "  Setup Complete!"
    echo "==========================================${NC}"
    echo ""
    echo "Access Time Capsule:"
    echo "  Frontend:  https://localhost:3443"
    echo "  Backend:   https://localhost:8443"
    echo ""
    echo "Useful commands:"
    echo "  View logs:   docker compose logs -f"
    echo "  Stop:        docker compose down"
    echo "  Restart:     docker compose restart"
    echo ""
else
    echo ""
    echo -e "${GREEN}=========================================="
    echo "  Setup Complete!"
    echo "==========================================${NC}"
    echo ""
    echo "To start the containers later, run:"
    echo "  docker compose up -d"
    echo ""
fi
