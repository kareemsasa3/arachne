#!/bin/bash

# Let's Encrypt Setup Script for Production
# This script sets up Let's Encrypt certificates with Docker Compose integration

set -euo pipefail

# Get the absolute path of the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Navigate to the parent directory (infrastructure)
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔐 Let's Encrypt SSL Certificate Setup for Production"
echo "====================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider running as a non-root user with docker permissions."
fi

# Check if required tools are installed
check_requirements() {
    print_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install it first."
        exit 1
    fi
    
    print_status "Requirements check passed"
}

# Get user input
get_user_input() {
    echo ""
    echo "Please provide the following information:"
    echo ""
    
    # Get domain name
    read -p "Enter your domain name (e.g., example.com): " domain
    if [ -z "$domain" ]; then
        print_error "Domain name cannot be empty"
        exit 1
    fi
    
    # Get email address
    read -p "Enter your email address for Let's Encrypt notifications: " email
    if [ -z "$email" ]; then
        print_error "Email address cannot be empty"
        exit 1
    fi
    
    # Validate email format
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        print_error "Invalid email format"
        exit 1
    fi
    
    DOMAIN="$domain"
    EMAIL="$email"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p "$INFRA_DIR/nginx/certbot/www"
    mkdir -p "$INFRA_DIR/logs/certbot"
    mkdir -p "$INFRA_DIR/nginx/ssl"
    
    print_status "Directories created"
}

# Update configuration files
update_configurations() {
    print_info "Updating configuration files..."
    
    # Update nginx configuration template (used in production)
    sed -i.bak "s/server_name _;/server_name $DOMAIN;/g" "$INFRA_DIR/nginx/conf.d/default.conf.template"
    
    # Update production docker compose
    sed -i.bak "s|https://your-domain.com|https://$DOMAIN|g" "$INFRA_DIR/prod/docker-compose.prod.yml"
    sed -i.bak "s/your-email@example.com/$EMAIL/g" "$INFRA_DIR/prod/docker-compose.prod.yml" || true
    sed -i.bak "s/your-domain.com/$DOMAIN/g" "$INFRA_DIR/prod/docker-compose.prod.yml"
    # Update web VITE url if present
    sed -i.bak "s|VITE_AI_URL=https://your-domain.com/api/ai|VITE_AI_URL=https://$DOMAIN/api/ai|g" "$INFRA_DIR/prod/docker-compose.prod.yml" || true
    
    print_status "Configuration files updated"
    print_info "Backup files created with .bak extension"
}

# Verify domain points to server
verify_domain() {
    print_info "Verifying domain configuration..."
    
    echo "Please ensure your domain '$DOMAIN' points to this server's IP address."
    echo "You can check this by running: nslookup $DOMAIN"
    echo ""
    
    read -p "Press Enter when you've confirmed the domain is pointing to this server..."
    
    # Test domain resolution
    if nslookup "$DOMAIN" &> /dev/null; then
        print_status "Domain resolution test passed"
    else
        print_warning "Domain resolution test failed. Please check your DNS configuration."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Initial certificate setup
setup_initial_certificate() {
    print_info "Setting up initial Let's Encrypt certificate..."
    
    # Start nginx with HTTP only for ACME challenge
    print_info "Starting nginx for ACME challenge..."
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d nginx)
    
    # Wait for nginx to be ready (ACME HTTP endpoint available)
    print_info "Waiting for nginx to be ready..."
    for i in $(seq 1 30); do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost/health | grep -q "200"; then
            break
        fi
        sleep 2
    done
    
    # Run certbot to obtain initial certificate
    print_info "Obtaining Let's Encrypt certificate..."
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml --profile ssl-setup run --rm certbot)
    
    # Copy certificates to nginx ssl directory
    print_info "Copying certificates..."
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/cert.pem)
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/key.pem)
    
    # Set proper permissions
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx chmod 644 /etc/nginx/ssl/cert.pem)
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx chmod 600 /etc/nginx/ssl/key.pem)
    
    print_status "Initial certificate setup completed"
}

# Start full production stack
start_production_stack() {
    print_info "Starting full production stack..."
    
    # Stop nginx
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml down)
    
    # Start all services
    (cd "$INFRA_DIR" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml up -d)
    
    print_status "Production stack started"
}

# Set up auto-renewal
setup_auto_renewal() {
    print_info "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > "$INFRA_DIR/renew-ssl.sh" << EOF
#!/bin/bash

# SSL Certificate Renewal Script
# This script renews Let's Encrypt certificates automatically

set -e

cd "\$(dirname "\$0")"

echo "🔄 Renewing SSL certificates..."

# Renew certificates
(cd "\$(dirname "\$0")" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml --profile ssl-setup run --rm certbot renew)

# Copy renewed certificates
(cd "\$(dirname "\$0")" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/cert.pem)
(cd "\$(dirname "\$0")" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/key.pem)

# Set proper permissions
(cd "\$(dirname "\$0")" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx chmod 644 /etc/nginx/ssl/cert.pem)
(cd "\$(dirname "\$0")" && docker compose -f prod/docker-compose.prod.yml -f docker-compose.yml exec nginx chmod 600 /etc/nginx/ssl/key.pem)

# Reload nginx
(cd "\$(dirname "\$0")" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml exec nginx nginx -s reload)

echo "✅ SSL certificates renewed successfully"
EOF
    
    chmod +x "$INFRA_DIR/renew-ssl.sh"
    
    print_status "Auto-renewal script created: $INFRA_DIR/renew-ssl.sh"
    print_info "Add to crontab for automatic renewal:"
    echo "   crontab -e"
    echo "   Add: 0 12 * * * $INFRA_DIR/renew-ssl.sh"
}

# Test SSL configuration
test_ssl_configuration() {
    print_info "Testing SSL configuration..."
    
    # Wait for services to be ready
    for i in $(seq 1 60); do
        if curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health | grep -q "200"; then
            break
        fi
        sleep 2
    done
    
    # Test HTTPS endpoints
    if curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health | grep -q "200"; then
        print_status "HTTPS health check: OK"
    else
        print_warning "HTTPS health check: Failed (may be starting up)"
    fi
    
    # Test certificate
    cert_info=$(echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "SSL certificate is valid"
        echo "$cert_info" | while read line; do
            echo "   $line"
        done
    else
        print_error "SSL certificate test failed"
    fi
}

# Main execution
main() {
    check_requirements
    get_user_input
    create_directories
    update_configurations
    verify_domain
    setup_initial_certificate
    start_production_stack
    setup_auto_renewal
    test_ssl_configuration
    
    echo ""
    print_status "Let's Encrypt SSL setup completed successfully!"
    echo ""
    print_info "Your production services are now accessible via HTTPS:"
    echo "   • Main Application:     https://$DOMAIN"
    echo "   • AI Backend API:       https://$DOMAIN/api/ai/health"
    echo "   • Arachne Scraper API:  https://$DOMAIN/api/scrape/health"
    echo ""
    print_info "Certificate auto-renewal:"
    echo "   • Script: ../renew-ssl.sh"
    echo "   • Add to crontab: 0 12 * * * /path/to/your/project/renew-ssl.sh"
    echo ""
    print_info "Management commands:"
    echo "   • View logs: (cd \"$INFRA_DIR\" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml logs -f)"
    echo "   • Renew certificates: $INFRA_DIR/renew-ssl.sh"
    echo "   • Stop services: (cd \"$INFRA_DIR\" && docker compose -f docker-compose.yml -f prod/docker-compose.prod.yml down)"
    echo ""
    print_warning "Important: Set up the cron job for automatic certificate renewal!"
}

# Run main function
main 