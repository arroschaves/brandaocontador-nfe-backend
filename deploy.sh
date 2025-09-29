#!/bin/bash

# One-Click Deploy Script for NFe System
# This script automates the complete deployment process

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="nfe-system"
GITHUB_REPO="YOUR_USERNAME/nfe-system"
VERCEL_PROJECT="nfe-frontend"
DO_APP_NAME="nfe-backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

step() {
    echo -e "\n${PURPLE}[STEP]${NC} $1"
    echo "----------------------------------------"
}

# Check prerequisites
check_prerequisites() {
    step "Checking prerequisites"
    
    # Check required commands
    local required_commands=("git" "node" "npm" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "$cmd is required but not installed"
        fi
    done
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "This script must be run from within a git repository"
    fi
    
    success "All prerequisites met"
}

# Setup environment files
setup_environment() {
    step "Setting up environment files"
    
    # Create .env.example if it doesn't exist
    if [ ! -f ".env.example" ]; then
        log "Creating .env.example"
        cat > .env.example << EOF
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/nfe_system
POSTGRES_DB=nfe_system
POSTGRES_USER=nfe_user
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration
REDIS_PASSWORD=your_redis_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# SEFAZ Configuration
SEFAZ_AMBIENTE=homologacao
SEFAZ_UF=SP
CERT_PATH=./certs
CERT_PASSWORD=your_cert_password

# Application Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.vercel.app
BACKEND_URL=https://your-backend-domain.com

# Monitoring
GRAFANA_PASSWORD=admin

# Deployment
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
DO_HOST=your_digitalocean_ip
DO_USERNAME=your_do_username
DO_SSH_KEY=your_ssh_private_key
SLACK_WEBHOOK=your_slack_webhook_url
EOF
    fi
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        warning ".env file not found. Please copy .env.example to .env and configure it"
        cp .env.example .env
        echo "Please edit .env file with your actual configuration before continuing."
        read -p "Press Enter when you've configured .env file..."
    fi
    
    success "Environment files ready"
}

# Initialize Git repository and push to GitHub
setup_github() {
    step "Setting up GitHub repository"
    
    # Check if remote origin exists
    if ! git remote get-url origin &> /dev/null; then
        echo "Please enter your GitHub repository URL (e.g., https://github.com/username/nfe-system.git):"
        read -r github_url
        git remote add origin "$github_url"
    fi
    
    # Add all files and commit
    log "Adding files to git"
    git add .
    
    if git diff --staged --quiet; then
        log "No changes to commit"
    else
        git commit -m "feat: initial deployment setup with automated CI/CD"
    fi
    
    # Push to GitHub
    log "Pushing to GitHub"
    git push -u origin main || git push -u origin master
    
    success "Code pushed to GitHub"
}

# Deploy frontend to Vercel
deploy_frontend() {
    step "Deploying frontend to Vercel"
    
    cd frontend
    
    # Install Vercel CLI if not present
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI"
        npm install -g vercel
    fi
    
    # Login to Vercel (if not already logged in)
    if ! vercel whoami &> /dev/null; then
        log "Please login to Vercel"
        vercel login
    fi
    
    # Deploy to Vercel
    log "Deploying to Vercel"
    vercel --prod
    
    cd ..
    success "Frontend deployed to Vercel"
}

# Setup DigitalOcean deployment
setup_digitalocean() {
    step "Setting up DigitalOcean deployment"
    
    echo "Please ensure you have:"
    echo "1. A DigitalOcean droplet running Ubuntu 20.04+"
    echo "2. Docker and Docker Compose installed on the droplet"
    echo "3. SSH access configured"
    echo "4. Domain name pointed to your droplet (optional)"
    echo ""
    
    read -p "Have you completed the above setup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        warning "Please complete DigitalOcean setup first"
        echo "You can run this script again after setup is complete"
        return
    fi
    
    # Make deploy script executable
    chmod +x scripts/deploy-digitalocean.sh
    
    echo "To deploy to DigitalOcean, run:"
    echo "scp -r . user@your-server:/opt/nfe-system/"
    echo "ssh user@your-server 'cd /opt/nfe-system && ./scripts/deploy-digitalocean.sh'"
    
    success "DigitalOcean deployment configured"
}

# Setup SSL certificates
setup_ssl() {
    step "Setting up SSL certificates"
    
    mkdir -p nginx/ssl
    
    if [ ! -f "nginx/ssl/cert.pem" ]; then
        log "Creating self-signed SSL certificate for development"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=BR/ST=SP/L=SaoPaulo/O=NFe System/CN=localhost"
        
        warning "Self-signed certificate created. For production, use Let's Encrypt or a proper CA"
    fi
    
    success "SSL certificates ready"
}

# Setup monitoring
setup_monitoring() {
    step "Setting up monitoring"
    
    mkdir -p monitoring
    
    # Create Prometheus configuration
    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'nfe-backend'
    static_configs:
      - targets: ['nfe-backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
EOF
    
    success "Monitoring configuration created"
}

# Run tests
run_tests() {
    step "Running tests"
    
    # Backend tests
    if [ -d "backend" ]; then
        log "Running backend tests"
        cd backend
        npm test || warning "Backend tests failed"
        cd ..
    fi
    
    # Frontend tests
    if [ -d "frontend" ]; then
        log "Running frontend tests"
        cd frontend
        npm test -- --run || warning "Frontend tests failed"
        cd ..
    fi
    
    success "Tests completed"
}

# Main deployment function
main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    NFe System Deployment                    ║"
    echo "║                     One-Click Deploy                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "Starting automated deployment process"
    
    check_prerequisites
    setup_environment
    setup_ssl
    setup_monitoring
    run_tests
    setup_github
    deploy_frontend
    setup_digitalocean
    
    echo -e "\n${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                   Deployment Complete!                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo "Next steps:"
    echo "1. Configure your domain DNS to point to your DigitalOcean droplet"
    echo "2. Update environment variables in GitHub Secrets"
    echo "3. Update Vercel environment variables"
    echo "4. Deploy backend to DigitalOcean using the provided commands"
    echo "5. Test the complete system"
    
    echo "\nUseful links:"
    echo "- GitHub Actions: https://github.com/$GITHUB_REPO/actions"
    echo "- Vercel Dashboard: https://vercel.com/dashboard"
    echo "- DigitalOcean Dashboard: https://cloud.digitalocean.com/"
}

# Run main function
main "$@"