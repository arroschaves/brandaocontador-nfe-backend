#!/bin/bash

# Deploy script for DigitalOcean
# Usage: ./deploy-digitalocean.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="nfe-system"
APP_DIR="/opt/${APP_NAME}"
BACKUP_DIR="/opt/backups/${APP_NAME}"
LOG_FILE="/var/log/${APP_NAME}-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root for security reasons"
fi

# Check required commands
command -v docker >/dev/null 2>&1 || error "Docker is required but not installed"
command -v docker-compose >/dev/null 2>&1 || error "Docker Compose is required but not installed"
command -v git >/dev/null 2>&1 || error "Git is required but not installed"

log "Starting deployment for environment: $ENVIRONMENT"

# Create backup
log "Creating backup..."
mkdir -p "$BACKUP_DIR"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"

if [ -d "$APP_DIR" ]; then
    sudo cp -r "$APP_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    success "Backup created: $BACKUP_DIR/$BACKUP_NAME"
else
    warning "Application directory not found, skipping backup"
fi

# Create application directory
sudo mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone or update repository
if [ -d ".git" ]; then
    log "Updating repository..."
    git fetch origin
    git reset --hard origin/main
else
    log "Cloning repository..."
    git clone https://github.com/YOUR_USERNAME/nfe-system.git .
fi

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    log "Loading environment variables for $ENVIRONMENT"
    cp ".env.${ENVIRONMENT}" .env
elif [ -f ".env" ]; then
    warning "Using default .env file"
else
    error "No environment file found. Please create .env or .env.${ENVIRONMENT}"
fi

# Validate required environment variables
log "Validating environment variables..."
required_vars=("DATABASE_URL" "JWT_SECRET" "POSTGRES_PASSWORD" "REDIS_PASSWORD")
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        error "Required environment variable $var is not set"
    fi
done
success "Environment variables validated"

# Stop existing containers
log "Stopping existing containers..."
docker-compose down --remove-orphans || warning "No containers to stop"

# Pull latest images
log "Pulling latest Docker images..."
docker-compose pull

# Build and start containers
log "Building and starting containers..."
docker-compose up -d --build

# Wait for services to be ready
log "Waiting for services to start..."
sleep 30

# Health checks
log "Performing health checks..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost/health >/dev/null 2>&1; then
        success "Application is healthy"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        error "Health check failed after $max_attempts attempts"
    fi
    
    log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
    sleep 10
    ((attempt++))
done

# Run database migrations if needed
if [ -f "backend/migrations" ]; then
    log "Running database migrations..."
    docker-compose exec -T nfe-backend npm run migrate || warning "Migration failed or not needed"
fi

# Clean up old Docker images and containers
log "Cleaning up Docker resources..."
docker system prune -f
docker image prune -f

# Clean up old backups (keep last 5)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

# Display running containers
log "Deployment completed successfully!"
echo ""
echo "Running containers:"
docker-compose ps

echo ""
echo "Application URLs:"
echo "- Frontend: https://$(hostname)"
echo "- Backend API: https://$(hostname)/api"
echo "- Health Check: https://$(hostname)/health"

echo ""
echo "Useful commands:"
echo "- View logs: docker-compose logs -f"
echo "- Restart services: docker-compose restart"
echo "- Stop services: docker-compose down"
echo "- Update application: $0 $ENVIRONMENT"

success "Deployment completed successfully!"