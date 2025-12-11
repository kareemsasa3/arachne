#!/bin/bash

# SSL Certificate Setup Script for Arachne Project
# This script helps you set up SSL certificates for HTTPS

set -euo pipefail

echo "🔐 SSL Certificate Setup for Arachne Project"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
    print_warning "Running as root. Consider running as a non-root user with sudo privileges."
fi

# Check if required tools are installed
check_requirements() {
    print_info "Checking requirements..."
    
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    print_status "Requirements check passed"
}

# Option 1: Generate self-signed certificate (for development/testing)
generate_self_signed() {
    print_info "Generating self-signed SSL certificate for development..."
    
    local domain=${1:-"localhost"}
    local cert_dir="infrastructure/nginx/ssl"
    
    # Create certificate directory if it doesn't exist
    mkdir -p "$cert_dir"
    
    # Generate private key
    openssl genrsa -out "$cert_dir/key.pem" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$cert_dir/key.pem" -out "$cert_dir/cert.csr" -subj "/C=US/ST=State/L=City/O=Organization/CN=$domain"
    
    # Generate self-signed certificate
    openssl x509 -req -in "$cert_dir/cert.csr" -signkey "$cert_dir/key.pem" -out "$cert_dir/cert.pem" -days 365
    
    # Clean up CSR file
    rm "$cert_dir/cert.csr"
    
    # Set proper permissions
    chmod 600 "$cert_dir/key.pem"
    chmod 644 "$cert_dir/cert.pem"
    
    print_status "Self-signed certificate generated successfully!"
    print_info "Certificate location: $cert_dir/"
    print_warning "Note: Self-signed certificates will show security warnings in browsers"
    print_warning "This is suitable for development/testing only"
    echo ""
    print_warning "🔒 SECURITY WARNING:"
    print_warning "   - These files are NOT committed to git (see .gitignore)"
    print_warning "   - Keep your private key secure and never share it"
    print_warning "   - For production, use Let's Encrypt or commercial certificates"
}

# Option 2: Let's Encrypt setup instructions
lets_encrypt_setup() {
    print_info "Let's Encrypt SSL Certificate Setup"
    echo ""
    echo "To use Let's Encrypt (recommended for production):"
    echo ""
    echo "1. Ensure your domain points to your server"
    echo "2. Install certbot:"
    echo "   sudo apt-get update"
    echo "   sudo apt-get install certbot"
    echo ""
    echo "3. Obtain certificate:"
    echo "   sudo certbot certonly --standalone -d your-domain.com"
    echo ""
    echo "4. Copy certificates to nginx ssl directory:"
    echo "   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem infrastructure/nginx/ssl/cert.pem"
    echo "   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem infrastructure/nginx/ssl/key.pem"
    echo ""
    echo "5. Set proper permissions:"
    echo "   sudo chmod 600 infrastructure/nginx/ssl/key.pem"
    echo "   sudo chmod 644 infrastructure/nginx/ssl/cert.pem"
    echo ""
    echo "6. Set up auto-renewal:"
    echo "   sudo crontab -e"
    echo "   Add: 0 12 * * * /usr/bin/certbot renew --quiet"
    echo ""
    print_warning "Replace 'your-domain.com' with your actual domain name"
}

# Option 3: Manual certificate installation
manual_certificate() {
    print_info "Manual Certificate Installation"
    echo ""
    echo "If you have SSL certificates from a commercial provider:"
    echo ""
    echo "1. Place your certificate files in infrastructure/nginx/ssl/:"
    echo "   - cert.pem (your certificate file)"
    echo "   - key.pem (your private key file)"
    echo ""
    echo "2. Set proper permissions:"
    echo "   chmod 600 infrastructure/nginx/ssl/key.pem"
    echo "   chmod 644 infrastructure/nginx/ssl/cert.pem"
    echo ""
    echo "3. Update the domain name in nginx configuration if needed"
    echo ""
    print_warning "Make sure your certificate matches your domain name"
    echo ""
    print_warning "🔒 SECURITY WARNING:"
    print_warning "   - These files are NOT committed to git (see .gitignore)"
    print_warning "   - Keep your private key secure and never share it"
    print_warning "   - Never commit private keys to version control"
}

# Option 4: Test SSL configuration
test_ssl_config() {
    print_info "Testing SSL configuration..."
    
    local cert_dir="infrastructure/nginx/ssl"
    
    if [ ! -f "$cert_dir/cert.pem" ] || [ ! -f "$cert_dir/key.pem" ]; then
        print_error "SSL certificates not found in $cert_dir/"
        print_info "Please generate or install certificates first"
        return 1
    fi
    
    # Test certificate validity
    if openssl x509 -in "$cert_dir/cert.pem" -text -noout &> /dev/null; then
        print_status "Certificate is valid"
    else
        print_error "Certificate is invalid or corrupted"
        return 1
    fi
    
    # Test private key
    if openssl rsa -in "$cert_dir/key.pem" -check -noout &> /dev/null; then
        print_status "Private key is valid"
    else
        print_error "Private key is invalid or corrupted"
        return 1
    fi
    
    # Test nginx configuration (basic syntax check)
    if docker run --rm -v "$(pwd)/infrastructure/nginx/conf.d:/etc/nginx/conf.d:ro" -v "$(pwd)/infrastructure/nginx/ssl:/etc/nginx/ssl:ro" nginx:alpine nginx -T | grep -q "ssl_certificate" &> /dev/null; then
        print_status "Nginx SSL configuration syntax is valid"
    else
        print_warning "Nginx configuration may have issues (upstream hosts not available during testing)"
        print_info "This is normal when testing outside of Docker Compose context"
    fi
    
    print_status "SSL configuration test passed!"
}

# Option 5: Update domain name in configuration
update_domain() {
    local domain=$1
    
    if [ -z "$domain" ]; then
        echo "Enter your domain name:"
        read -r domain
    fi
    
    if [ -z "$domain" ]; then
        print_error "Domain name cannot be empty"
        return 1
    fi
    
    print_info "Updating domain name to: $domain"
    
    # Update nginx production template server_name
    sed -i.bak "s/server_name _;/server_name $domain;/g" infrastructure/nginx/conf.d/default.conf.template
    
    # Update production docker-compose domain placeholders
    sed -i.bak "s|https://your-domain.com|https://$domain|g" infrastructure/prod/docker-compose.prod.yml
    
    print_status "Domain name updated successfully!"
    print_info "Backup files created with .bak extension"
}

# Main menu
show_menu() {
    echo ""
    echo "Choose an option:"
    echo "1) Generate self-signed certificate (development/testing)"
    echo "2) Let's Encrypt setup instructions (production)"
    echo "3) Manual certificate installation instructions"
    echo "4) Test SSL configuration"
    echo "5) Update domain name in configuration"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            echo ""
            read -p "Enter domain name (default: localhost): " domain
            generate_self_signed "${domain:-localhost}"
            ;;
        2)
            lets_encrypt_setup
            ;;
        3)
            manual_certificate
            ;;
        4)
            test_ssl_config
            ;;
        5)
            update_domain
            ;;
        6)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please try again."
            show_menu
            ;;
    esac
}

# Check if script is run with arguments
if [ $# -gt 0 ]; then
    case $1 in
        "self-signed")
            generate_self_signed "$2"
            ;;
        "test")
            test_ssl_config
            ;;
        "update-domain")
            update_domain "$2"
            ;;
        *)
            echo "Usage: $0 [self-signed|test|update-domain] [domain]"
            echo ""
            echo "Options:"
            echo "  self-signed [domain]  Generate self-signed certificate"
            echo "  test                  Test SSL configuration"
            echo "  update-domain [domain] Update domain name in config"
            exit 1
            ;;
    esac
else
    # Run interactive menu
    check_requirements
    show_menu
fi

echo ""
print_info "SSL setup complete! You can now start your services with HTTPS support."
print_info "Run: cd infrastructure && ./prod.sh" 