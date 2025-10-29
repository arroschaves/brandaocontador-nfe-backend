#!/bin/bash

# Automated Backup Script for NFe System
# This script creates backups of database, files, and configurations

set -e

# Configuration
BACKUP_DIR="/opt/backups/nfe-system"
APP_DIR="/opt/nfe-system"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="nfe-backup-${DATE}"
RETENTION_DAYS=30
S3_BUCKET="${BACKUP_S3_BUCKET:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root or with sudo
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        error "This script requires root privileges or passwordless sudo"
    fi
    
    # Check if Docker is running
    if ! docker ps >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
    fi
    
    # Check if application is running
    if ! docker-compose -f "$APP_DIR/docker-compose.yml" ps | grep -q "Up"; then
        warning "Some services may not be running"
    fi
    
    success "Prerequisites check completed"
}

# Create backup directory
setup_backup_dir() {
    log "Setting up backup directory..."
    
    sudo mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    sudo chown $(whoami):$(whoami) "$BACKUP_DIR/$BACKUP_NAME"
    
    success "Backup directory created: $BACKUP_DIR/$BACKUP_NAME"
}

# Backup PostgreSQL database
backup_database() {
    log "Backing up PostgreSQL database..."
    
    local db_backup_file="$BACKUP_DIR/$BACKUP_NAME/database.sql"
    
    # Get database credentials from environment
    local db_user=$(grep POSTGRES_USER "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"')
    local db_name=$(grep POSTGRES_DB "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"')
    
    if [ -z "$db_user" ] || [ -z "$db_name" ]; then
        error "Database credentials not found in .env file"
    fi
    
    # Create database backup
    docker-compose -f "$APP_DIR/docker-compose.yml" exec -T postgres pg_dump \
        -U "$db_user" \
        -d "$db_name" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create > "$db_backup_file"
    
    if [ $? -eq 0 ]; then
        success "Database backup completed: $(du -h "$db_backup_file" | cut -f1)"
    else
        error "Database backup failed"
    fi
}

# Backup Redis data
backup_redis() {
    log "Backing up Redis data..."
    
    local redis_backup_dir="$BACKUP_DIR/$BACKUP_NAME/redis"
    mkdir -p "$redis_backup_dir"
    
    # Save Redis data
    docker-compose -f "$APP_DIR/docker-compose.yml" exec -T redis redis-cli BGSAVE
    
    # Wait for background save to complete
    sleep 5
    
    # Copy Redis dump file
    docker cp $(docker-compose -f "$APP_DIR/docker-compose.yml" ps -q redis):/data/dump.rdb "$redis_backup_dir/"
    
    if [ -f "$redis_backup_dir/dump.rdb" ]; then
        success "Redis backup completed: $(du -h "$redis_backup_dir/dump.rdb" | cut -f1)"
    else
        warning "Redis backup may have failed"
    fi
}

# Backup application files
backup_application_files() {
    log "Backing up application files..."
    
    local files_backup_dir="$BACKUP_DIR/$BACKUP_NAME/files"
    mkdir -p "$files_backup_dir"
    
    # Backup important directories
    local dirs_to_backup=(
        "certs"
        "uploads"
        "logs"
        "nginx/ssl"
    )
    
    for dir in "${dirs_to_backup[@]}"; do
        if [ -d "$APP_DIR/$dir" ]; then
            log "Backing up $dir..."
            cp -r "$APP_DIR/$dir" "$files_backup_dir/"
        fi
    done
    
    success "Application files backup completed"
}

# Backup configuration files
backup_configurations() {
    log "Backing up configuration files..."
    
    local config_backup_dir="$BACKUP_DIR/$BACKUP_NAME/config"
    mkdir -p "$config_backup_dir"
    
    # Backup configuration files
    local configs_to_backup=(
        ".env"
        "docker-compose.yml"
        "nginx/nginx.conf"
        "nginx/conf.d"
        "monitoring/prometheus.yml"
    )
    
    for config in "${configs_to_backup[@]}"; do
        if [ -e "$APP_DIR/$config" ]; then
            log "Backing up $config..."
            cp -r "$APP_DIR/$config" "$config_backup_dir/"
        fi
    done
    
    success "Configuration files backup completed"
}

# Create backup metadata
create_backup_metadata() {
    log "Creating backup metadata..."
    
    local metadata_file="$BACKUP_DIR/$BACKUP_NAME/metadata.json"
    
    cat > "$metadata_file" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "app_version": "$(git -C "$APP_DIR" describe --tags --always 2>/dev/null || echo 'unknown')",
  "docker_images": [
EOF
    
    # Add Docker images info
    docker-compose -f "$APP_DIR/docker-compose.yml" images --format json >> "$metadata_file"
    
    cat >> "$metadata_file" << EOF
  ],
  "services_status": [
EOF
    
    # Add services status
    docker-compose -f "$APP_DIR/docker-compose.yml" ps --format json >> "$metadata_file"
    
    cat >> "$metadata_file" << EOF
  ]
}
EOF
    
    success "Backup metadata created"
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    if [ $? -eq 0 ]; then
        local compressed_size=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
        success "Backup compressed: ${BACKUP_NAME}.tar.gz ($compressed_size)"
        
        # Remove uncompressed directory
        rm -rf "$BACKUP_NAME"
    else
        error "Backup compression failed"
    fi
}

# Upload to S3 (if configured)
upload_to_s3() {
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backup to S3..."
        
        if command -v aws >/dev/null 2>&1; then
            aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "s3://$S3_BUCKET/nfe-system/"
            
            if [ $? -eq 0 ]; then
                success "Backup uploaded to S3: s3://$S3_BUCKET/nfe-system/${BACKUP_NAME}.tar.gz"
            else
                warning "S3 upload failed"
            fi
        else
            warning "AWS CLI not installed, skipping S3 upload"
        fi
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Remove local backups older than retention period
    find "$BACKUP_DIR" -name "nfe-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    # Clean S3 backups if configured
    if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
        aws s3 ls "s3://$S3_BUCKET/nfe-system/" | \
        awk '{print $4}' | \
        grep "nfe-backup-" | \
        head -n -$RETENTION_DAYS | \
        xargs -I {} aws s3 rm "s3://$S3_BUCKET/nfe-system/{}"
    fi
    
    success "Old backups cleaned up (retention: $RETENTION_DAYS days)"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        local color="good"
        if [ "$status" != "success" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"NFe System Backup\",
                    \"text\": \"$message\",
                    \"fields\": [{
                        \"title\": \"Hostname\",
                        \"value\": \"$(hostname)\",
                        \"short\": true
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date)\",
                        \"short\": true
                    }]
                }]
            }" \
            "$SLACK_WEBHOOK"
    fi
}

# Main backup function
main() {
    echo "Starting NFe System Backup - $DATE"
    echo "========================================"
    
    local start_time=$(date +%s)
    
    trap 'send_notification "error" "Backup failed with error on line $LINENO"' ERR
    
    check_prerequisites
    setup_backup_dir
    backup_database
    backup_redis
    backup_application_files
    backup_configurations
    create_backup_metadata
    compress_backup
    upload_to_s3
    cleanup_old_backups
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "========================================"
    success "Backup completed successfully!"
    log "Duration: ${duration} seconds"
    log "Backup location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    send_notification "success" "Backup completed successfully in ${duration} seconds"
}

# Run main function
main "$@"