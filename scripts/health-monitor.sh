#!/bin/bash

# Health Monitoring Script for NFe System
# This script monitors system health and sends alerts when issues are detected

set -e

# Configuration
APP_DIR="/opt/nfe-system"
LOG_FILE="/var/log/nfe-health-monitor.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
CHECK_INTERVAL=60
MAX_RESPONSE_TIME=5000  # milliseconds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}$message${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local message="[ERROR] $1"
    echo -e "${RED}$message${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
}

success() {
    local message="[SUCCESS] $1"
    echo -e "${GREEN}$message${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
}

warning() {
    local message="[WARNING] $1"
    echo -e "${YELLOW}$message${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
}

# Send alert notification
send_alert() {
    local severity=$1
    local title=$2
    local message=$3
    
    log "Sending $severity alert: $title"
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK" ]; then
        local color="warning"
        case $severity in
            "critical") color="danger" ;;
            "warning") color="warning" ;;
            "info") color="good" ;;
        esac
        
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"🚨 NFe System Alert - $title\",
                    \"text\": \"$message\",
                    \"fields\": [{
                        \"title\": \"Severity\",
                        \"value\": \"$severity\",
                        \"short\": true
                    }, {
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
            "$SLACK_WEBHOOK" > /dev/null
    fi
    
    # Email notification (if configured)
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "NFe System Alert: $title" "$ALERT_EMAIL"
    fi
}

# Check Docker services
check_docker_services() {
    log "Checking Docker services..."
    
    if ! docker ps >/dev/null 2>&1; then
        error "Docker is not running"
        send_alert "critical" "Docker Down" "Docker daemon is not running or not accessible"
        return 1
    fi
    
    # Check if docker-compose file exists
    if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
        error "Docker Compose file not found"
        send_alert "critical" "Configuration Missing" "docker-compose.yml file not found at $APP_DIR"
        return 1
    fi
    
    # Check service status
    local services=("nfe-backend" "postgres" "redis" "nginx")
    local failed_services=()
    
    for service in "${services[@]}"; do
        if ! docker-compose -f "$APP_DIR/docker-compose.yml" ps "$service" | grep -q "Up"; then
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        local failed_list=$(IFS=', '; echo "${failed_services[*]}")
        error "Services down: $failed_list"
        send_alert "critical" "Services Down" "The following services are not running: $failed_list"
        return 1
    fi
    
    success "All Docker services are running"
    return 0
}

# Check application health endpoints
check_health_endpoints() {
    log "Checking application health endpoints..."
    
    local endpoints=(
        "http://localhost:3001/health:Backend"
        "http://localhost:80/health:Nginx"
    )
    
    local failed_endpoints=()
    
    for endpoint_info in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_info" | cut -d':' -f1)
        local name=$(echo "$endpoint_info" | cut -d':' -f2)
        
        local response_time=$(curl -o /dev/null -s -w "%{time_total}" -m 10 "$endpoint" 2>/dev/null || echo "timeout")
        
        if [ "$response_time" = "timeout" ]; then
            failed_endpoints+=("$name (timeout)")
        else
            local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d'.' -f1)
            if [ "$response_time_ms" -gt "$MAX_RESPONSE_TIME" ]; then
                warning "$name endpoint slow: ${response_time_ms}ms"
                send_alert "warning" "Slow Response" "$name endpoint responding slowly: ${response_time_ms}ms"
            else
                log "$name endpoint OK: ${response_time_ms}ms"
            fi
        fi
    done
    
    if [ ${#failed_endpoints[@]} -gt 0 ]; then
        local failed_list=$(IFS=', '; echo "${failed_endpoints[*]}")
        error "Health check failed: $failed_list"
        send_alert "critical" "Health Check Failed" "The following endpoints are not responding: $failed_list"
        return 1
    fi
    
    success "All health endpoints are responding"
    return 0
}

# Check system resources
check_system_resources() {
    log "Checking system resources..."
    
    # Check CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*}  # Remove decimal part
    
    if [ "$cpu_usage" -gt "$ALERT_THRESHOLD_CPU" ]; then
        warning "High CPU usage: ${cpu_usage}%"
        send_alert "warning" "High CPU Usage" "CPU usage is at ${cpu_usage}%, threshold is ${ALERT_THRESHOLD_CPU}%"
    else
        log "CPU usage OK: ${cpu_usage}%"
    fi
    
    # Check memory usage
    local memory_info=$(free | grep Mem)
    local total_memory=$(echo "$memory_info" | awk '{print $2}')
    local used_memory=$(echo "$memory_info" | awk '{print $3}')
    local memory_usage=$((used_memory * 100 / total_memory))
    
    if [ "$memory_usage" -gt "$ALERT_THRESHOLD_MEMORY" ]; then
        warning "High memory usage: ${memory_usage}%"
        send_alert "warning" "High Memory Usage" "Memory usage is at ${memory_usage}%, threshold is ${ALERT_THRESHOLD_MEMORY}%"
    else
        log "Memory usage OK: ${memory_usage}%"
    fi
    
    # Check disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
    
    if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
        warning "High disk usage: ${disk_usage}%"
        send_alert "warning" "High Disk Usage" "Disk usage is at ${disk_usage}%, threshold is ${ALERT_THRESHOLD_DISK}%"
    else
        log "Disk usage OK: ${disk_usage}%"
    fi
    
    success "System resources check completed"
}

# Check database connectivity
check_database() {
    log "Checking database connectivity..."
    
    # Get database credentials
    local db_user=$(grep POSTGRES_USER "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' 2>/dev/null || echo "")
    local db_name=$(grep POSTGRES_DB "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' 2>/dev/null || echo "")
    
    if [ -z "$db_user" ] || [ -z "$db_name" ]; then
        warning "Database credentials not found in .env file"
        return 1
    fi
    
    # Test database connection
    if docker-compose -f "$APP_DIR/docker-compose.yml" exec -T postgres pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
        success "Database connectivity OK"
        
        # Check database size
        local db_size=$(docker-compose -f "$APP_DIR/docker-compose.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT pg_size_pretty(pg_database_size('$db_name'));" 2>/dev/null | xargs)
        log "Database size: $db_size"
        
        return 0
    else
        error "Database connectivity failed"
        send_alert "critical" "Database Down" "Cannot connect to PostgreSQL database"
        return 1
    fi
}

# Check Redis connectivity
check_redis() {
    log "Checking Redis connectivity..."
    
    if docker-compose -f "$APP_DIR/docker-compose.yml" exec -T redis redis-cli ping | grep -q "PONG"; then
        success "Redis connectivity OK"
        
        # Check Redis memory usage
        local redis_memory=$(docker-compose -f "$APP_DIR/docker-compose.yml" exec -T redis redis-cli info memory | grep "used_memory_human" | cut -d':' -f2 | tr -d '\r')
        log "Redis memory usage: $redis_memory"
        
        return 0
    else
        error "Redis connectivity failed"
        send_alert "critical" "Redis Down